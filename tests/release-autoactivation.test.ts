import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(path.resolve(".github/workflows/deploy-vps.yml"), "utf8");
const helper = readFileSync(path.resolve("infra/deploy/menuminute-release"), "utf8");

describe("fail-closed automatic release activation", () => {
  it("requires a versioned root-owned helper and verifies both runtime accounts", () => {
    expect(helper).toContain('if [[ "${1:-}" == --version');
    expect(helper).toContain("echo 2");
    expect(helper).toContain("runuser -u menuminute -- sh -c");
    expect(helper).toContain("runuser -u menuminute-worker -- sh -c");
    expect(helper).toContain("runtime_access_ok ||");
    expect(workflow).toContain("menuminute-release --version");
  });

  it("validates archive members before extraction", () => {
    expect(helper.indexOf("python3 - \"$temp/archive.tar.gz\"")).toBeLessThan(
      helper.indexOf('tar -xzf "$temp/archive.tar.gz"')
    );
    expect(helper).toContain("Unsafe archive member path");
    expect(helper).toContain("Archive link escapes release root");
    expect(helper).toContain("Archive contains special file");
    expect(helper).toContain("Archive writes through symlink parent");
    expect(helper).toContain("Release checksum mismatch");
  });

  it("blocks changed, symlinked or missing migration trees", () => {
    expect(helper).toContain('-d "$old_web/src/db/migrations"');
    expect(helper).toContain('-d "$release/src/db/migrations"');
    expect(helper).toContain('! -L "$old_web/src/db/migrations"');
    expect(helper).toContain('! -L "$release/src/db/migrations"');
    expect(helper).toContain("diff -qr --");
    expect(helper).toContain("STAGED_MANUAL:");
    expect(helper).toContain("exit 20");
    expect(helper).toContain("systemctl is-active --quiet menuminute-web.service");
    expect(helper).toContain("systemctl is-active --quiet menuminute-worker.service");
  });

  it("requires healthy current MenuMinute and ERP before cutting over", () => {
    expect(helper).toContain('http://127.0.0.1:3100/api/health/ready');
    expect(helper).toContain('http://127.0.0.1:3000/');
    expect(helper).toContain('erp_healthy || { echo "ERP preflight failed');
    expect(helper).toContain('erp_healthy || { echo "ERP postflight failed');
    expect(workflow).toContain("Exact main recheck and root-owned cutover");
    expect(workflow).toContain("Superseded during staging");
  });

  it("preserves manual approval and never executes SQL migrations", () => {
    expect(helper).toContain('[[ -f "/etc/menuminute/approved-releases/$sha" ]]');
    expect(helper).toContain('if [[ "$mode" == activate ]]');
    expect(workflow).toContain("mode=activate");
    expect(workflow).toContain("mode=autoactivate");
    expect(workflow).not.toContain("pnpm db:migrate");
  });

  it("restores paired web/worker pointers without database rollback", () => {
    expect(helper).toContain('switch_link "$web_link" "$old_web"');
    expect(helper).toContain('switch_link "$worker_link" "$old_worker"');
    expect(helper).toContain("systemctl reset-failed menuminute-web.service menuminute-worker.service");
    expect(helper).toContain('[[ "$mode" == recover ]]');
    expect(helper).toContain("Schema-incompatible automatic recovery refused");
    expect(helper).toContain('"$rollback_root/$sha"');
    expect(helper).toContain('if [[ "$old_web" == "$release" && "$old_worker" == "$release" ]]');
    expect(helper).not.toContain("DROP DATABASE");
  });
});
