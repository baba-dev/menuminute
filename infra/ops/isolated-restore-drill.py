#!/usr/bin/env python3
"""Guarded PostgreSQL 17 disaster-recovery drill, NEVER for the production cluster.

Only loopback, non-5432, explicitly named disposable databases in dedicated
mm-drill data directories are accepted. No clean/drop/create or production DB
connections. In restore mode, pg_restore writes ONLY to the pre-created EMPTY
disposable database. Use a separate VM/container for real isolation.
"""
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys


def checked(command, env=None, timeout=180):
    result = subprocess.run(command, env=env, text=True, capture_output=True,
                            check=False, timeout=timeout)
    if result.returncode:
        # No raw stderr: it may contain database/host credentials or fixture data.
        raise RuntimeError("drill command failed: " + Path(command[0]).name)
    return result.stdout.strip()


def isolated_target(host, port, database, expected_dir):
    if host not in ("127.0.0.1", "::1", "localhost") or not 15000 <= port <= 65535:
        raise ValueError("only a dedicated local cluster on a nonproduction port >=15000 is accepted")
    if not re.fullmatch(r"mm_drill_[a-z0-9_]{3,48}", database):
        raise ValueError("database must be a disposable mm_drill_* database")
    if not os.path.isabs(expected_dir):
        raise ValueError("expected data directory must be an absolute path")
    path = Path(expected_dir).resolve()
    if not any("mm-drill" in part for part in path.parts):
        raise ValueError("data directory path must identify a dedicated mm-drill cluster")
    if str(path).startswith(("/var/lib/postgresql/", "/var/lib/menuminute/",
                             "/var/www/", "/etc/", "/root/")):
        raise ValueError("cannot target a live application or default PostgreSQL data directory")
    return str(path)


def db_env(host, port, database, user):
    env = os.environ.copy()
    for key in ("PGHOST", "PGHOSTADDR", "PGPORT", "PGDATABASE", "PGSERVICE",
                "PGSERVICEFILE", "PGOPTIONS"):
        env.pop(key, None)
    env.update({"PGHOST": host, "PGPORT": str(port), "PGDATABASE": database,
                "PGCONNECT_TIMEOUT": "5"})
    if user:
        env["PGUSER"] = user
    return env


def sql(env, statement):
    return checked(["psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-c", statement],
                   env, timeout=120)


def preflight(env, expected_dir, dump):
    version, name, directory = sql(env,
        "SELECT current_setting('server_version_num'), current_database(),"
        " current_setting('data_directory')").split("|")
    if not 170000 <= int(version) < 180000:
        raise ValueError("disposable target is not PostgreSQL 17")
    if name != env["PGDATABASE"] or os.path.realpath(directory) != expected_dir:
        raise ValueError("target database/cluster does not match explicitly approved disposable cluster")
    listing = checked(["pg_restore", "--list", str(dump)], timeout=120)
    if "onboarding_progress" not in listing:
        raise ValueError("custom-format dump does not contain onboarding_progress")
    if dump.is_symlink() or not dump.is_file() or dump.stat().st_size == 0:
        raise ValueError("expected regular, nonempty dump file")
    return {"postgres_version": int(version), "target_database": name,
            "cluster_identity_verified": True, "dump_contains_onboarding_progress": True}


def target_empty(env):
    count = sql(env, """
        SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE c.relkind IN ('r','p','v','m','f')
        AND n.nspname NOT IN ('pg_catalog','information_schema')
        AND n.nspname NOT LIKE 'pg_toast%'
        AND n.nspname NOT LIKE 'pg_temp%'
    """)
    return int(count) == 0


def identifier(value):
    return '"' + value.replace('"', '""') + '"'


def row_digest(env):
    inventory = sql(env, """
        SELECT n.nspname || E'\t' || c.relname FROM pg_class c
        JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE c.relkind IN ('r','p') AND NOT c.relispartition
        AND n.nspname NOT IN ('pg_catalog','information_schema')
        AND n.nspname NOT LIKE 'pg_toast%'
        ORDER BY n.nspname, c.relname
    """)
    records = []
    for record in inventory.splitlines():
        if not record:
            continue
        schema, name = record.split("\t", 1)
        count = int(sql(env, "SELECT count(*) FROM " + identifier(schema) + "." + identifier(name)))
        records.append((schema, name, count))
    digest = hashlib.sha256()
    for schema, name, count in records:
        digest.update(json.dumps([schema, name, count], separators=(",", ":"), ensure_ascii=True).encode())
        digest.update(b"\n")
    return len(records), sum(entry[2] for entry in records), digest.hexdigest()


