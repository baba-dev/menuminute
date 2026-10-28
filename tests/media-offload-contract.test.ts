import { expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { isPublicDerivativeKey } from "../src/modules/media/product-service";
import { parseMediaEnv } from "../src/lib/config/media-env";

it("accepts only bounded organization-scoped derivative storage keys", () => {
  expect(isPublicDerivativeKey("org-one/asset-one/display.webp")).toBe(true);
  expect(isPublicDerivativeKey("org-one/asset-one/thumb.webp")).toBe(true);
  for (const key of [
    "org-one/asset-one/original",
    "org-one/asset-one/display.png",
    "../asset/display.webp",
    "org//display.webp",
    "org/asset/../../secret",
    "org/asset/secret.webp",
    "/org/asset/display.webp",
  ]) {
    expect(isPublicDerivativeKey(key)).toBe(false);
  }
});

it("keeps internal media offload opt-in and refuses R2 offload", () => {
  const local = parseMediaEnv({
    MEDIA_STORAGE: "local",
    MEDIA_ROOT: "/var/lib/menuminute/media",
  });
  expect(local.MEDIA_X_ACCEL_REDIRECT_ENABLED).toBe(false);
  expect(
    parseMediaEnv({
      MEDIA_STORAGE: "local",
      MEDIA_ROOT: "/var/lib/menuminute/media",
      MEDIA_X_ACCEL_REDIRECT_ENABLED: "true",
    }).MEDIA_X_ACCEL_REDIRECT_ENABLED
  ).toBe(true);
  expect(() =>
    parseMediaEnv({
      MEDIA_STORAGE: "r2",
      MEDIA_X_ACCEL_REDIRECT_ENABLED: "true",
      R2_ENDPOINT: "https://account.r2.cloudflarestorage.com/",
      R2_ACCESS_KEY_ID: "test",
      R2_SECRET_ACCESS_KEY: "test",
    })
  ).toThrow("MEDIA_X_ACCEL_REDIRECT_ENABLED");
});

it("keeps Nginx byte locations internal and the public route behind the API", async () => {
  const nginx = await readFile("infra/nginx/menuminute.conf.example", "utf8");
  expect(nginx).toMatch(/location \^~ \/_menuminute_media_internal\/ \{\s*internal;/);
  expect(nginx).toMatch(/location \^~ \/api\/public-media\/ \{/);
  expect(nginx).not.toContain("stale-while-revalidate");
  expect(nginx).not.toContain("try_files");
});
