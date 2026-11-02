import { describe, expect, it } from "vitest";
import { importEngineDiagnostic } from "../src/modules/menu-import/nvidia";

describe("AI menu import feature gate explanations", () => {
  it("shows operator-readable reasons without leaking model or key details", () => {
    expect(importEngineDiagnostic({})).toEqual({
      enabled: false,
      reason: "rollout_disabled",
    });
    expect(importEngineDiagnostic({ MENU_IMPORT_NVIDIA_ENABLED: "true" })).toEqual({
      enabled: false,
      reason: "provider_approval_required",
    });
    expect(importEngineDiagnostic({
      MENU_IMPORT_NVIDIA_ENABLED: "true",
      NVIDIA_IMPORT_COMMERCIAL_APPROVED: "true",
    })).toEqual({ enabled: false, reason: "model_unconfigured" });
  });
  it("never claims the independently configured worker has been verified", () => {
    const result = importEngineDiagnostic({
      MENU_IMPORT_NVIDIA_ENABLED: "true",
      NVIDIA_IMPORT_COMMERCIAL_APPROVED: "true",
      NVIDIA_IMPORT_MODEL: "example/vision",
      NVIDIA_API_KEY: "never-return-this-value",
    });
    expect(result).toEqual({ enabled: true, reason: "worker_not_verified" });
    expect(JSON.stringify(result)).not.toContain("never-return-this-value");
  });
});
