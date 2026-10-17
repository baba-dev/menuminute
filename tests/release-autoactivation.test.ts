import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(path.resolve(".github/workflows/deploy-vps.yml"), "utf8");
const helper = readFileSync(path.resolve("infra/deploy/menuminute-release"), "utf8");

describe("fail-closed automatic release activation", () => {
  it("requires an unchanged, non-symlink migration tree and a ready current release", () => {
    expect(helper).toContain('-d "$old_web/src/db/migrations"');
    expect(helper).toContain('-d "$release/src/db/migrations"');
    expect(helper).toContain('! -L "$old_web/src/db/migrations"');
    expect(helper).toContain('! -L "$release/src/db/migrations"');
    expect(helper).toContain("diff -qr --");
    expect(helper).toContain("systemctl is-active --quiet menuminute-web.service");
    expect(helper).toContain("systemctl is-active --quiet menuminute-worker.service");
    expect(helper).toContain("http://127.0.0.1:3100/api/health/ready");
  });

  it("rechecks main after staging and preserves the manual activation mode", () => {
    const activation = workflow.slice(workflow.indexOf("- name: Activate verified release"));
    expect(activation).toContain("Recheck after download/staging");
    expect(activation).toContain("mode=autoactivate");
    expect(activation).toContain("mode=activate");
    expect(activation).toContain("leaving live release unchanged");
    expect(workflow).toContain("workflow_dispatch");
    expect(workflow).toContain("inputs.activate");
  });
});
