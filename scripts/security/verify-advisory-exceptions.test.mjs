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

const picomatch = {
  github_advisory_id: "GHSA-fc5q-39xc-vjpf",
  module_name: "picomatch",
  severity: "high",
  findings: [
    { version: "4.0.7", paths: [".>better-auth>vitest>vite>picomatch", ".>vitest>vite>picomatch"] },
    { version: "2.3.2", paths: [".>eslint-config-next>@next/eslint-plugin-next>picomatch"] },
  ],
};
const during = { now: new Date("2026-11-20T00:00:00Z") };

describe("temporary picomatch high exception (no patched release published)", () => {
  it("accepts only the reviewed advisory, versions and development-tool paths", () => {
    const accepted = verifyAudit(report([esbuild, minimatch, picomatch]), during);
    assert.equal(accepted.length, 4);
    assert.ok(
      accepted.some((entry) => entry.includes("picomatch@4.0.7 (HIGH, expires 2026-12-18)"))
    );
    assert.equal(verifyAudit(report([picomatch]), during).length, 2);
  });
  it("fails closed after the expiry date, forcing a re-review", () => {
    assert.throws(
      () => verifyAudit(report([picomatch]), { now: new Date("2026-12-19T00:00:00Z") }),
      /expired on 2026-12-18/
    );
  });
  it("fails if picomatch appears outside the development-tool dependency paths", () => {
    assert.throws(
      () =>
        verifyAudit(
          report([{ ...picomatch, findings: [{ version: "4.0.7", paths: [".>next>picomatch"] }] }]),
          during
        ),
      /unreviewed version or dependency path/
    );
  });
  it("fails for an unreviewed picomatch version", () => {
    assert.throws(
      () =>
        verifyAudit(
          report([
            { ...picomatch, findings: [{ version: "4.0.6", paths: [".>vitest>vite>picomatch"] }] },
          ]),
          during
        ),
      /unreviewed version or dependency path/
    );
  });
  it("still fails on any other high advisory and on critical findings", () => {
    assert.throws(
      () =>
        verifyAudit(
          report([picomatch, { ...picomatch, github_advisory_id: "GHSA-other" }]),
          during
        ),
      /requires remediation/
    );
    assert.throws(
      () => verifyAudit(report([{ ...picomatch, module_name: "other-package" }]), during),
      /requires remediation/
    );
    const critical = report([picomatch]);
    critical.metadata.vulnerabilities.critical = 1;
    assert.throws(() => verifyAudit(critical, during), /not allowed/);
  });
  it("fails when the reported high total disagrees with the reviewed advisory", () => {
    const extra = report([picomatch]);
    extra.metadata.vulnerabilities.high = 2;
    assert.throws(() => verifyAudit(extra, during), /not allowed/);
  });
});
