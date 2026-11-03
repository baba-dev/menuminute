import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("A–F security regression contracts", () => {
  it("rejects the shared demo principal at the database provisioning boundary", () => {
    const sql = readFileSync("src/db/migrations/0075_demo_provisioning_boundary.sql", "utf8");
    expect(sql).toContain("IF actor = 'demo-owner' AND session_user = 'menuminute_app'");
    expect(sql).toContain("ERRCODE = '42501'");
  });
  it("preserves signed edge guest orders and 5 MiB media upload support", () => {
    const nginx = readFileSync("infra/nginx/menuminute.conf.example", "utf8");
    expect(nginx).toContain("location /api/public-orders {");
    expect(nginx).not.toContain("location ^~ /api/public-orders");
    expect(nginx).toContain("location ~ ^/api/public-orders/[^/]+/stream$ {");
    expect(nginx).toContain("location ~ ^/api/organizations/[^/]+/outlets/[^/]+/kitchen/stream$ {");
    expect(nginx.match(/proxy_buffering off;/g)?.length).toBe(2);
    expect(nginx).toContain("X-MenuMinute-Edge-Key $menuminute_edge_secret;");
    expect(nginx).toContain("location = /api/media {");
    expect(nginx).toContain("location ^~ /api/media/ {");
    expect(nginx).toContain("client_max_body_size 6m;");
  });
  it("admits public SSR menus before metadata and page database lookups", () => {
    const source = readFileSync("src/app/(public-menu)/m/[publicMenuId]/page.tsx", "utf8");
    expect(source.match(/admitPublicMenuRender\(\)/g)?.length).toBe(2);
  });
  it("overwrites trusted authentication IP in the isolated TLS proxy", () => {
    const proxy = readFileSync("scripts/browser-server.mjs", "utf8");
    expect(proxy).toContain('"x-real-ip": forwardedIp');
    expect(proxy).toContain('"x-menuminute-client-ip": forwardedIp');
  });
  it("preserves a single-use step-up proof for administrative writes", () => {
    const sql = readFileSync("src/db/migrations/0015_superadmin_control.sql", "utf8");
    expect(sql).toContain("app_private.require_step_up()");
    const service = readFileSync("src/lib/step-up.ts", "utf8");
    expect(service).toContain("auth_totp_consumed");
  });
});
