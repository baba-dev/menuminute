import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const sample = readFileSync("infra/nginx/menuminute.conf.example", "utf8");
const config =
  "set_real_ip_from 173.245.48.0/20;\nreal_ip_header CF-Connecting-IP;\n" +
  "server { listen 443 ssl; server_name food.bababuilds.com;\n" +
  sample +
  "\n}";
const audit = (input: string) =>
  spawnSync(process.execPath, ["scripts/security/verify-live-edge.mjs"], {
    input,
    encoding: "utf8",
  });

describe("read-only installed-edge audit", () => {
  it("accepts current signed proxy example without echoing raw configuration", () => {
    const result = audit(config);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("PASS:");
    expect(result.stdout).not.toContain("menuminute_edge_secret");
  });
  it("rejects spoofed client identity and missing header clearing", () => {
    expect(
      audit(
        config.replace(
          "X-MenuMinute-Client-IP $remote_addr;",
          "X-MenuMinute-Client-IP $http_x_forwarded_for;"
        )
      ).status
    ).toBe(1);
    expect(
      audit(config.replace('X-MenuMinute-Edge-Key "";', "X-MenuMinute-Edge-Key $http_edge_secret;"))
        .status
    ).toBe(1);
  });
  it("rejects global real-IP trust and SSE regex precedence regressions", () => {
    expect(audit(config.replace("173.245.48.0/20", "0.0.0.0/0")).status).toBe(1);
    expect(
      audit(config.replace("location /api/public-orders {", "location ^~ /api/public-orders {"))
        .status
    ).toBe(1);
  });
});
