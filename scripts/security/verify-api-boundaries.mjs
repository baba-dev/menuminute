/** Fast, source-level guard against accidentally reintroducing unbounded body reads.
 * The Better Auth framework POST handler is intentionally exempt: preflight limits
 * and native MFA throttling are implemented in src/lib/auth-abuse.ts.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

async function walk(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const p = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...await walk(p));
    else if (entry.name === "route.ts") files.push(p);
  }
  return files;
}
const violations = [];
for (const p of await walk("src/app/api")) {
  if (p.includes("/auth/[...all]/")) continue;
  const source = await readFile(p, "utf8");
  if (/\bawait\s+(?:req|request)\.(?:json|text|arrayBuffer|formData)\s*\(/.test(source)) {
    violations.push(p);
  }
}
const nginx = await readFile("infra/nginx/menuminute.conf.example", "utf8");
if (!nginx.includes("location ^~ /api/public-orders {") ||
    !nginx.includes("X-MenuMinute-Edge-Key $menuminute_edge_secret;")) {
  violations.push("nginx: guest-order edge attestation");
}
if (violations.length) {
  process.stderr.write("Unbounded or unattested public API path(s):\n" + violations.join("\n") + "\n");
  process.exitCode = 1;
} else {
  process.stdout.write("Security route boundary checks passed.\n");
}
