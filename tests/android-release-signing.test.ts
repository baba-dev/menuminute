import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const releaseWorkflow = readFileSync(
  path.resolve(".github/workflows/android-release.yml"),
  "utf8"
);

describe("Google Play upload bundle verification", () => {
  it("verifies the Android AAB strictly against the owner-provided upload certificate", () => {
    const verification = releaseWorkflow
      .split("      - name: Verify Java archive signature")[1]!
      .split("      - name: Retain signed candidate")[0]!;

    // Public CAs do not sign local Play upload keys. Supplying the narrowly
    // scoped upload keystore preserves strict signature verification.
    expect(verification).toContain(
      "VERIFY_STORE_PASS: ${{ secrets.ANDROID_UPLOAD_STORE_PASSWORD }}"
    );
    expect(verification).toContain(
      'jarsigner -verify -strict -keystore "$RUNNER_TEMP/upload.jks" -storepass:env VERIFY_STORE_PASS "$AAB"'
    );
    expect(verification).toContain('test -s "$AAB"');
    expect(verification).toContain('sha256sum "$AAB" > "$AAB.sha256"');
    expect(verification).not.toContain("|| true");
    expect(verification).not.toContain("continue-on-error");
    expect(verification).not.toContain("jarsigner -verify -strict \"$AAB\"");
  });

  it("does not put signing passwords into GITHUB_ENV or bundle artifacts", () => {
    expect(releaseWorkflow).not.toContain("echo \"MM_ANDROID_UPLOAD_STORE_PASSWORD=");
    expect(releaseWorkflow).not.toContain("echo \"MM_ANDROID_UPLOAD_KEY_PASSWORD=");
    expect(releaseWorkflow).toContain('rm -f "$RUNNER_TEMP/upload.jks"');
    const artifacts = releaseWorkflow
      .split("      - name: Retain signed candidate")[1]!
      .split("      - name: Remove temporary upload keystore")[0]!;
    expect(artifacts).toContain("app-release.aab.sha256");
    expect(artifacts).not.toContain("upload.jks");
  });
});
