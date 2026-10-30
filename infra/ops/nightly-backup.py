#!/usr/bin/env python3
"""Root-only MenuMinute nightly PostgreSQL 17 + private-media Restic backup.

This is a separately installed operator control-plane tool, NOT an application
runtime script. Installation and timer activation require explicit review.
It never writes to the live database, releases, ERP or private media.
"""
import argparse
import datetime as dt
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
import tempfile

BACKUP_ROOT = Path("/var/backups/menuminute")
WRAPPER = Path("/usr/local/sbin/menuminute-restic")
MEDIA = Path("/var/lib/menuminute/media")
RELEASE_ROOT = Path("/var/www/menuminute/releases")
WEB_LINK = Path("/var/www/menuminute/current")
WORKER_LINK = Path("/var/www/menuminute/worker-current")
ENV_FILES = [Path("/etc/menuminute/web.env"), Path("/etc/menuminute/worker.env")]
NIGHTLY_TAG = "menuminute-nightly"
UTC = dt.timezone.utc


class BackupGateError(Exception):
    pass


def command(args, *, env=None, timeout=120, stdout=subprocess.PIPE):
    try:
        completed = subprocess.run(args, env=env, stdout=stdout,
                                   stderr=subprocess.DEVNULL, timeout=timeout,
                                   check=False, text=(stdout == subprocess.PIPE))
    except (OSError, subprocess.TimeoutExpired) as error:
        raise BackupGateError("required backup command unavailable or timed out") from error
    if completed.returncode != 0:
        raise BackupGateError("required backup command failed")
    return completed.stdout if stdout == subprocess.PIPE else None


def private_file(path, *, executable=False):
    if path.is_symlink():
        raise BackupGateError("linked credential or backup command is not accepted")
    try:
        info = path.stat()
    except OSError as error:
        raise BackupGateError("required protected backup input not found") from error
    if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o077:
        raise BackupGateError("protected file must be regular, root-owned and mode 0600 or tighter")
    if executable and not info.st_mode & stat.S_IXUSR:
        raise BackupGateError("root-owned backup wrapper is not executable")


def protected_dir(path, *, create=False):
    if create:
        path.mkdir(mode=0o700, parents=False, exist_ok=True)
    if path.is_symlink():
        raise BackupGateError("linked staging directory is prohibited")
    info = path.stat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o077:
        raise BackupGateError("backup staging directory must be root-owned and mode 0700")


def release_identity():
    if not WEB_LINK.is_symlink() or not WORKER_LINK.is_symlink():
        raise BackupGateError("web and worker must use release symlinks")
    first = WEB_LINK.resolve(strict=True)
    second = WORKER_LINK.resolve(strict=True)
    if first != second or first.parent != RELEASE_ROOT or not re.fullmatch(r"[0-9a-f]{40}", first.name):
        raise BackupGateError("active web and worker release identity mismatch")
    contents = (first / "RELEASE-SHA").read_text(encoding="ascii").strip()
    if contents != first.name:
        raise BackupGateError("active release manifest mismatch")
    return first.name


def source_preflight():
    if os.geteuid() != 0:
        raise BackupGateError("must run as root")
    private_file(WRAPPER, executable=True)
    for path in ENV_FILES:
        private_file(path)
    if MEDIA.is_symlink() or not MEDIA.is_dir():
        raise BackupGateError("private media root missing or linked")
    if MEDIA.resolve() != MEDIA:
        raise BackupGateError("private media root is redirected")
    if BACKUP_ROOT.exists():
        protected_dir(BACKUP_ROOT)
    else:
        # Do not create even a staging directory during --check.
        parent = BACKUP_ROOT.parent
        if parent.is_symlink() or not parent.is_dir():
            raise BackupGateError("root backup parent is not a directory")
    return release_identity()


def postgres_env():
    # Verify the local superuser over peer auth. Root environment variables are
    # scrubbed, including migration/runtime credentials, in the child process.
    return ["runuser", "-u", "postgres", "--", "env", "-i",
            "PATH=/usr/bin:/bin",
            "PGHOST=/var/run/postgresql", "PGPORT=5432",
            "PGDATABASE=menuminute", "PGUSER=postgres",
            "PGCONNECT_TIMEOUT=5"]


def verify_postgres():
    result = command(postgres_env() + [
        "psql", "-XAt", "-w", "-c",
        "SELECT current_setting('server_version_num'), current_database(),"
        " rolsuper FROM pg_roles WHERE rolname = current_user"
    ], timeout=30)
    match = (result or "").strip().split("|")
    if len(match) != 3 or not match[0].isdigit() or not 170000 <= int(match[0]) < 180000:
        raise BackupGateError("local database is not PostgreSQL 17")
    if match[1:] != ["menuminute", "t"]:
        raise BackupGateError("backup identity is not the local menuminute PostgreSQL superuser")


def ensure_disk_headroom():
    # The ERP shares the root volume. Refuse to stage an unbounded pg_dump
    # unless available space covers the database footprint plus 10 GiB reserve.
    size = command(postgres_env() + [
        "psql", "-XAt", "-w", "-c", "SELECT pg_database_size(current_database())"
    ], timeout=30)
    if not size or not size.strip().isdigit():
        raise BackupGateError("PostgreSQL size cannot be measured")
    db_bytes = int(size.strip())
    free_bytes = shutil.disk_usage(BACKUP_ROOT).free
    if free_bytes < db_bytes + 10 * 1024 ** 3:
        raise BackupGateError("shared ERP disk reserve is insufficient for staged PostgreSQL dump")


