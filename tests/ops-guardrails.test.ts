import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("offline operations evidence tools", () => {
  it("enforces disposable restore, backup watchdog and ERP measurement guardrails", () => {
    // Repository CI already ships python3 for migration-policy checks.
    // This exercises pure fixtures only: no database, SSH, backup, HTTP or service calls.
    const result = spawnSync(
      "python3",
      ["-m", "unittest", "discover", "-s", "tests/deploy", "-p", "test_ops_guardrails.py", "-v"],
      { encoding: "utf8", timeout: 30_000, maxBuffer: 512 * 1024 }
    );
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
  });
});