def verify_roles_and_rls(env):
    catalog = sql(env, """
        SELECT c.relrowsecurity, c.relforcerowsecurity
        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE c.relname='onboarding_progress' AND c.relkind IN ('r','p')
        ORDER BY n.nspname
    """).splitlines()
    # pg boolean text from psql: t/f. Forcing RLS on every matching table is required.
    forced = bool(catalog) and all(value == "t|t" for value in catalog)
    role_rows = sql(env, """
        SELECT rolname, rolsuper, rolbypassrls FROM pg_roles
        WHERE rolname IN ('menuminute_app', 'menuminute_worker')
        ORDER BY rolname
    """).splitlines()
    role_safe = len(role_rows) == 2 and all(row.endswith("|f|f") for row in role_rows)
    return forced, role_safe


def media_inventory(path):
    root = Path(path)
    if not root.is_absolute() or "mm-drill" not in str(root.resolve()):
        raise ValueError("media proof must come from the isolated mm-drill restore directory")
    if root.is_symlink() or not root.is_dir():
        raise ValueError("isolated media directory missing or linked")
    digest = hashlib.sha256()
    count, total = 0, 0
    for directory, directories, files in os.walk(root, followlinks=False):
        for name in directories:
            if (Path(directory) / name).is_symlink():
                raise ValueError("symlinked media directory is not safe restore evidence")
        for name in sorted(files):
            candidate = Path(directory) / name
            info = candidate.lstat()
            if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1:
                raise ValueError("nonregular/hardlinked private media not accepted")
            relative = candidate.relative_to(root).as_posix()
            digest.update(relative.encode("utf-8", "surrogateescape") + b"\0")
            digest.update(str(info.st_size).encode() + b"\0")
            with candidate.open("rb") as stream:
                for block in iter(lambda: stream.read(1024 * 1024), b""):
                    digest.update(block)
            count += 1
            total += info.st_size
    return count, total, digest.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", choices=("preflight", "restore", "verify"), required=True)
    parser.add_argument("--dump", type=Path, required=True)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, required=True)
    parser.add_argument("--database", required=True)
    parser.add_argument("--user", default=None)
    parser.add_argument("--expected-data-dir", required=True)
    parser.add_argument("--media-root", type=Path)
    parser.add_argument("--expected-row-digest", default=None)
    parser.add_argument("--expected-media-digest", default=None)
    parser.add_argument("--confirm", default=None,
                        help="Required only for restore mode: RESTORE_ONLY_TO_DISPOSABLE_MM_DRILL")
    args = parser.parse_args()
    try:
        expected = isolated_target(args.host, args.port, args.database, args.expected_data_dir)
        env = db_env(args.host, args.port, args.database, args.user)
        report = preflight(env, expected, args.dump)
        report["mode"] = args.mode
        report["source_production_connected"] = False
        report["production_paths_modified"] = False
        if args.mode == "restore":
            if args.confirm != "RESTORE_ONLY_TO_DISPOSABLE_MM_DRILL":
                raise ValueError("explicit disposable-cluster confirmation required")
            if not target_empty(env):
                raise ValueError("target database is not empty; refusing restore")
            checked(["pg_restore", "--exit-on-error", "--single-transaction", "--no-owner",
                     "--no-acl", "--dbname=" + args.database, str(args.dump)], env, timeout=3600)
            report["restore_completed"] = True
            report["requires_independent_post_restore_verification"] = True
        if args.mode == "verify":
            if args.media_root is None:
                raise ValueError("--media-root required for full SQL/media verification")
            tables, rows, counts_sha = row_digest(env)
            forced, roles = verify_roles_and_rls(env)
            media_files, media_bytes, media_sha = media_inventory(args.media_root)
            report.update({"table_count": tables, "total_table_rows": rows,
                           "table_count_digest_sha256": counts_sha,
                           "onboarding_progress_forced_rls": forced,
                           "app_worker_roles_non_superuser_non_bypassrls": roles,
                           "media_file_count": media_files, "media_total_bytes": media_bytes,
                           "media_content_digest_sha256": media_sha,
                           "source_row_parity_verified": args.expected_row_digest == counts_sha
                                 if args.expected_row_digest else False,
                           "source_media_parity_verified": args.expected_media_digest == media_sha
                                 if args.expected_media_digest else False,
                           "manual_role_access_tests_required": True,
                           "db_media_atomicity_verified": False})
            if not forced or not roles:
                raise ValueError("restored RLS or runtime roles fail essential catalog checks")
            if args.expected_row_digest and args.expected_row_digest != counts_sha:
                raise ValueError("source row-count manifest differs from restored data")
            if args.expected_media_digest and args.expected_media_digest != media_sha:
                raise ValueError("source media digest differs from restored data")
        report["status"] = "pass"
        report["observed_at_utc"] = dt.datetime.now(dt.timezone.utc).isoformat()
        print(json.dumps(report, sort_keys=True))
        return 0
    except (OSError, RuntimeError, ValueError, subprocess.TimeoutExpired, IndexError):
        # Do not reveal SQL, dump paths, credentials, table/media names or data in failure output.
        print(json.dumps({"status": "fail", "mode": args.mode,
                          "reason": "isolated_restore_precondition_or_integrity_check_failed",
                          "production_paths_modified": False}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
