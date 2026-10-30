#!/usr/bin/env python3
"""Regression tests for the #131/#49 operator tooling. No VPS access needed."""
import datetime as dt
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[2]


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / "infra" / "ops" / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


restore = load("restore_drill", "isolated-restore-drill.py")
watchdog = load("backup_watchdog", "backup-watchdog.py")
erp = load("erp_sampling", "erp-coexistence.py")
nightly = load("nightly_backup", "nightly-backup.py")
NOW = dt.datetime(2026, 10, 30, 12, 0, tzinfo=dt.timezone.utc)


class IsolationTests(unittest.TestCase):
    def test_ordinary_postgres_cluster_is_rejected(self):
        bad = [
            ("127.0.0.1", 5432, "mm_drill_test", "/tmp/mm-drill-1/data"),
            ("127.0.0.1", 15432, "menuminute", "/tmp/mm-drill-1/data"),
            ("db.production", 15432, "mm_drill_test", "/tmp/mm-drill-1/data"),
            ("127.0.0.1", 15432, "mm_drill_test", "/var/lib/postgresql/17/main"),
            ("127.0.0.1", 15432, "mm_drill_test", "/var/lib/menuminute/mm-drill"),
            ("127.0.0.1", 15432, "mm_drill_test", "/tmp/unmarked/data"),
        ]
        for args in bad:
            with self.subTest(args=args), self.assertRaises(ValueError):
                restore.isolated_target(*args)

    def test_disposable_target_is_accepted(self):
        self.assertEqual(
            restore.isolated_target("127.0.0.1", 15432, "mm_drill_oct30", "/tmp/mm-drill-1/data"),
            "/tmp/mm-drill-1/data",
        )

    def test_target_env_cannot_inherit_ambient_production_connection(self):
        with patch.dict(restore.os.environ, {"PGDATABASE": "menuminute", "PGPORT": "5432",
                                            "PGHOST": "prod.example", "PGOPTIONS": "-c secret=x"}):
            result = restore.db_env("127.0.0.1", 15432, "mm_drill_test", "postgres")
        self.assertEqual(result["PGDATABASE"], "mm_drill_test")
        self.assertEqual(result["PGPORT"], "15432")
        self.assertEqual(result["PGHOST"], "127.0.0.1")
        self.assertNotIn("PGOPTIONS", result)

    def test_media_inventory_hash_and_symlink_refusal(self):
        with tempfile.TemporaryDirectory(prefix="mm-drill-") as root:
            path = Path(root) / "restored-media"
            path.mkdir()
            (path / "a.webp").write_bytes(b"image")
            count, size, digest = restore.media_inventory(path)
            self.assertEqual((count, size), (1, 5))
            self.assertEqual(len(digest), 64)
            (path / "linked.webp").symlink_to(path / "a.webp")
            with self.assertRaises(ValueError):
                restore.media_inventory(path)


class BackupTests(unittest.TestCase):
    def test_no_timer_or_stale_backup_fails(self):
        snapshots = [{"time": "2026-10-26T12:00:00Z"}]
        with patch.object(watchdog, "systemd_utc", return_value=NOW):
            result = watchdog.assess(snapshots, {}, {"Result": "success", "ExecMainStatus": "0"},
                                     NOW, 30)
        self.assertEqual(result["status"], "fail")
        self.assertIn("no_fresh_matching_encrypted_snapshot", result["failures"])

    def test_matching_recent_snapshot_and_timer(self):
        snapshot = [{"time": "2026-10-30T11:00:00Z", "tags": ["nightly"]}]
        timer = {"ActiveState": "active", "UnitFileState": "enabled",
                 "NextElapseUSecRealtime": "Sat 2026-10-31 02:00:00 IST"}
        service = {"Result": "success", "ExecMainStatus": "0",
                   "ExecMainExitTimestamp": "Fri 2026-10-30 11:00:00 UTC"}
        with patch.object(watchdog, "systemd_utc", return_value=NOW - dt.timedelta(hours=1)):
            result = watchdog.assess(snapshot, timer, service, NOW, 30, "nightly")
        self.assertEqual(result["status"], "pass")
        self.assertFalse(result["external_alert_delivery_verified"])

    def test_unrelated_tag_cannot_prove_nightly_success(self):
        with patch.object(watchdog, "systemd_utc", return_value=NOW):
            result = watchdog.assess([{"time": NOW.isoformat(), "tags": ["deploy"]}],
                                     {"ActiveState": "active", "UnitFileState": "enabled",
                                      "NextElapseUSecRealtime": "tomorrow"},
                                     {"Result": "success", "ExecMainStatus": "0"}, NOW, 30, "nightly")
        self.assertEqual(result["status"], "fail")


