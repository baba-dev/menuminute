#!/usr/bin/env node
// #76: summarize synthetic CI Playwright JSON into a provenance-tagged report.
// Never infer production rollout, compliance, or representative performance.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const SHA = /^[a-f0-9]{40}$/;

export function summarizeBrowserEvidence(report, { sha, runId, lane }) {
  if (!SHA.test(sha)) throw new Error("A reviewed, exact 40-character commit SHA is required");
  if (!/^[1-9][0-9]*$/.test(runId)) throw new Error("A GitHub run ID is required");
  if (!["production-browser", "ember-browser"].includes(lane))
    throw new Error("Unexpected browser evidence lane");
  if (!report || typeof report !== "object" || !Array.isArray(report.suites))
    throw new Error("Playwright JSON suites are missing");
  if (!report.stats || typeof report.stats !== "object")
    throw new Error("Playwright summary statistics are missing");
  const counts = ["expected", "unexpected", "flaky", "skipped"];
  for (const name of counts) {
    if (!Number.isSafeInteger(report.stats[name]) || report.stats[name] < 0)
      throw new Error("Invalid Playwright statistic: " + name);
  }

  const cases = [];
  const scan = (suite) => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        cases.push({
          file: (suite.file || spec.file || "").replaceAll("\\", "/").slice(0, 180),
          title: String(spec.title ?? "").slice(0, 160),
          project: String(test.projectName ?? "").slice(0, 80),
          outcome:
            test.status === "skipped"
              ? "skipped"
              : (test.results ?? []).some((attempt) => attempt.status === "passed")
                ? (test.results ?? []).length > 1
                  ? "flaky"
                  : "passed"
                : "failed",
          attempts: (test.results ?? []).length,
        });
      }
    }
    for (const child of suite.suites ?? []) scan(child);
  };
  for (const suite of report.suites) scan(suite);

  if (cases.length === 0) throw new Error("Empty browser test suite cannot certify a CI lane");
  const recordedTotal = counts.reduce((n, name) => n + report.stats[name], 0);
  if (recordedTotal !== cases.length)
    throw new Error("Playwright totals do not reconcile with recorded cases");
  const passed = cases.filter((c) => c.outcome === "passed").length;
  const flaky = cases.filter((c) => c.outcome === "flaky").length;
  const skipped = cases.filter((c) => c.outcome === "skipped").length;
  const failed = cases.length - passed - flaky - skipped;
  if (
    passed !== report.stats.expected ||
    flaky !== report.stats.flaky ||
    skipped !== report.stats.skipped ||
    failed !== report.stats.unexpected
  )
    throw new Error("Playwright case outcomes disagree with the reporter statistics");

  return {
    schema: "menuminute.phase5.browser-evidence.v1",
    source: { sha, runId, lane, runner: "GitHub Actions isolated ARM64 CI" },
    counts: { passed, flaky, skipped, failed, total: cases.length },
    tests: cases,
    complete: failed === 0,
    limitations: {
      productionValidated: false,
      physicalDevicesValidated: false,
      loadP95Validated: false,
      humanSecurityReview: false,
      independentRestoreValidated: false,
    },
  };
}

async function main(args) {
  if (args.length !== 4) {
    throw new Error(
      "Usage: node scripts/qa/phase5-browser-evidence.mjs <report.json> <output.json> <sha> <lane>"
    );
  }
  const [input, output, sha, lane] = args;
  const report = JSON.parse(await readFile(input, "utf8"));
  const summary = summarizeBrowserEvidence(report, {
    sha,
    lane,
    runId: process.env.GITHUB_RUN_ID || "",
  });
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(summary, null, 2) + "\n", { flag: "w", mode: 0o600 });
  console.log(
    `#76 ${lane}: ${summary.counts.passed} passed, ${summary.counts.flaky} flaky, ${summary.counts.skipped} skipped, ${summary.counts.failed} failed; exact SHA ${sha}`
  );
  if (!summary.complete) process.exitCode = 1;
}

if (process.argv[1]?.endsWith("phase5-browser-evidence.mjs")) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(
      "Phase 5 evidence is invalid:",
      error instanceof Error ? error.message : "unknown"
    );
    process.exitCode = 1;
  });
}
