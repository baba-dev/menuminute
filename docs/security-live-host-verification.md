# Read-only production edge security verification

For owner-operated MenuMinute hosts only. This check requires no service restarts, no application writes, and no public traffic generation. Run from the exact reviewed source revision.

- Isolated runtime: run sudo /opt/menuminute/node24/bin/node -v and ensure a vetted Node.js 24 security release at least 24.22.1. Do not change the ERP's system Node or PM2 process.
- Installed Nginx syntax: run sudo nginx -t. Never replace the whole live vhost with a repository example.
- Installed Nginx trust: in Bash, run the following pipeline. It reads the **full live Nginx configuration** privately in memory and emits only PASS/FAIL. Never paste nginx -T output, save it to a log, or enable shell tracing; a private include may contain the edge key.

    set -o pipefail
    sudo nginx -T 2>/dev/null | node scripts/security/verify-live-edge.mjs

- Independently verify Cloudflare Full (strict), the complete current official Cloudflare source CIDRs, and port 3100 being bound only to loopback. The script checks several dangerous proxy patterns but cannot prove firewall enforcement or the correctness of every CIDR.
- Verify that both web and worker active symlinks point to one reviewed SHA, existing ERP HTTP 200 remains, and a fresh off-host backup plus isolated restore have been verified before migrations.
- A PASS is only source/configuration evidence, not a live penetration test. Continue authenticated cross-tenant, SSE session-revocation, media and payment-webhook negative tests on an isolated environment.

Never run brute-force or load tests against customers or the live server. No credentials or raw environment variables belong in audit evidence.
