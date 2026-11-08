import { describe, expect, it } from "vitest";
import {
  assertDemoModeParity,
  demoEnabledInEnvironmentFile,
} from "../src/modules/demo/env-parity";

describe("public demo web/worker release gate", () => {
  it("defaults to disabled and tolerates other credentials without printing or parsing them", () => {
    expect(
      assertDemoModeParity(
        "DATABASE_URL=secret\nAUTH_SECRET=secret\n",
        "WORKER_DATABASE_URL=another-secret\n"
      )
    ).toBe(false);
  });
  it("requires the restricted worker to be explicitly enabled alongside the demo web", () => {
    expect(
      assertDemoModeParity("DEMO_MODE_ENABLED=true\n", "DEMO_MODE_ENABLED=true\n")
    ).toBe(true);
    expect(() => assertDemoModeParity("DEMO_MODE_ENABLED=true\n", "")).toThrow(
      /DEMO_MODE_ENABLED/
    );
    expect(() => assertDemoModeParity("", "DEMO_MODE_ENABLED=true\n")).toThrow(
      /DEMO_MODE_ENABLED/
    );
  });
  it("supports quoted values and comments while rejecting duplicates and invalid tokens", () => {
    expect(demoEnabledInEnvironmentFile("# demo\nDEMO_MODE_ENABLED='true'\n")).toBe(true);
    expect(demoEnabledInEnvironmentFile('DEMO_MODE_ENABLED="false"')).toBe(false);
    expect(() => demoEnabledInEnvironmentFile("DEMO_MODE_ENABLED=true\nDEMO_MODE_ENABLED=false")).toThrow();
    expect(() => demoEnabledInEnvironmentFile("DEMO_MODE_ENABLED=maybe")).toThrow();
  });
});
