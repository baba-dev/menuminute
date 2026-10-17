import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(path.resolve(".github/workflows/deploy-vps.yml"), "utf8");
const helper = readFileSync(path.resolve("infra/deploy/menuminute-release"), "utf8");

function shell(script: string, env: Record<string, string> = {}) {
  return spawnSync("bash", ["-c", script], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

describe("deployment hotfix execution regressions", () => {
  it("runs the actual handoff comparison from RUNNER_TEMP and rejects altered provenance", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "menuminute-handoff-"));
    try {
      const workspace = path.join(root, "workspace");
      const runnerTemp = path.join(root, "runner");
      mkdirSync(workspace);
      mkdirSync(runnerTemp);
      const short = "a".repeat(12);
      const archiveName = `menuminute-${short}-linux-arm64.tar.gz`;
      const bytes = Buffer.from("synthetic archive for provenance handoff test");
      const digest = createHash("sha256").update(bytes).digest("hex");
      writeFileSync(path.join(runnerTemp, archiveName), bytes);
      writeFileSync(path.join(runnerTemp, `${archiveName}.sha256`), `${digest}  ${archiveName}\n`);
      const handoff = path.join(workspace, "published-source.json");
      const source = {
        artifact_sha256: digest,
        artifact_name: archiveName,
        artifact_bytes: bytes.length,
      };
      writeFileSync(handoff, JSON.stringify(source));
      const outputs = path.join(root, "outputs");
      const githubEnv = path.join(root, "github-env");
      writeFileSync(outputs, "");
      writeFileSync(githubEnv, "");

      const section = workflow
        .split("      - name: Verify immutable main release identity")[1]!
        .split("      - name: Configure pinned SSH host identity")[0]!;
      const afterCd = section.split('          cd "$RUNNER_TEMP"\n')[1]!;
      const commands = afterCd
        .split("\n")
        .map((line) => line.replace(/^ {10}/, ""))
        .join("\n");
      const script = `set -Eeuo pipefail\nshort="${short}"\ncd "$RUNNER_TEMP"\n${commands}`;
      const env = {
        RUNNER_TEMP: runnerTemp,
        GITHUB_WORKSPACE: workspace,
        GITHUB_EVENT_NAME: "workflow_run",
        GITHUB_ENV: githubEnv,
        GITHUB_OUTPUT: outputs,
      };
      const ok = shell(script, env);
      expect(ok.status, ok.stderr).toBe(0);
      expect(readFileSync(outputs, "utf8")).toContain(`digest=${digest}`);

      writeFileSync(handoff, JSON.stringify({ ...source, artifact_name: "tampered.tar.gz" }));
      const bad = shell(script, env);
      expect(bad.status).not.toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuses incompatible immediate rollback and restores only matching migration trees", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "menuminute-rollback-"));
    try {
      const old = path.join(root, "old");
      const candidate = path.join(root, "candidate");
      const oldMigrations = path.join(old, "src/db/migrations");
      const candidateMigrations = path.join(candidate, "src/db/migrations");
      mkdirSync(oldMigrations, { recursive: true });
      mkdirSync(candidateMigrations, { recursive: true });
      writeFileSync(path.join(oldMigrations, "0001.sql"), "SELECT 1;\n");
      writeFileSync(path.join(candidateMigrations, "0001.sql"), "SELECT 2;\n");
      const calls = path.join(root, "calls");
      writeFileSync(calls, "");

      const migrations = helper.match(/^migration_trees_identical\(\) \{[\s\S]*?^\}/m)?.[0];
      const rollback = helper.match(/^restore_previous\(\) \{[\s\S]*?^\}/m)?.[0];
      expect(migrations).toBeDefined();
      expect(rollback).toBeDefined();
      const script = `set -Eeuo pipefail
${migrations}
switch_link() { printf '%s %s\\n' "$1" "$2" >> "$CALLS"; }
systemctl() { return 0; }
curl() { return 0; }
old_web="$OLD"; old_worker="$OLD"; release="$CANDIDATE"; switched=true
web_link=/tmp/test-web; worker_link=/tmp/test-worker
${rollback}
restore_previous
`;
      const env = { OLD: old, CANDIDATE: candidate, CALLS: calls };
      const incompatible = shell(script, env);
      expect(incompatible.status, incompatible.stderr).toBe(0);
      expect(incompatible.stderr).toContain("Refusing automatic restoration");
      expect(readFileSync(calls, "utf8")).toBe("");

      writeFileSync(path.join(candidateMigrations, "0001.sql"), "SELECT 1;\n");
      const compatible = shell(script, env);
      expect(compatible.status, compatible.stderr).toBe(0);
      expect(readFileSync(calls, "utf8")).toContain(`/tmp/test-web ${old}`);
      expect(readFileSync(calls, "utf8")).toContain(`/tmp/test-worker ${old}`);

      writeFileSync(calls, "");
      rmSync(candidateMigrations, { recursive: true });
      symlinkSync(oldMigrations, candidateMigrations);
      const symlinked = shell(script, env);
      expect(symlinked.status, symlinked.stderr).toBe(0);
      expect(readFileSync(calls, "utf8")).toBe("");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
