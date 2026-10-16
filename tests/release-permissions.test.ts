import { execFileSync } from "node:child_process";
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";

const helper = readFileSync(path.resolve("infra/deploy/menuminute-release"), "utf8");

it("normalizes a root-private extraction into a root-owned release readable by runtime users", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "mm-permission-test-"));
  const previousUmask = process.umask(0o027);
  try {
    const release = path.join(dir, "content");
    const nested = path.join(release, ".next", "standalone");
    const privateCache = path.join(dir, "persistent-cache");
    mkdirSync(nested, { recursive: true });
    mkdirSync(privateCache);
    chmodSync(privateCache, 0o700);
    writeFileSync(path.join(nested, "server.js"), "console.log('ok')\n");
    const executable = path.join(nested, "run.sh");
    writeFileSync(executable, "#!/bin/sh\nexit 0\n");
    chmodSync(executable, 0o750);
    symlinkSync(privateCache, path.join(release, "cache"), "dir");

    expect(statSync(release).mode & 0o777).toBe(0o750);
    execFileSync("chmod", ["-R", "u=rwX,go=rX", release]);

    expect(statSync(release).mode & 0o777).toBe(0o755);
    expect(statSync(nested).mode & 0o777).toBe(0o755);
    expect(statSync(path.join(nested, "server.js")).mode & 0o777).toBe(0o644);
    expect(statSync(executable).mode & 0o777).toBe(0o755);
    expect(statSync(privateCache).mode & 0o777).toBe(0o700);
    expect(lstatSync(path.join(release, "cache")).isSymbolicLink()).toBe(true);
  } finally {
    process.umask(previousUmask);
    rmSync(dir, { recursive: true, force: true });
  }
});

it("checks actual service-user access before switching live pointers and resets a failed rollback", () => {
  const normalized = helper.indexOf('chmod -R u=rwX,go=rX "$temp/content"');
  const published = helper.indexOf('mv -T -- "$temp/content" "$release"');
  const preflight = helper.indexOf('runtime_access_ok || {\n  echo "Runtime accounts cannot enter/read');
  const switchIndex = helper.indexOf('switched=true\nswitch_link "$web_link"');
  const rollbackReset = helper.indexOf(
    "systemctl reset-failed menuminute-web.service menuminute-worker.service"
  );
  const rollbackRestart = helper.indexOf(
    "if ! systemctl restart menuminute-web.service menuminute-worker.service"
  );
  expect(normalized).toBeGreaterThan(0);
  expect(published).toBeGreaterThan(normalized);
  expect(preflight).toBeGreaterThan(published);
  expect(switchIndex).toBeGreaterThan(preflight);
  expect(rollbackReset).toBeGreaterThan(0);
  expect(rollbackRestart).toBeGreaterThan(rollbackReset);
});
