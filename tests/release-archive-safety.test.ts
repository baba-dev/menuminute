import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterAll, describe, expect, it } from "vitest";

const helper = readFileSync(path.resolve("infra/deploy/menuminute-release"), "utf8");
const validator = helper.split("<<'ARCHIVE'\n")[1]?.split("\nARCHIVE")[0];
const workspace = mkdtempSync(path.join(os.tmpdir(), "menuminute-archive-test-"));
afterAll(() => rmSync(workspace, { recursive: true, force: true }));

const createArchive = `
import io, sys, tarfile
out, scenario = sys.argv[1:3]
def item(archive, name, kind="file", link=""):
    info = tarfile.TarInfo(name)
    info.mode = 0o644
    if kind == "file":
        body = b"safe"
        info.size = len(body)
        archive.addfile(info, io.BytesIO(body))
    else:
        info.type = {"symlink":tarfile.SYMTYPE, "fifo":tarfile.FIFOTYPE, "hardlink":tarfile.LNKTYPE}[kind]
        info.linkname = link
        archive.addfile(info)
with tarfile.open(out, "w:gz") as archive:
    item(archive, "./RELEASE-SHA")
    if scenario == "safe":
        item(archive, "./node_modules/example", "symlink", ".pnpm/example")
    if scenario == "traversal":
        item(archive, "../etc/unsafe")
    if scenario == "absolute":
        item(archive, "/etc/unsafe")
    if scenario == "absolute-link":
        item(archive, "./outside", "symlink", "/etc/passwd")
    if scenario == "escaping-link":
        item(archive, "./outside", "symlink", "../../etc/passwd")
    if scenario == "symlink-parent":
        item(archive, "./directory", "symlink", "safe")
        item(archive, "./directory/file")
    if scenario == "duplicate":
        item(archive, "./RELEASE-SHA")
    if scenario == "special":
        item(archive, "./special", "fifo")
    if scenario == "hardlink":
        item(archive, "./link", "hardlink", "./missing")
`;

function checkArchive(scenario: string) {
  const archive = path.join(workspace, `${scenario}.tar.gz`);
  const generated = spawnSync("python3", ["-c", createArchive, archive, scenario], {
    encoding: "utf8",
  });
  expect(generated.status, generated.stderr).toBe(0);
  return spawnSync("python3", ["-c", validator ?? "", archive], { encoding: "utf8" });
}

describe("production release archive extraction safety", () => {
  it("extracts validator logic from the installed-helper source", () => {
    expect(validator).toBeTruthy();
    expect(helper.indexOf("<<'ARCHIVE'")).toBeLessThan(
      helper.indexOf('tar -xzf "$temp/archive.tar.gz"')
    );
  });

  it("permits normal archive entries and contained native dependency links", () => {
    const result = checkArchive("safe");
    expect(result.status, result.stderr).toBe(0);
  });

  it.each([
    "traversal",
    "absolute",
    "absolute-link",
    "escaping-link",
    "symlink-parent",
    "duplicate",
    "special",
    "hardlink",
  ])("rejects unsafe %s archive before extraction", (scenario) => {
    const result = checkArchive(scenario);
    expect(result.status, result.stderr).not.toBe(0);
  });
});
