import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const esc = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

function dump(...nodes: Array<{ text?: string; desc?: string; bounds?: string; id?: string }>) {
  const body = nodes
    .map(
      (n) =>
        `<node text="${esc(n.text ?? "")}" content-desc="${esc(n.desc ?? "")}" resource-id="${n.id ?? ""}" bounds="${n.bounds ?? "[0,0][10,10]"}"/>`
    )
    .join("");
  return `<?xml version='1.0'?><hierarchy>${body}</hierarchy>`;
}

function classify(xml: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), "ui-"));
  const file = path.join(dir, "ui.xml");
  writeFileSync(file, xml);
  return execFileSync("python3", ["-I", path.resolve("scripts/android/classify-ui.py"), file], {
    encoding: "utf8",
  }).trim();
}

describe("Android launch destination classifier", () => {
  it("accepts the real login page", () => {
    expect(classify(dump({ text: "SIGN IN / WELCOME BACK" }, { text: "Your password" }))).toMatch(
      /^good:/
    );
  });

  it("never mistakes Chrome's first-run screen for the login page (false pass seen in CI)", () => {
    // Captured from the real emulator run: Chrome's own "Sign in to browse easier" screen.
    const firstRun = dump(
      { text: "Welcome to Chrome", id: "com.android.chrome:id/title" },
      { text: "Sign in to browse easier across devices", id: "com.android.chrome:id/subtitle" },
      { text: "Add account to device", id: "com.android.chrome:id/signin_fre_continue_button" },
      {
        text: "Use without an account",
        id: "com.android.chrome:id/signin_fre_dismiss_button",
        bounds: "[100,2000][500,2100]",
      }
    );
    expect(classify(firstRun)).toBe("tap 300 2050");
    // A generic "sign in" string alone is not evidence of the MenuMinute login page.
    expect(classify(dump({ text: "Sign in" }))).toMatch(/^unknown:/);
  });

  it("rejects the exact failure from 2026-11-10 and Chrome error pages", () => {
    expect(classify(dump({ text: "localhost:3100" }, { text: "SIGN IN / WELCOME BACK" }))).toMatch(
      /^bad:/
    );
    expect(classify(dump({ text: "This site can’t be reached" }))).toMatch(/^bad:/);
    expect(classify(dump({ text: "ERR_CONNECTION_REFUSED" }))).toMatch(/^bad:/);
  });

  it("taps through Chrome first-run prompts and otherwise stays undecided", () => {
    expect(classify(dump({ text: "Accept & continue", bounds: "[100,200][300,400]" }))).toBe(
      "tap 200 300"
    );
    expect(classify(dump({ text: "Loading" }))).toMatch(/^unknown:/);
    expect(classify("not xml")).toMatch(/^unknown:/);
  });
});
