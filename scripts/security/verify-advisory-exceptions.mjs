/** CI security gate for known, reviewed transitive advisories.
 * Do not silently add a new exception. A critical advisory is always fatal, and a high advisory is
 * fatal unless it is the single, time-limited, path-scoped exception recorded below.
 * Remove an exception once the corresponding dependency is patched.
 */
import { readFileSync } from "node:fs";

const exceptions = new Map([
  ["GHSA-67mh-4wv8-2f99", { name: "esbuild", version: "0.18.20", ancestor: ">drizzle-kit>" }],
  [
    "GHSA-g3hv-75wg-m249",
    { name: "minimatch", version: "10.2.6", ancestor: ">eslint-config-next>" },
  ],
]);

/** TEMPORARY HIGH exception, reviewed 18 Nov 2026 (docs/security-audit-advisories.md).
 * picomatch <=4.0.7 (GHSA-fc5q-39xc-vjpf, ReDoS) had NO patched release on npm when this was recorded
 * (latest 4.0.7; fix ">=4.0.8" unpublished), so it cannot be upgraded away. Accepted only while ALL hold:
 *  - the date is before `expires` (fail closed afterwards, forcing a re-review);
 *  - every finding is one of the listed versions;
 *  - every path starts at a development-tool root (lint/test/build tooling, never the Next.js runtime).
 * Delete this entry (and the matching --ignore in .github/workflows/ci.yml) once picomatch >=4.0.8 is installed. */
const temporaryHighExceptions = new Map([
  [
    "GHSA-fc5q-39xc-vjpf",
    {
      name: "picomatch",
      versions: ["4.0.7", "2.3.2"],
      roots: [
        ".>eslint-config-next>",
        ".>better-auth>vitest>",
        ".>vitest>",
        ".>@vitest/coverage-v8>",
        ".>@vitejs/plugin-react>",
      ],
      expires: "2026-12-18",
    },
  ],
]);

export function verifyAudit(data, { now = new Date() } = {}) {
  if (!data || typeof data !== "object" || !data.advisories || !data.metadata?.vulnerabilities) {
    throw new Error(
      "Dependency audit output is missing or invalid; refusing to skip security review"
    );
  }
  const accepted = [];
  let acceptedHigh = 0;
  for (const record of Object.values(data.advisories)) {
    if (!record || typeof record !== "object") {
      throw new Error("Malformed advisory");
    }
    const severity = record.severity;
    if (severity === "low" || severity === "info") continue;
    if (severity === "high") {
      const temporary = temporaryHighExceptions.get(record.github_advisory_id);
      if (!temporary || record.module_name !== temporary.name) {
        throw new Error(
          `Dependency security finding requires remediation: ${record.github_advisory_id ?? record.id ?? "unknown"} (${severity})`
        );
      }
      if (now.getTime() > Date.parse(`${temporary.expires}T23:59:59Z`)) {
        throw new Error(
          `Temporary high advisory exception ${record.github_advisory_id} expired on ${temporary.expires}; patch the dependency or re-review it`
        );
      }
      if (!Array.isArray(record.findings) || record.findings.length === 0) {
        throw new Error(`Advisory ${record.github_advisory_id} lacks package findings`);
      }
      for (const finding of record.findings) {
        if (
          !temporary.versions.includes(finding.version) ||
          !Array.isArray(finding.paths) ||
          finding.paths.length === 0 ||
          !finding.paths.every(
            (path) =>
              typeof path === "string" && temporary.roots.some((root) => path.startsWith(root))
          )
        ) {
          throw new Error(
            `Reviewed advisory ${record.github_advisory_id} now affects an unreviewed version or dependency path`
          );
        }
        accepted.push(
          `${record.github_advisory_id}: ${temporary.name}@${finding.version} (HIGH, expires ${temporary.expires})`
        );
      }
      acceptedHigh += 1;
      continue;
    }
    if (severity !== "moderate") {
      throw new Error(
        `Dependency security finding requires remediation: ${record.github_advisory_id ?? record.id ?? "unknown"} (${severity})`
      );
    }
    const allowed = exceptions.get(record.github_advisory_id);
    if (!allowed || record.module_name !== allowed.name) {
      throw new Error(
        `Unreviewed moderate security advisory: ${record.github_advisory_id ?? record.id ?? "unknown"} (${record.module_name ?? "unknown"})`
      );
    }
    if (!Array.isArray(record.findings) || record.findings.length === 0) {
      throw new Error(`Advisory ${record.github_advisory_id} lacks package findings`);
    }
    for (const finding of record.findings) {
      if (
        finding.version !== allowed.version ||
        !Array.isArray(finding.paths) ||
        finding.paths.length === 0 ||
        !finding.paths.every((path) => typeof path === "string" && path.includes(allowed.ancestor))
      ) {
        throw new Error(
          `Reviewed advisory ${record.github_advisory_id} now affects an unreviewed version or dependency path`
        );
      }
    }
    accepted.push(`${record.github_advisory_id}: ${allowed.name}@${allowed.version}`);
  }
  const counts = data.metadata.vulnerabilities;
  if ((counts.critical ?? 0) > 0) {
    throw new Error("High or critical dependency advisories are not allowed");
  }
  if ((counts.high ?? 0) !== acceptedHigh) {
    throw new Error("High or critical dependency advisories are not allowed");
  }
  if (accepted.length - temporaryHighEntries(accepted) !== (counts.moderate ?? 0)) {
    throw new Error("Moderate vulnerability totals disagree with reviewed advisory details");
  }
  return accepted;
}

function temporaryHighEntries(accepted) {
  return accepted.filter((entry) => entry.includes("(HIGH, expires")).length;
}

if (process.argv[1]?.endsWith("/verify-advisory-exceptions.mjs")) {
  const path = process.argv[2];
  if (!path) throw new Error("Pass the JSON output path from pnpm audit");
  const accepted = verifyAudit(JSON.parse(readFileSync(path, "utf8")));
  for (const advisory of accepted) {
    console.warn(`Reviewed dependency risk — NOT patched: ${advisory}`);
  }
  console.log(
    `Dependency advisory review complete; ${accepted.length} reviewed exception(s), no unreviewed moderate or high findings.`
  );
}
