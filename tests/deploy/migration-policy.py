#!/usr/bin/env python3
"""Contract tests for the Python guards embedded in the audited root helper."""
import json
import pathlib
import shutil
import subprocess
import sys
import tempfile

source = pathlib.Path("infra/deploy/menuminute-release").read_text()
blocks = [part.split("\nPY", 1)[0] for part in source.split("<<'PY'\n")[1:]]
assert len(blocks) == 2, "Both embedded Python preflight blocks must remain covered"
for block in blocks:
    compile(block, "<root-helper-python>", "exec")


def journal(root, tags):
    (root / "meta").mkdir(parents=True, exist_ok=True)
    (root / "meta/_journal.json").write_text(
        json.dumps({"entries": [{"tag": tag} for tag in tags]})
    )


def check(previous, candidate, expected, succeeds=True):
    result = subprocess.run(
        [sys.executable, "-", str(previous), str(candidate)],
        input=blocks[0],
        capture_output=True,
        text=True,
        check=False,
    )
    if succeeds:
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == expected, result.stdout
    else:
        assert result.returncode != 0, "Unsafe history was accepted"


with tempfile.TemporaryDirectory() as temp:
    root = pathlib.Path(temp)
    old, new = root / "old", root / "new"
    journal(old, ["0000_initial"])
    (old / "0000_initial.sql").write_text("select 1;")
    (old / "meta/0000_snapshot.json").write_text("{}")
    shutil.copytree(old, new)
    check(old, new, "unchanged")

    journal(new, ["0000_initial", "0001_additive"])
    (new / "0001_additive.sql").write_text("select 2;")
    check(old, new, "changed")

    (new / "0000_initial.sql").write_text("select 99;")
    check(old, new, "", False)
    (new / "0000_initial.sql").write_text("select 1;")

    (new / "meta/0000_snapshot.json").unlink()
    check(old, new, "", False)
    (new / "meta/0000_snapshot.json").write_text("{}")

    journal(new, ["0001_additive"])
    check(old, new, "", False)
    journal(new, ["0000_initial", "0001_additive"])

    (new / "0001_additive.sql").unlink()
    check(old, new, "", False)


# Regression: production already applied menu import 0009 before Auth 2.0 landed.
# Filename numbers are historical labels; the append-only journal owns execution order.
# Never insert Auth entries ahead of an already-applied production migration.
production_tags = [
    "0000_organic_quasimodo",
    "0001_tenant_security",
    "0002_odd_darkstar",
    "0003_core_security",
    "0004_reflective_the_spike",
    "0005_menu_security",
    "0006_online_ordering",
    "0009_menu_import_foundation",
]
new_tags = [
    "0007_verified_identity",
    "0008_auth_security",
    "0010_menu_import_nvidia_engine",
    "0011_menu_import_review",
]
source_root = pathlib.Path("src/db/migrations")
source_journal = json.loads((source_root / "meta/_journal.json").read_text())
entries = source_journal["entries"]
assert [entry["tag"] for entry in entries[: len(production_tags + new_tags)]] == production_tags + new_tags
assert [entry["idx"] for entry in entries] == list(range(len(entries)))
assert all(left["when"] < right["when"] for left, right in zip(entries, entries[1:]))
assert all((source_root / (entry["tag"] + ".sql")).is_file() for entry in entries)

with tempfile.TemporaryDirectory() as temp:
    root = pathlib.Path(temp)
    deployed = root / "deployed"
    candidate = root / "candidate"
    shutil.copytree(source_root, deployed)
    shutil.copytree(source_root, candidate)
    (deployed / "meta/_journal.json").write_text(
        json.dumps({**source_journal, "entries": entries[: len(production_tags)]})
    )
    for sql in deployed.glob("*.sql"):
        if sql.stem not in production_tags:
            sql.unlink()

    check(deployed, candidate, "changed")

    # The original failure mode must still be rejected by the root helper.
    bad = [*entries[:7], entries[8], entries[9], entries[7], *entries[10:]]
    (candidate / "meta/_journal.json").write_text(
        json.dumps({**source_journal, "entries": bad})
    )
    check(deployed, candidate, "", False)

# Production deployment must not quietly go stage-only due to an Actions variable.
deploy_workflow = pathlib.Path(".github/workflows/deploy-vps.yml").read_text()
assert "AUTH_V2_CUTOVER_APPROVED" not in deploy_workflow
assert "inputs.activate" not in deploy_workflow
assert 'menuminute-release eligibility $RELEASE_SHA $DEPLOY_DIGEST' in deploy_workflow
assert 'menuminute-release $mode $RELEASE_SHA $DEPLOY_DIGEST' in deploy_workflow

print("Production 0009 lineage and automatic activation regression: PASS")

print("Root-helper migration lineage and embedded Python syntax: PASS")
