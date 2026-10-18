import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(path.resolve(".github/workflows/deploy-vps.yml"), "utf8");
const helper = readFileSync(path.resolve("infra/deploy/menuminute-release"), "utf8");

describe("fail-closed automatic release activation", () => {
  it("requires a versioned root-owned helper and verifies both runtime accounts", () => {
    expect(helper).toContain('if [[ "${1:-}" == --version');
    expect(helper).toContain("echo 4");
    expect(helper).toContain("runuser -u menuminute -- sh -c");
    expect(helper).toContain("runuser -u menuminute-worker -- sh -c");
    expect(helper).toContain("runtime_access_ok ||");
    expect(workflow).toContain("menuminute-release --version");
    expect(workflow).toContain("= 4 && sudo -n /usr/local/sbin/menuminute-release $mode");
  });

  it("validates archive members before extraction", () => {
    expect(helper.indexOf('python3 - "$temp/archive.tar.gz"')).toBeLessThan(
      helper.indexOf('tar -xzf "$temp/archive.tar.gz"')
    );
    expect(helper).toContain("Unsafe archive member path");
    expect(helper).toContain("Archive link escapes release root");
    expect(helper).toContain("Archive contains special file");
    expect(helper).toContain("Archive writes through symlink parent");
    expect(helper).toContain("Release checksum mismatch");
  });

  it("allows only append-only SQL migration histories and rejects missing or linked trees", () => {
    expect(helper).toContain('-d "$old_web/src/db/migrations"');
    expect(helper).toContain('! -L "$old_web/src/db/migrations"');
    expect(helper).toContain('"$release/src/db/migrations"');
    expect(helper).toContain("root.is_symlink()");
    expect(helper).toContain("candidate[:len(previous)] != previous");
    expect(helper).toContain("path.read_bytes() != other.read_bytes()");
    expect(helper).toContain('raise SystemExit("Missing regular SQL migration: " + name)');
    expect(helper).toContain("systemctl is-active --quiet menuminute-web.service");
    expect(helper).toContain("systemctl is-active --quiet menuminute-worker.service");
    expect(helper).not.toContain("STAGED_MANUAL:");
    expect(helper).not.toContain("exit 20");
  });

  it("requires healthy current MenuMinute and ERP before cutting over", () => {
    expect(helper).toContain("http://127.0.0.1:3100/api/health/ready");
    expect(helper).toContain("http://127.0.0.1:3000/");
    expect(helper).toContain('erp_healthy || { echo "ERP preflight failed');
    expect(helper).toContain('erp_healthy || { echo "ERP postflight failed');
    expect(workflow).toContain("Exact main recheck and root-owned cutover");
    expect(workflow).toContain("Superseded during staging");
  });

  it("backs up remotely before automatic staged SQL and needs no per-SHA operator marker", () => {
    expect(helper).not.toContain('[[ -f "/etc/menuminute/approved-releases/$sha" ]]');
    expect(helper).toContain("mode=autoactivate");
    expect(helper).toContain("owner_env=/etc/menuminute/migration.env");
    expect(helper).toContain("backup_tool=/usr/local/sbin/menuminute-restic");
    expect(helper).toContain('pg_restore -l "$backup_dir/database.dump"');
    expect(helper).toContain('"$backup_tool" backup --tag "$tag" "$backup_dir" "$data/media"');
    expect(helper).toContain("OFF_HOST_PREDEPLOY_BACKUP_VERIFIED");
    expect(helper.indexOf("OFF_HOST_PREDEPLOY_BACKUP_VERIFIED")).toBeLessThan(
      helper.indexOf('(cd "$release" && "$node24" dist/db-migrate.mjs)')
    );
    expect(helper).toContain(
      'if [[ "$mode" == autoactivate && "$migration_change" == unchanged ]]'
    );
    expect(workflow).toContain("mode=autoactivate");
    expect(workflow).not.toContain("mode=activate");
    expect(workflow).not.toContain("manual_required=true");
  });

  it("restores paired web/worker pointers without database rollback", () => {
    expect(helper).toContain('switch_link "$web_link" "$old_web"');
    expect(helper).toContain('switch_link "$worker_link" "$old_worker"');
    expect(helper).toContain(
      "systemctl reset-failed menuminute-web.service menuminute-worker.service"
    );
    expect(helper).toContain('[[ "$mode" == recover ]]');
    expect(helper).toContain("Schema-incompatible automatic recovery refused");
    const trap = helper.split("restore_previous() {")[1]!.split("trap restore_previous ERR")[0]!;
    expect(trap).toContain('if ! migration_trees_identical "$old_web" "$release"; then');
    expect(trap.indexOf('if ! migration_trees_identical "$old_web" "$release"; then')).toBeLessThan(
      trap.indexOf('switch_link "$web_link" "$old_web"')
    );
    expect(trap).toContain(
      "Refusing automatic restoration to a potentially schema-incompatible previous release"
    );
    expect(helper).toContain('"$rollback_root/$sha"');
    expect(helper).toContain('if [[ "$old_web" == "$release" && "$old_worker" == "$release" ]]');
    expect(helper).not.toContain("DROP DATABASE");
  });
});