class CoexistenceTests(unittest.TestCase):
    def test_interpolated_percentile(self):
        self.assertEqual(erp.percentile([10, 20, 30, 40, 50], .95), 48)
        self.assertIsNone(erp.percentile([], .95))

    def test_erp_failure_is_visible(self):
        rec = {"observed_at_utc": "2026-10-30T12:00:00Z", "host_cpu_pct": 23.5,
               "memory_available_mib": 8000, "root_free_gib": 20,
               "disk_read_mib_per_s": 0.5, "disk_write_mib_per_s": 0.25,
               "pg_redis_rss_mib": {"postgres": 240.0, "redis": 80.0},
               "erp": {"status": None, "latency_ms": 5000},
               "menuminute": {"status": 200, "latency_ms": 40},
               "units": {u: {"memory_mib": 60, "tasks": 4}
                         for u in ("menuminute-web.service", "menuminute-worker.service")}}
        result = erp.summary([rec, rec], "quiet-baseline")
        self.assertEqual(result["erp"]["failed_http_probes"], 2)
        self.assertEqual(result["host"]["min_root_free_gib"], 20)


class NightlyBackupTests(unittest.TestCase):
    def test_nightly_backup_uses_fixed_local_peer_authenticated_postgres_identity(self):
        command = nightly.postgres_env()
        self.assertIn("PGHOST=/var/run/postgresql", command)
        self.assertIn("PGPORT=5432", command)
        self.assertIn("PGUSER=postgres", command)
        self.assertIn("PGDATABASE=menuminute", command)
        self.assertEqual(command[:5], ["runuser", "-u", "postgres", "--", "env"])

    def test_nightly_snapshot_requires_new_id_and_both_source_roots(self):
        initial = [{"id": "a" * 64}]
        current = initial + [{
            "id": "b" * 64,
            "paths": ["/var/backups/menuminute/.nightly.example",
                      "/var/lib/menuminute/media"],
            "tags": ["menuminute-nightly", "menuminute-release-" + "c" * 40],
        }]
        self.assertEqual(nightly.exact_new_snapshot(
            initial, current, Path("/var/backups/menuminute/.nightly.example")), "b" * 64)
        with self.assertRaises(nightly.BackupGateError):
            nightly.exact_new_snapshot(initial, [
                {"id": "b" * 64,
                 "paths": ["/var/lib/menuminute/media"],
                 "tags": ["menuminute-nightly"]}], Path("/var/backups/menuminute/.nightly.example"))
        with self.assertRaises(nightly.BackupGateError):
            nightly.exact_new_snapshot(initial, initial, Path("/var/backups/menuminute/.nightly.example"))

    def test_nightly_restic_does_not_inherit_database_credentials(self):
        with patch.dict(nightly.os.environ, {
            "MIGRATION_DATABASE_URL": "secret",
            "DATABASE_URL": "secret",
            "PGPASSWORD": "secret",
            "RESTIC_CACHE_DIR": "/tmp/restic-cache-fixture",
        }):
            env = nightly.restic_env()
        self.assertNotIn("MIGRATION_DATABASE_URL", env)
        self.assertNotIn("DATABASE_URL", env)
        self.assertNotIn("PGPASSWORD", env)
        self.assertEqual(env["RESTIC_CACHE_DIR"], "/tmp/restic-cache-fixture")

    def test_nightly_staging_refuses_to_consume_shared_erp_disk_reserve(self):
        from types import SimpleNamespace
        with patch.object(nightly, "command", return_value=str(25 * 1024 ** 3)):
            with patch.object(nightly.shutil, "disk_usage",
                              return_value=SimpleNamespace(free=31 * 1024 ** 3)):
                with self.assertRaises(nightly.BackupGateError):
                    nightly.ensure_disk_headroom()
        with patch.object(nightly, "command", return_value=str(2 * 1024 ** 3)):
            with patch.object(nightly.shutil, "disk_usage",
                              return_value=SimpleNamespace(free=31 * 1024 ** 3)):
                nightly.ensure_disk_headroom()

    def test_nightly_refuses_insecure_or_linked_wrapper_and_private_files(self):
        with tempfile.TemporaryDirectory() as folder:
            candidate = Path(folder) / "wrapper"
            candidate.write_text("#!/bin/sh\n")
            with patch.object(nightly, "WRAPPER", candidate):
                with self.assertRaises(nightly.BackupGateError):
                    nightly.private_file(candidate, executable=True)
            link = Path(folder) / "link"
            link.symlink_to(candidate)
            with self.assertRaises(nightly.BackupGateError):
                nightly.private_file(link, executable=True)


if __name__ == "__main__":
    unittest.main()
