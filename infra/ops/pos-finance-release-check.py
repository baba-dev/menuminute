#!/usr/bin/env python3
"""POS #142 J: production read-only preflight. Does not activate any finance/fiscal gates.

The operator supplies the exact reviewed release SHA; read-only checks verify service
coexistence and fiscal posture. A PASS is not a compliance, restore, or rollout approval.
"""
import argparse
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
from urllib.error import URLError
from urllib.request import Request, urlopen

CURRENT = Path("/var/www/menuminute/current")
ERP_URL = "http://127.0.0.1:3000/"
POS_URL = "http://127.0.0.1:3100/api/health/ready"
DATABASE_NAME = "menuminute"
PGHOST = "/var/run/postgresql"
PGPORT = "5432"
SHA_PATTERN = re.compile(r"^[a-f0-9]{40}$")
MIN_ROOT_FREE = 10 * 1024 ** 3

# Never interpolate user input into SQL; all database access is read-only.
DB_READ = """
SELECT json_build_object(
  'gateRowCount',count(*),
  'paymentsEnabled',count(*) FILTER (WHERE payments_enabled),
  'documentsEnabled',count(*) FILTER (WHERE documents_enabled),
  'fiscalApproved',count(*) FILTER (WHERE fiscal_approved),
  'providerEnabled',count(*) FILTER (WHERE provider_enabled)
)::text FROM pos_finance_gates;
"""
GUARD_READ = """
SELECT json_build_object(
 'enabledInvoiceGuard',EXISTS (
   SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
   WHERE c.relname='pos_documents'
     AND t.tgname='pos_jurisdiction_before_document'
     AND t.tgenabled='O' AND NOT t.tgisinternal),
 'registeredInvoiceRows',(SELECT count(*) FROM pos_documents WHERE kind='invoice')
)::text;
"""


def check_results(observed, expected_sha, require_closed):
    failures = []
    if not SHA_PATTERN.fullmatch(expected_sha):
        failures.append("reviewed_sha_invalid")
    if observed.get("currentReleaseSha") != expected_sha:
        failures.append("deployed_release_sha_mismatch")
    if observed.get("erpHttpStatus") != 200:
        failures.append("erp_unhealthy")
    if observed.get("posHttpStatus") != 200:
        failures.append("pos_unhealthy")
    if not observed.get("webActive") or not observed.get("workerActive"):
        failures.append("application_services_inactive")
    if observed.get("rootFreeBytes", 0) < MIN_ROOT_FREE:
        failures.append("erp_shared_root_free_space_low")
    guard = observed.get("guard") or {}
    if not guard.get("enabledInvoiceGuard"):
        failures.append("jurisdiction_invoice_insert_guard_missing")
    if guard.get("registeredInvoiceRows", -1) < 0:
        failures.append("invoice_inventory_unavailable")
    gates = observed.get("gates") or {}
    required = ("gateRowCount", "paymentsEnabled", "documentsEnabled",
                "fiscalApproved", "providerEnabled")
    if any(not isinstance(gates.get(key), int) for key in required):
        failures.append("gate_inventory_unavailable")
    if require_closed and any(gates.get(key, 0) != 0 for key in required[1:]):
        failures.append("live_finance_gates_are_enabled")
    return failures


def http_status(url):
    try:
        with urlopen(Request(url, headers={"User-Agent": "MM-POS-Release-Readiness/1"}),
                     timeout=4) as response:
            return response.status
    except (OSError, URLError, ValueError):
        return None


def active_unit(unit):
    result = subprocess.run(
        ["systemctl", "is-active", "--quiet", unit],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False,
        timeout=6
    )
    return result.returncode == 0


def root_pg_read(statement):
    env = {
        "PATH": "/usr/bin:/bin",
        "PGHOST": PGHOST,
        "PGPORT": PGPORT,
        "PGDATABASE": DATABASE_NAME,
        "PGUSER": "postgres",
    }
    result = subprocess.run(
        ["runuser", "-u", "postgres", "--", "env"] +
        [f"{k}={v}" for k, v in env.items()] +
        ["psql", "-X", "-A", "-t", "-w", "-v", "ON_ERROR_STOP=1", "-c", statement],
        capture_output=True, text=True, timeout=15, check=True,
        env={"PATH": "/usr/bin:/bin"},
    )
    return json.loads(result.stdout.strip())


def observe():
    try:
        resolved = CURRENT.resolve(strict=True)
        release = resolved.name
    except (OSError, RuntimeError):
        release = None
    result = {
        "currentReleaseSha": release,
        "erpHttpStatus": http_status(ERP_URL),
        "posHttpStatus": http_status(POS_URL),
        "webActive": active_unit("menuminute-web.service"),
        "workerActive": active_unit("menuminute-worker.service"),
        "rootFreeBytes": shutil.disk_usage("/").free,
        "gates": None,
        "guard": None,
    }
    for name, statement in [("gates", DB_READ), ("guard", GUARD_READ)]:
        try:
            result[name] = root_pg_read(statement)
        except (OSError, subprocess.SubprocessError, ValueError, json.JSONDecodeError):
            result[name] = None
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--expected-sha", required=True,
                        help="Exact reviewed 40-character deployed commit SHA")
    parser.add_argument("--require-gates-closed", action="store_true",
                        help="Fail if any financial/operator gate is already enabled")
    args = parser.parse_args()
    if os.geteuid() != 0:
        print("Root is required for local peer-authenticated read-only PostgreSQL checks.",
              file=sys.stderr)
        return 2
    if not SHA_PATTERN.fullmatch(args.expected_sha):
        print("Invalid expected SHA", file=sys.stderr)
        return 2
    observed = observe()
    failures = check_results(observed, args.expected_sha, args.require_gates_closed)
    print(json.dumps({
        "status": "pass" if not failures else "fail",
        "failures": failures,
        "observed": observed,
        "changesMade": False,
        "certifiesFiscalCompliance": False,
        "certifiesBackupRecovery": False,
        "externalPaymentEnabledByTool": False,
    }, sort_keys=True, indent=2))
    return 0 if not failures else 2


if __name__ == "__main__":
    raise SystemExit(main())
