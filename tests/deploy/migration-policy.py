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

print("Root-helper migration lineage and embedded Python syntax: PASS")
