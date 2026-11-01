# Security hardening A–F

No new finance activation or billing behavior is part of this change.

## Deployment verification

1. Apply forward-only migrations 0074 and 0075 before rolling out the web build.
2. Review actual web/worker roles and live PostgreSQL privileges.
3. Compare the _live_ vhost with infra/nginx/menuminute.conf.example; **do not** replace the entire file or disrupt ERP/Cloudflare settings.
4. Preserve the root-only /etc/menuminute/nginx-order-edge-secret.conf; overwrite both private identity headers.
5. Ensure /api/public-orders and /api/public-menu/ and /api/public-media/ are proxy-attested, and upload routes accept up to 5 MiB.
6. Run nginx -t before reload. Smoke test auth, demo, QR, public ordering, POS, KDS, billing webhook, import, admin and Concierge.
7. Review exact NVIDIA rate card and set Concierge spend prices/caps as approved.
8. Run `node scripts/security/rls-audit.mjs` using a restricted read-only DB account.

## RLS

Many SECURITY DEFINER functions use explicitly granted owner policies. Do not blanket FORCE RLS.
For each unforced table inspect the active definer/worker role and verified isolation tests
before proposing a narrowly scoped migration. This report is a read-only inventory.

## Release gate

Required CI lanes, concurrent throttle tests and cross-tenant negative tests must pass.
Do not merge on an unverified rollout. Removing generated tracked files does not rewrite
Git history; review historical blobs before deciding whether any secret needs rotation.

## Security contract CI

The quality lane runs `node scripts/security/verify-api-boundaries.mjs` to prevent unbounded route body parsing or loss of guest-order proxy attestation. This is supplementary to runtime and integration tests; it does not replace browser validation or production Nginx review.
