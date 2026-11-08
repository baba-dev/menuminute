import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const signing = readFileSync(path.resolve(".github/workflows/android-release.yml"), "utf8");
const publish = readFileSync(path.resolve(".github/workflows/android-play-publish.yml"), "utf8");
const gradle = readFileSync(path.resolve("android/app/build.gradle.kts"), "utf8");

describe("separate guarded Android release automation", () => {
  it("signs after successful main push CI and not from PRs or web-only changes", () => {
    expect(signing).toContain("workflow_run:");
    expect(signing).toContain("workflows: [CI]");
    expect(signing).toContain("github.event.workflow_run.event == 'push'");
    expect(signing).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(signing).toContain("git diff --name-only HEAD^ HEAD");
    expect(signing).toContain("python3 scripts/android/release-plan.py");
    expect(signing).toContain("if: needs.preflight.outputs.should_sign == 'true'");
    expect(signing).toContain("environment: android-play-internal");
    expect(signing).not.toContain("android-play-publish");
  });

  it("uses generated versions and immutable release metadata", () => {
    expect(signing).toContain("MM_ANDROID_VERSION_CODE: ${{ needs.preflight.outputs.version_code }}");
    expect(signing).toContain("MM_ANDROID_VERSION_NAME: ${{ needs.preflight.outputs.version_name }}");
    expect(signing).toContain("android-release.json");
    expect(signing).toContain("retention-days: 30");
    expect(gradle).toContain('System.getenv("MM_ANDROID_VERSION_CODE")');
    expect(gradle).toContain('System.getenv("MM_ANDROID_VERSION_NAME")');
    expect(gradle).toContain("2_100_000_000");
  });

  it("requires manual approval before even drafting an internal Play release", () => {
    expect(publish).toContain("workflow_dispatch:");
    expect(publish).not.toContain("workflow_run:");
    expect(publish).not.toContain("\n  push:");
    expect(publish).toContain("name: android-play-publish");
    expect(publish).toContain('test "$PLAY_PUBLISH_ENABLED" = "true"');
    expect(publish).toContain("github-token: ${{ github.token }}");
    expect(publish).toContain("sha256sum --check --strict");
    expect(publish).toContain("workload_identity_provider: ${{ vars.PLAY_WIF_PROVIDER }}");
    expect(publish).toContain("tracks: internal");
    expect(publish).toContain("status: draft");
    expect(publish).toContain("changesNotSentForReview: true");
    expect(publish).not.toContain("tracks: production");
    expect(publish).not.toContain("status: completed");
  });
});
