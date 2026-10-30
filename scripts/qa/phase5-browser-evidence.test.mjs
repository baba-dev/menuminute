import test from "node:test";
import assert from "node:assert/strict";
import { summarizeBrowserEvidence } from "./phase5-browser-evidence.mjs";

const provenance = {
  sha: "a".repeat(40),
  runId: "41118108623",
  lane: "production-browser",
};
const report = {
  stats: { expected: 2, unexpected: 0, flaky: 1, skipped: 1 },
  suites: [
    {
      file: "tests/e2e/kitchen-pro.spec.ts",
      specs: [
        {
          title: "no premature Ready",
          tests: [
            { projectName: "chromium", status: "expected", results: [{ status: "passed" }] },
            {
              projectName: "Mobile Chrome",
              status: "flaky",
              results: [{ status: "failed" }, { status: "passed" }],
            },
          ],
        },
        {
          title: "revoked",
          tests: [{ projectName: "chromium", status: "expected", results: [{ status: "passed" }] }],
        },
        {
          title: "not available",
          tests: [{ projectName: "Mobile Chrome", status: "skipped", results: [] }],
        },
      ],
    },
  ],
};

test("records exact SHA and separates retries, skips, and production-only gates", () => {
  const r = summarizeBrowserEvidence(report, provenance);
  assert.equal(r.complete, true);
  assert.deepEqual(r.counts, { passed: 2, flaky: 1, skipped: 1, failed: 0, total: 4 });
  assert.equal(r.source.sha, provenance.sha);
  assert.equal(r.tests[1].attempts, 2);
  assert.equal(r.limitations.physicalDevicesValidated, false);
  assert.equal(r.limitations.humanSecurityReview, false);
  assert.equal(r.limitations.independentRestoreValidated, false);
});

test("fails closed for a missing test, foreign lane, bad source or inconsistent totals", () => {
  assert.throws(() => summarizeBrowserEvidence({}, provenance), /suites/);
  assert.throws(() => summarizeBrowserEvidence({ ...report, suites: [] }, provenance), /Empty/);
  assert.throws(
    () => summarizeBrowserEvidence(report, { ...provenance, sha: "main" }),
    /commit SHA/
  );
  assert.throws(
    () => summarizeBrowserEvidence(report, { ...provenance, lane: "production" }),
    /lane/
  );
  assert.throws(
    () =>
      summarizeBrowserEvidence(
        {
          ...report,
          stats: { ...report.stats, expected: 3 },
        },
        provenance
      ),
    /totals/
  );
  assert.throws(
    () =>
      summarizeBrowserEvidence(
        {
          ...report,
          stats: { ...report.stats, unexpected: -1 },
        },
        provenance
      ),
    /statistic/
  );
});

test("marks unexpected browser failures as incomplete rather than green", () => {
  const failing = structuredClone(report);
  failing.suites[0].specs[0].tests[0].results[0].status = "failed";
  failing.stats.expected = 1;
  failing.stats.unexpected = 1;
  const result = summarizeBrowserEvidence(failing, provenance);
  assert.equal(result.complete, false);
  assert.equal(result.counts.failed, 1);
});
