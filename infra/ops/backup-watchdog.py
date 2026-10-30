#!/usr/bin/env python3
"""Read-only MenuMinute nightly-backup freshness and timer health probe.

Run locally as an operator, and schedule this SAME probe from an independent
monitoring host via a restricted SSH command. A local probe alone cannot alert
on total VPS failure. stdout contains only non-sensitive summary fields.
"""
import argparse
import datetime as dt
import json
import os
import subprocess
import stat
import sys

UTC = dt.timezone.utc


def timestamp(value):
    if not isinstance(value, str):
        raise ValueError("missing snapshot timestamp")
    return dt.datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)


def run_checked(command, timeout=40):
    result = subprocess.run(command, capture_output=True, text=True, timeout=timeout, check=False)
    if result.returncode:
        # Never echo raw stderr: restic/wrapper errors can contain endpoints.
        raise RuntimeError("command failed: " + os.path.basename(command[0]))
    return result.stdout


def properties(unit, names):
    output = run_checked(["systemctl", "show", unit, "--property=" + ",".join(names)])
    props = dict(line.split("=", 1) for line in output.splitlines() if "=" in line)
    return {name: props.get(name, "") for name in names}


def systemd_utc(raw):
    if not raw or raw in ("n/a", "0", "infinity"):
        raise ValueError("no recorded service execution")
    # GNU date parses the local zone returned by systemctl; do not guess UTC.
    result = run_checked(["date", "-u", "-d", raw, "+%Y-%m-%dT%H:%M:%SZ"], timeout=5)
    return timestamp(result.strip())


def assess(snapshots, timer, service, now, max_age_hours, tag=None):
    problems = []
    eligible = []
    for item in snapshots:
        if not isinstance(item, dict):
            continue
        if tag and tag not in item.get("tags", []):
            continue
        try:
            when = timestamp(item.get("time"))
        except (ValueError, TypeError, OverflowError):
            continue
        if when <= now + dt.timedelta(minutes=5):
            eligible.append(when)
    newest = max(eligible) if eligible else None
    snapshot_age = round((now - newest).total_seconds() / 3600, 2) if newest else None
    if newest is None or snapshot_age > max_age_hours:
        problems.append("no_fresh_matching_encrypted_snapshot")
    if timer.get("ActiveState") != "active" or timer.get("UnitFileState") != "enabled":
        problems.append("nightly_timer_not_active_and_enabled")
    if not timer.get("NextElapseUSecRealtime") or timer["NextElapseUSecRealtime"] in ("n/a", "infinity"):
        problems.append("nightly_timer_next_run_missing")
    if service.get("Result") != "success" or service.get("ExecMainStatus") != "0":
        problems.append("backup_service_last_result_unsuccessful")
    try:
        executed = systemd_utc(service.get("ExecMainExitTimestamp", ""))
        hours = (now - executed).total_seconds() / 3600
        if hours < -0.1 or hours > max_age_hours:
            problems.append("backup_service_last_success_stale")
        if newest and abs((newest - executed).total_seconds()) > 6 * 3600:
            problems.append("snapshot_not_correlated_with_nightly_service")
    except (RuntimeError, ValueError, OverflowError):
        problems.append("backup_service_execution_not_verified")
    return {
        "status": "pass" if not problems else "fail",
        "observed_at_utc": now.isoformat(),
        "matching_snapshot_count": len(eligible),
        "latest_snapshot_age_hours": snapshot_age,
        "timer_active": timer.get("ActiveState") == "active",
        "timer_enabled": timer.get("UnitFileState") == "enabled",
        "last_service_result_success": service.get("Result") == "success" and service.get("ExecMainStatus") == "0",
        "failures": problems,
        "external_alert_delivery_verified": False,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--restic-wrapper", default="/usr/local/sbin/menuminute-restic")
    parser.add_argument("--max-age-hours", type=float, default=30)
    parser.add_argument("--tag", default=None, help="Required snapshot tag (set if nightly backup uses one)")
    parser.add_argument("--synthetic-failure", action="store_true",
                        help="Non-destructive FAILURE exit to test an external alerting integration")
    args = parser.parse_args()
    if not 1 <= args.max_age_hours <= 168:
        parser.error("--max-age-hours must be between 1 and 168")
    if args.synthetic_failure:
        print(json.dumps({"status": "fail", "failures": ["synthetic_watchdog_alert_test"],
                          "no_backup_or_service_change": True, "external_alert_delivery_verified": False}))
        return 1
    try:
        wrapper = os.path.realpath(args.restic_wrapper)
        if args.restic_wrapper != "/usr/local/sbin/menuminute-restic" or wrapper != args.restic_wrapper:
            raise RuntimeError("only the reviewed absolute restic wrapper is allowed")
        info = os.stat(wrapper)
        if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
            raise RuntimeError("restic wrapper must be regular, root-owned and not writable by other users")
        snapshot_text = run_checked([wrapper, "snapshots", "--json"], timeout=90)
        snapshots = json.loads(snapshot_text)
        if not isinstance(snapshots, list):
            raise ValueError("invalid snapshot listing")
        timer = properties("menuminute-backup.timer",
                           ["ActiveState", "UnitFileState", "NextElapseUSecRealtime"])
        service = properties("menuminute-backup.service",
                             ["Result", "ExecMainStatus", "ExecMainExitTimestamp"])
        result = assess(snapshots, timer, service, dt.datetime.now(UTC), args.max_age_hours, args.tag)
    except (OSError, RuntimeError, ValueError, subprocess.TimeoutExpired, json.JSONDecodeError):
        result = {"status": "fail", "failures": ["backup_evidence_unavailable"],
                  "external_alert_delivery_verified": False}
    print(json.dumps(result, sort_keys=True))
    return 0 if result["status"] == "pass" else 1


if __name__ == "__main__":
    sys.exit(main())
