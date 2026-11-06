import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { verifyAudit } from "./verify-advisory-exceptions.mjs";

function report(advisories = []) {
  return {
    advisories: Object.fromEntries(advisories.map((a, index) => [String(index + 1), a])),
    metadata: {
      vulnerabilities: {
        low: 0,
        moderate: advisories.filter((a) => a.severity === "moderate").length,
        high: advisories.filter((a) => a.severity === "high").length,
        critical: 0,
      },
    },
  };
}

const esbuild = {
  github_advisory_id: "GHSA-67mh-4wv8-2f99",
  module_name: "esbuild",
  severity: "moderate",
  findings: [{ version: "0.18.20", paths: [".>drizzle-kit>@esbuild-kit/esm-loader>esbuild"] }],
};
const minimatch = {
  github_advisory_id: "GHSA-g3hv-75wg-m249",
  module_name: "minimatch",
  severity: "moderate",
  findings: [{ version: "10.2.6", paths: [".>eslint-config-next>typescript-eslint>minimatch"] }],
};

describe("dependency advisory review gate", () => {
  it("accepts only the two known, scoped moderate advisory paths", () => {
    assert.equal(verifyAudit(report([esbuild, minimatch])).length, 2);
    assert.deepEqual(verifyAudit(report()), []);
  });
  it("fails on a newly introduced moderate advisory", () => {
    assert.throws(
      () => verifyAudit(report([{ ...minimatch, github_advisory_id: "GHSA-new" }])),
      /Unreviewed moderate/
    );
  });
  it("fails on a new occurrence outside the reviewed development-tool paths", () => {
    assert.throws(
      () =>
        verifyAudit(
          report([
            { ...esbuild, findings: [{ version: "0.18.20", paths: [".>public-runtime>esbuild"] }] },
          ])
        ),
      /unreviewed version or dependency path/
    );
  });
  it("fails on high severity and malformed/incomplete audit output", () => {
    assert.throws(
      () => verifyAudit(report([{ ...esbuild, severity: "high" }])),
      /requires remediation/
    );
    assert.throws(() => verifyAudit({}), /missing or invalid/);
  });
});
