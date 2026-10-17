import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const deploy = readFileSync(path.resolve(".github/workflows/deploy-vps.yml"), "utf8");
const publisher = readFileSync(path.resolve(".github/workflows/publish-arm64.yml"), "utf8");
const helper = readFileSync(path.resolve("infra/deploy/menuminute-release"), "utf8");

describe("main-only continuous delivery gates", () => {
  it("stages only after the successful main CI release publisher, never after a PR", () => {
    expect(publisher).toContain("workflows: [CI]");
    expect(publisher).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(publisher).toContain("github.event.workflow_run.event == 'push'");
    expect(publisher).toContain("github.event.workflow_run.head_branch == 'main'");
    expect(deploy).toContain('workflows: ["Publish verified ARM64 artifact"]');
    expect(deploy).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(deploy).toContain("github.event.workflow_run.event == 'workflow_run'");
    expect(deploy).toContain("github.event.workflow_run.head_branch == 'main'");
    expect(deploy).toContain(
      "github.event.workflow_run.head_repository.full_name == github.repository"
    );
    expect(deploy).toContain(
      "github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main'"
    );
    expect(deploy).toContain("github.event.workflow_run.head_sha");
  });

  it("autoactivates only the current verified main release and keeps manual approval", () => {
    expect(deploy).toContain("Select latest automatic release");
    expect(deploy).toContain(
      'latest="$(gh api "repos/$GITHUB_REPOSITORY/git/ref/heads/main" --jq \'.object.sha\')"'
    );
    expect(deploy).toContain("Superseded release");
    expect(deploy).toContain(
      "if: steps.current.outputs.deploy == 'true' && (github.event_name == 'workflow_run' || inputs.activate)"
    );
    expect(deploy).toContain("mode=autoactivate");
    expect(deploy).toContain("default: false");
    expect(deploy).toContain("environment: production");
    expect(helper).toContain('[[ -f "/etc/menuminute/approved-releases/$sha" ]]');
    expect(helper).toContain('if [[ "$mode" == autoactivate ]]; then');
    expect(helper).toContain(
      'diff -qr -- "$old_web/src/db/migrations" "$release/src/db/migrations"'
    );
    expect(helper).toContain("runtime_access_ok ||");
    expect(deploy).not.toContain("touch /etc/menuminute/approved-releases");
    expect(deploy).not.toContain("db-migrate.mjs");
  });

  it("checks immutable artifact identity and reuses already-downloaded bytes", () => {
    expect(deploy).toContain('[[ "$target" == "$RELEASE_SHA" ]]');
    expect(deploy).toContain('[[ "$tag_sha" == "$RELEASE_SHA" ]]');
    expect(deploy).toContain('sha256sum -c "menuminute-$short-linux-arm64.tar.gz.sha256"');
    expect(deploy).toContain("Archive already fully downloaded; verifying staged release");
    expect(deploy).toContain('sudo -n /usr/local/sbin/menuminute-release stage "$sha" "$digest"');
  });
});
