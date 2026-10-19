import { it, expect, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { putObject, getObject } from "../src/modules/media/storage";
it("signs bounded canonical R2 requests and rejects alternate endpoints without any provider network use", async () => {
  const calls: { url: string; options: RequestInit }[] = [];
  vi.stubEnv("MEDIA_STORAGE", "r2");
  vi.stubEnv("R2_ENDPOINT", "https://isolated-account.r2.cloudflarestorage.com/");
  vi.stubEnv("R2_BUCKET_NAME", "private-test-bucket");
  vi.stubEnv("R2_ACCESS_KEY_ID", "isolated-test-access");
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "isolated-test-signing-secret");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: URL, options: RequestInit) => {
      calls.push({ url: url.toString(), options });
      return new Response(options.method === "PUT" ? null : new Uint8Array([1, 2, 3]));
    })
  );
  try {
    await putObject("org-test/asset-test/original", Buffer.from([1, 2, 3]));
    expect(await getObject("org-test/asset-test/original")).toEqual(Buffer.from([1, 2, 3]));
    expect(calls).toHaveLength(2);
    expect(calls[0]!.url).toBe(
      "https://isolated-account.r2.cloudflarestorage.com/private-test-bucket/org-test/asset-test/original"
    );
    expect((calls[0]!.options.headers as Record<string, string>).authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=isolated-test-access\/\d{8}\/auto\/s3\/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=[a-f0-9]{64}$/
    );
    expect(calls[0]!.options.redirect).toBe("error");
    vi.stubEnv("R2_ENDPOINT", "http://127.0.0.1/");
    await expect(getObject("org-test/asset-test/original")).rejects.toThrow("canonical");
    expect(calls).toHaveLength(2);
    await expect(getObject("../secret")).rejects.toThrow("storage key");
  } finally {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  }
});

it("creates shared-group private local files and setgid directories under the production umask", async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "menuminute-media-"));
  const previousUmask = process.umask(0o007);
  vi.stubEnv("MEDIA_STORAGE", "local");
  vi.stubEnv("MEDIA_ROOT", base);
  try {
    // Model the provisioned root: root:menuminute-media 2770 on the ARM64 VPS.
    await fs.chmod(base, 0o2770);
    const original = Buffer.from("private-original");
    const derivative = Buffer.from("private-derivative");
    await putObject("org-test/asset-test/original", original);
    await putObject("org-test/asset-test/display.webp", derivative);
    expect(await getObject("org-test/asset-test/original")).toEqual(original);
    expect(await getObject("org-test/asset-test/display.webp")).toEqual(derivative);

    const org = path.join(base, "org-test");
    const asset = path.join(org, "asset-test");
    for (const folder of [org, asset]) {
      expect((await fs.stat(folder)).mode & 0o7777).toBe(0o2770);
    }
    for (const file of ["original", "display.webp"]) {
      expect((await fs.stat(path.join(asset, file))).mode & 0o777).toBe(0o660);
    }
    expect((await fs.readdir(asset)).sort()).toEqual(["display.webp", "original"]);
  } finally {
    process.umask(previousUmask);
    vi.unstubAllEnvs();
    await fs.rm(base, { recursive: true, force: true });
  }
});