def restic_env():
    result = os.environ.copy()
    for name in ("DATABASE_URL", "MIGRATION_DATABASE_URL", "WORKER_DATABASE_URL",
                 "PGHOST", "PGHOSTADDR", "PGPORT", "PGDATABASE", "PGPASSWORD",
                 "PGSERVICE", "PGOPTIONS"):
        result.pop(name, None)
    return result


def remote_snapshots():
    raw = command([str(WRAPPER), "snapshots", "--json", "--tag", NIGHTLY_TAG],
                  env=restic_env(), timeout=120)
    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError) as error:
        raise BackupGateError("Restic snapshot listing is invalid") from error
    if not isinstance(parsed, list):
        raise BackupGateError("Restic snapshot listing is not an array")
    return parsed


def exact_new_snapshot(before, after, stage):
    previous = {item.get("id") for item in before if isinstance(item, dict)}
    candidates = [item for item in after if isinstance(item, dict)
                  and item.get("id") not in previous]
    if len(candidates) != 1:
        raise BackupGateError("expected exactly one new tagged off-host snapshot")
    selected = candidates[0]
    paths = selected.get("paths")
    if not isinstance(paths, list) or str(stage) not in paths or str(MEDIA) not in paths:
        raise BackupGateError("new snapshot did not include both SQL staging and private media")
    snapshot_id = selected.get("id")
    if not isinstance(snapshot_id, str) or not re.fullmatch("[a-f0-9]{64}", snapshot_id):
        raise BackupGateError("new snapshot has invalid identity")
    if NIGHTLY_TAG not in selected.get("tags", []):
        raise BackupGateError("new snapshot lacks nightly source tag")
    return snapshot_id


def dump_database(stage):
    dest = stage / "database.dump"
    with dest.open("xb") as output:
        os.fchmod(output.fileno(), 0o600)
        command(postgres_env() + ["pg_dump", "--format=custom", "--no-owner",
                                  "--no-acl"], stdout=output, timeout=1800)
    if dest.stat().st_size == 0:
        raise BackupGateError("PostgreSQL dump is empty")
    listing = command(["pg_restore", "--list", str(dest)], timeout=180)
    if "onboarding_progress" not in (listing or ""):
        raise BackupGateError("forced-RLS database backup missing onboarding progress")
    sha = hashlib.sha256()
    with dest.open("rb") as source:
        for block in iter(lambda: source.read(1048576), b""):
            sha.update(block)
    return dest.stat().st_size, sha.hexdigest()


def create_backup():
    os.umask(0o077)
    current_sha = source_preflight()
    protected_dir(BACKUP_ROOT, create=True)
    # Flock serializes scheduled/manual invocations; it does not bypass Restic's
    # own repository lock against simultaneous predeploy backups.
    lock_path = BACKUP_ROOT / ".nightly-backup.lock"
    if lock_path.is_symlink():
        raise BackupGateError("backup lock path is a symlink")
    with lock_path.open("a+b") as lock:
        os.fchmod(lock.fileno(), 0o600)
        try:
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as error:
            raise BackupGateError("another nightly backup is still running") from error
        verify_postgres()
        ensure_disk_headroom()
        before = remote_snapshots()
        started = dt.datetime.now(UTC)
        with tempfile.TemporaryDirectory(prefix=".nightly.", dir=BACKUP_ROOT) as temporary:
            stage = Path(temporary)
            stage.chmod(0o700)
            config_dir = stage / "config"
            config_dir.mkdir(mode=0o700)
            for original in ENV_FILES:
                shutil.copyfile(original, config_dir / original.name)
                (config_dir / original.name).chmod(0o600)
            dump_bytes, dump_sha = dump_database(stage)
            stamp = {
                "kind": "menuminute-nightly-sql-media",
                "dump_format": "postgres17-custom-no-owner-no-acl",
                "captured_at_utc": started.isoformat(),
                "active_release_sha": current_sha,
                "dump_bytes": dump_bytes,
                "dump_sha256": dump_sha,
                "media_root": str(MEDIA),
                "consistency_warning": "pg_dump and private-media traversal are NOT atomic",
                "external_secrets": "web.env and worker.env encrypted only in Restic",
            }
            manifest = stage / "backup-manifest.json"
            manifest.write_text(json.dumps(stamp, sort_keys=True) + "\n", encoding="utf-8")
            manifest.chmod(0o600)
            # No credential output. Capture failures with generic operator errors.
            command([str(WRAPPER), "backup", "--tag", NIGHTLY_TAG,
                     "--tag", "menuminute-release-" + current_sha,
                     str(stage), str(MEDIA)], env=restic_env(), timeout=3600)
            snapshot_id = exact_new_snapshot(before, remote_snapshots(), stage)
            duration = round((dt.datetime.now(UTC) - started).total_seconds(), 1)
        # Only a successful verified off-host snapshot is reported as success.
        return {"status": "pass", "backup_kind": "nightly-sql-media",
                "snapshot_id_prefix": snapshot_id[:12],
                "active_release_sha": current_sha, "elapsed_seconds": duration,
                "db_dump_verified": True, "media_root_included": True,
                "db_media_atomicity_verified": False,
                "isolated_restore_verified": False, "external_alert_delivery_verified": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true",
                        help="Read-only local prerequisite check; does not create an archive or snapshot")
    args = parser.parse_args()
    try:
        if args.check:
            sha = source_preflight()
            verify_postgres()
            result = {"status": "pass", "mode": "read-only-preflight",
                      "release_sha": sha,
                      "new_snapshot_created": False}
        else:
            result = create_backup()
        print(json.dumps(result, sort_keys=True))
        return 0
    except (BackupGateError, OSError, ValueError, RuntimeError, subprocess.SubprocessError):
        print(json.dumps({"status": "fail", "reason": "protected_backup_precondition_or_execution_failed",
                          "new_snapshot_verified": False}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
