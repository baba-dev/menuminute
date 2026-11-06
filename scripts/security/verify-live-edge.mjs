/** Read-only, secret-safe inspection: pipe "nginx -T" into this process. */
import { readFileSync } from "node:fs";

const routeNames = [
  "/api/public-orders",
  "^~ /api/public-menu/",
  "^~ /api/public-media/",
  "~ ^/api/public-orders/[^/]+/stream$",
];
const attestedIP = /\bproxy_set_header\s+X-MenuMinute-Client-IP\s+\$remote_addr\s*;/i;
const attestedKey = /\bproxy_set_header\s+X-MenuMinute-Edge-Key\s+\$menuminute_edge_secret\s*;/i;
const clearedIP = /\bproxy_set_header\s+X-MenuMinute-Client-IP\s+""\s*;/i;
const clearedKey = /\bproxy_set_header\s+X-MenuMinute-Edge-Key\s+""\s*;/i;

function blocks(source, pattern) {
  const output = [];
  for (const match of source.matchAll(pattern)) {
    const start = source.indexOf("{", match.index);
    let depth = 0;
    let quote = "";
    let escaped = false;
    for (let i = start; i < source.length; i++) {
      const c = source[i];
      if (escaped) {
        escaped = false;
      } else if (c === "\\") {
        escaped = true;
      } else if (quote) {
        if (c === quote) quote = "";
      } else if (c === '"' || c === "'") {
        quote = c;
      } else if (c === "{") {
        depth++;
      } else if (c === "}" && --depth === 0) {
        output.push({ name: match[1]?.trim() ?? "", body: source.slice(start + 1, i) });
        break;
      }
    }
  }
  return output;
}

export function verifyNginxPublicEdge(raw) {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 16_000_000) return false;
  const source = raw.replace(/^[ \t]*#.*$/gm, "");
  if (!/\breal_ip_header\s+CF-Connecting-IP\s*;/i.test(source)) return false;
  if (!/\bset_real_ip_from\s+[^;]+;/i.test(source)) return false;
  if (/\bset_real_ip_from\s+(?:0\.0\.0\.0\/0|::\/0|all)\s*;/i.test(source)) return false;
  const servers = blocks(source, /\bserver\s*\{/g);
  const food = servers.find((server) =>
    /\bserver_name\s+[^;]*\bfood\.bababuilds\.com\b[^;]*;/i.test(server.body)
  );
  if (!food) return false;
  const locations = blocks(food.body, /\blocation\s+([^{}\n]+?)\s*\{/g);
  const lookup = (name) => locations.find((item) => item.name === name)?.body;
  if (locations.some((item) => /^\^~\s+\/api\/public-orders(?:\/|$)/.test(item.name))) return false;
  for (const name of routeNames) {
    const body = lookup(name);
    if (!body || !attestedIP.test(body) || !attestedKey.test(body)) return false;
  }
  for (const name of ["/", "^~ /api/auth/"]) {
    const body = lookup(name);
    if (!body || !clearedIP.test(body) || !clearedKey.test(body)) return false;
  }
  const media = lookup("^~ /_menuminute_media_internal/");
  if (!media || !/\binternal\s*;/.test(media)) return false;
  return true;
}

if (process.argv[1]?.endsWith("/verify-live-edge.mjs")) {
  try {
    if (verifyNginxPublicEdge(readFileSync(0, "utf8"))) {
      console.log("PASS: Food proxy attestation and internal-media configuration present.");
      console.log("Validate official Cloudflare CIDRs, host firewall and live requests separately.");
    } else {
      console.error("FAIL: Food proxy configuration needs operator review. No changes made.");
      process.exitCode = 1;
    }
  } catch {
    console.error("FAIL: unable to inspect Food proxy configuration. No changes made.");
    process.exitCode = 1;
  }
}
