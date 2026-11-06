/** CI security gate for known, reviewed MODERATE transitive advisories.
 * Do not silently add a new exception. A high/critical advisory is always fatal.
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

export function verifyAudit(data) {
  if (!data || typeof data !== "object" || !data.advisories || !data.metadata?.vulnerabilities) {
    throw new Error(
      "Dependency audit output is missing or invalid; refusing to skip security review"
    );
  }
  const accepted = [];
  for (const record of Object.values(data.advisories)) {
    if (!record || typeof record !== "object") {
      throw new Error("Malformed advisory");
    }
    const severity = record.severity;
    if (severity === "low" || severity === "info") continue;
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
  if ((counts.high ?? 0) > 0 || (counts.critical ?? 0) > 0) {
    throw new Error("High or critical dependency advisories are not allowed");
  }
  if (accepted.length !== (counts.moderate ?? 0)) {
    throw new Error("Moderate vulnerability totals disagree with reviewed advisory details");
  }
  return accepted;
}

if (process.argv[1]?.endsWith("/verify-advisory-exceptions.mjs")) {
  const path = process.argv[2];
  if (!path) throw new Error("Pass the JSON output path from pnpm audit");
  const accepted = verifyAudit(JSON.parse(readFileSync(path, "utf8")));
  for (const advisory of accepted) {
    console.warn(`Reviewed moderate dependency risk — NOT patched: ${advisory}`);
  }
  console.log(
    `Dependency advisory review complete; ${accepted.length} known moderate exception(s), no unreviewed moderate or high findings.`
  );
}
