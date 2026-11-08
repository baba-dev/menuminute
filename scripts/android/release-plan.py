#!/usr/bin/env python3
"""Plan an immutable, monotonically-versioned Play upload candidate.

The workflow, not this script, authenticates the source CI and main SHA before
calling the planner. This script never reads signing credentials.
"""
import os
import re
from pathlib import Path

MAX_GOOGLE_PLAY_VERSION_CODE = 2_100_000_000
NATIVE_SOURCE_PREFIXES = ("android/", "scripts/android/")
NATIVE_WORKFLOW = ".github/workflows/android-release.yml"


def native_release_input(path: str) -> bool:
    return path == NATIVE_WORKFLOW or path.startswith(NATIVE_SOURCE_PREFIXES)


def plan_release(event: str, run_number: int, version_line: str, changed_paths: list[str]) -> dict[str, str]:
    if event not in ("workflow_run", "workflow_dispatch"):
        raise ValueError("Unsupported release event")
    if not re.fullmatch(r"[0-9]+\.[0-9]+", version_line):
        raise ValueError("Invalid Android version line")
    if not isinstance(run_number, int) or run_number < 1 or run_number + 1 > MAX_GOOGLE_PLAY_VERSION_CODE:
        raise ValueError("Android versionCode outside Play range")

    should_sign = event == "workflow_dispatch" or any(native_release_input(path) for path in changed_paths)
    return {
        "should_sign": "true" if should_sign else "false",
        "version_code": str(run_number + 1),
        "version_name": f"{version_line}.{run_number}",
    }


def main() -> None:
    event = os.environ["GITHUB_EVENT_NAME"]
    run_number = int(os.environ["GITHUB_RUN_NUMBER"])
    sha = os.environ["RELEASE_SOURCE_SHA"]
    if not re.fullmatch(r"[0-9a-f]{40}", sha):
        raise ValueError("Release source is not a full commit SHA")
    paths = Path(os.environ["RELEASE_CHANGED_PATHS"]).read_text(encoding="utf-8").splitlines()
    plan = plan_release(event, run_number, os.environ.get("ANDROID_VERSION_LINE", "1.0"), paths)
    plan["source_sha"] = sha
    plan["artifact_name"] = f"menuminute-android-signed-{sha}-{run_number}"
    with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as handle:
        for key, value in plan.items():
            handle.write(f"{key}={value}\n")
    with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as handle:
        handle.write("### Android signed candidate preflight\n\n")
        handle.write(f"- Source SHA: `{sha}`\n")
        handle.write(f"- Native release needed: `{plan['should_sign']}`\n")
        handle.write(f"- Planned Android version: `{plan['version_name']}` / `{plan['version_code']}`\n")
        handle.write("- Distribution: **none** (signed artifact only)\n")


if __name__ == "__main__":
    main()
