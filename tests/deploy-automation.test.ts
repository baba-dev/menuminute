import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ci = readFileSync(path.resolve(".github/workflows/ci.yml"), "utf8");
const deploy = readFileSync(path.resolve(".github/workflows/deploy-vps.yml"), "utf8");
const publisher = readFileSync(path.resolve(".github/workflows/publish-arm64.yml"), "utf8");
const packageScript = readFileSync(path.resolve("infra/deploy/package-release.sh"), "utf8");

describe("provenance-bound main-only production delivery", () => {
  it("parallelizes six mandatory CI lanes and fails closed at the final gate", () => {
    expect(ci).toContain("Required CI quality gate");
    expect(ci).toContain("needs: [quality, typecheck, test, build, ember_browser, security]");
    expect(ci).toContain('test "$result" = success');
    expect(ci).toContain("Ember Enabled Browser (ARM64)");
    expect(ci).toContain("Dependency, Secret & Code Scanning");
    expect(ci).toContain("pnpm audit --audit-level high");
    expect(ci).toContain("github/codeql-action/analyze@");
    expect(ci).toContain("gitleaks/gitleaks-action@");
    expect(ci).not.toContain("needs: [quality, typecheck, test]\n");
    expect(ci).toContain("pnpm install --frozen-lockfile");
  });

  it("keeps optional cache/evidence failures separate from mandatory archive upload", () => {
    expect(ci.match(/uses: actions\/cache@[0-9a-f]{40}/g)).toHaveLength(5);
    expect(ci.match(/continue-on-error: true/g)).toHaveLength(7);
    expect(ci).toContain("name: Cache Playwright Chromium\n        continue-on-error: true");
    expect(ci).toContain("name: browser-failure-evidence");
    expect(ci).toContain("name: ember-browser-failure-evidence");

    const requiredArchive = ci
      .split("      - name: Upload main production archive")[1]!
      .split("      - if: failure()")[0]!;
    expect(requiredArchive).toContain("if: success() && github.event_name == 'push'");
    expect(requiredArchive).toContain("if-no-files-found: error");
    expect(requiredArchive).not.toContain("continue-on-error");
    expect(ci).toContain('test "$result" = success');
  });

  it("packages the exact pre-seed production compilation once", () => {
    expect(ci.indexOf("Compile production artifact before browser fixtures")).toBeLessThan(
      ci.indexOf("pnpm db:seed")
    );
    expect(ci).toContain('bash infra/deploy/package-release.sh "$GITHUB_SHA"');
    expect(packageScript).not.toContain("pnpm build\n");
    expect(packageScript).toContain("pnpm install --prod --frozen-lockfile");
    expect(packageScript).toContain("RELEASE-SHA");
    expect(packageScript).toContain("sha256sum --check --strict");
    expect(publisher).not.toContain("pnpm build");
    expect(publisher).toContain("run-id: ${{ github.event.workflow_run.id }}");
  });

  it("ships a production demo provisioner without development-time TS dependencies", () => {
    const pkg = JSON.parse(readFileSync(path.resolve("package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts["build:release-preflight"]).toContain("esbuild scripts/demo-provision.ts");
    expect(pkg.scripts["build:release-preflight"]).toContain(
      "--outfile=dist/demo-provision.mjs"
    );
    expect(packageScript).toContain("test -s dist/demo-provision.mjs");
    expect(packageScript).toContain("node --check dist/demo-provision.mjs");
    expect(packageScript).toContain('cp -a dist/. "$stage/dist/"');
    expect(packageScript).toContain("pnpm install --prod --frozen-lockfile");
  });

  it("rejects PR/failed CI for publication and binds the source run", () => {
    expect(publisher).toContain("workflows: [CI]");
    expect(publisher).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(publisher).toContain("github.event.workflow_run.event == 'push'");
    expect(publisher).toContain("github.event.workflow_run.head_branch == 'main'");
    expect(publisher).toContain("Required CI quality gate");
    expect(publisher).toContain("published-source.json");
    expect(publisher).toContain("source_ci_run_id");
    expect(publisher).not.toContain("workflow_dispatch:");
  });

  it("does not trust the publisher's workflow_run.head_sha as the source SHA", () => {
    expect(deploy).toContain("published-source.json");
    expect(deploy).toContain('sha="$(jq -r .source_sha published-source.json)"');
    expect(deploy).not.toContain("github.event.workflow_run.head_sha");
    expect(deploy).toContain(".head_repository.full_name == $repo");
    expect(deploy).toContain("Required CI quality gate");
    expect(deploy).toContain("source_ci_run_id");
  });

  it("staging cannot be reported as an activated production deployment", () => {
    expect(deploy).toContain("name: production-staging");
    expect(deploy).toContain("name: production");
    expect(deploy).toContain("url: https://food.bababuilds.com");
    expect(deploy).not.toContain("Staged — manual migration review and approval required.");
    expect(deploy).toContain("Confirm unattended activation eligibility");
    expect(deploy).toContain("Validated and staged; proceeding to automatic activation.");
    expect(deploy).toContain("Not eligible for activation; check stage and migration logs.");
    expect(deploy).not.toContain("AUTH_V2_CUTOVER_APPROVED");
    expect(deploy).not.toContain("inputs.activate");
    expect(deploy).toContain("policy=eligibility");
    expect(deploy).toContain("$policy $RELEASE_SHA $DEPLOY_DIGEST");
    expect(deploy).toContain("needs.stage.outputs.eligible == 'true'");
    expect(deploy).toContain("Public HTTPS, dependency and route verification");
    expect(deploy).toContain("Push-to-verified-public elapsed");
  });

  it("reads the publisher handoff from the workspace after moving to RUNNER_TEMP", () => {
    const verify = deploy
      .split("      - name: Verify immutable main release identity")[1]!
      .split("      - name: Configure pinned SSH host identity")[0]!;
    expect(verify).toContain('cd "$RUNNER_TEMP"');
    expect(verify).toContain('handoff="$GITHUB_WORKSPACE/published-source.json"');
    expect(verify).toContain('test -s "$handoff"');
    expect(verify).toContain('jq -r .artifact_sha256 "$handoff"');
    expect(verify).toContain('jq -r .artifact_name "$handoff"');
    expect(verify).toContain('jq -r .artifact_bytes "$handoff"');
    expect(verify).not.toContain("jq -r .artifact_sha256 published-source.json");
  });

  it("marks a superseded production attempt as failed rather than successfully deployed", () => {
    const cutover = deploy
      .split("      - name: Exact main recheck and root-owned cutover")[1]!
      .split("      - name: Public HTTPS, dependency and route verification")[0]!;
    expect(cutover).toContain("Superseded immediately before production activation");
    expect(cutover).toMatch(
      /echo "superseded=true" >> "\$GITHUB_OUTPUT"\s+# A production job must not be marked successful when nothing was deployed\.\s+exit 1/
    );
  });

  it("keeps pinned SSH and only calls the root-owned allowlisted helper", () => {
    expect(deploy).toContain("StrictHostKeyChecking=yes");
    expect(deploy).toContain("VPS_SSH_KNOWN_HOSTS");
    expect(deploy).toContain("/usr/local/sbin/menuminute-release --version");
    expect(deploy).toContain("sudo -n /usr/local/sbin/menuminute-release stage");
    expect(deploy).not.toContain("touch /etc/menuminute/approved-releases");
    expect(deploy).not.toContain("db-migrate.mjs");
  });
});
