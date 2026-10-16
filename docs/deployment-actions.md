# MenuMinute: GitHub Actions -> shared ARM64 VPS

This deployment path is **manual by default**. It uses the immutable ARM64
artifact from successful `main` CI; it never builds on the ERP VPS. PRs cannot
deploy. Staging does not restart units, touch nginx, modify the ERP, or run SQL.
Activation requires both the GitHub `production` environment gate and a separate
root-owned per-SHA approval marker on the VPS.

The deployment script and workflow live at
`infra/deploy/menuminute-release` and `.github/workflows/deploy-vps.yml`.
Review both before granting the deploy SSH key.

## 1. Verify the shared host before provisioning

From a trusted administrator session on the **selected Oracle ARM64 host**:

```bash
uname -m                         # aarch64
/usr/bin/node -p 'process.version + " " + process.arch' # v24 ... arm64
df -h /                           # maintain >=4GiB free for staging, much more for runtime
ss -ltnp | grep -E ':(3000|3100|6381|6382)\b' || true
systemctl is-active nginx
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/
```

Do not disturb ERP's port 3000, PM2, DB, Nginx server block, certificates or
CrowdSec/firewall rules. MenuMinute uses **127.0.0.1:3100**, consistent with the
committed systemd and Nginx templates; the earlier 3001 in server inventory is
superseded. Confirm actual domain, Nginx routing and TLS independently. No
firewall change is required to make port 3100 public; it must stay on loopback.

Before an activation, provision PostgreSQL (separate owner/app/worker roles),
two loopback Redis instances (queue 6381, cache 6382), off-host backups and
a successful restore rehearsal. `infra/compose.test.yml` is **not** production
infrastructure. Never use the CI demo secrets in production.

## 2. One-time VPS account/directories

Run these as an administrator **only after reviewing the paths**. Do not
replace an existing production account/unit without comparing it first.

```bash
sudo id menuminute
sudo id menuminute-worker
sudo getent group menuminute-media
# The three runtime identities above must be provisioned separately.
sudo useradd --system --create-home --home-dir /var/lib/menuminute/deploy \
  --shell /bin/bash menuminute-deploy
sudo install -d -o root -g root -m 0755 /var/www/menuminute /var/www/menuminute/releases
sudo install -d -o root -g root -m 0755 /var/lib/menuminute
sudo install -d -o menuminute-deploy -g menuminute-deploy -m 0700 /var/lib/menuminute/incoming
sudo install -d -o menuminute -g menuminute -m 0770 \
  /var/lib/menuminute/cache /var/lib/menuminute/tmp
sudo install -d -o menuminute-worker -g menuminute-worker -m 0770 \
  /var/lib/menuminute/worker-tmp
sudo install -d -o root -g root -m 0700 \
  /etc/menuminute /etc/menuminute/approved-releases
```

For `/var/lib/menuminute/media`, configure the shared `menuminute-media`
group and permissions according to the real storage provider; do not open
world-writable access. The server must have Node 24 ARM64 accessible at
`/usr/bin/node` (not only an interactive nvm shell). Install and review the
web/worker systemd templates and the dedicated, TLS-enabled Nginx site
**once**, in a separate provisioning change. Do not let Actions edit
systemd unit definitions, Nginx or production env files.

Create root-owned `/etc/menuminute/web.env` and
`/etc/menuminute/worker.env` in systemd `EnvironmentFile` format with mode
0600; put **only** the migration-owner `MIGRATION_DATABASE_URL` in
`/etc/menuminute/migration.env` (mode 0600, shell-compatible assignment).
The runtime roles must have neither migration-owner credentials nor
SUPERUSER/BYPASSRLS privileges.

Install the reviewed release script from a **pinned, reviewed main SHA**, e.g.:

```bash
# Replace REVIEWED_SHA with the 40-character reviewed commit from merged PR.
curl -fL "https://raw.githubusercontent.com/baba-dev/menuminute/REVIEWED_SHA/infra/deploy/menuminute-release" \
  -o /tmp/menuminute-release
bash -n /tmp/menuminute-release
sudo install -o root -g root -m 0750 /tmp/menuminute-release /usr/local/sbin/menuminute-release
sudo visudo -f /etc/sudoers.d/menuminute-deploy
```

Insert this _single allowlisted command_ in that sudoers file, then
`sudo chmod 0440 /etc/sudoers.d/menuminute-deploy` and
`sudo visudo -cf /etc/sudoers.d/menuminute-deploy`:

```sudoers
menuminute-deploy ALL=(root) NOPASSWD: /usr/local/sbin/menuminute-release *
```

The audited script rejects any mode other than `stage`/`activate`, validates
full commit/checksum hex, confines its paths to MenuMinute, and uses `flock`.
Never give the deploy account blanket sudo, root SSH, password login, git push,
PM2, service-manager or Nginx permissions. The account may write only its
incoming artifact and its own SSH home. Do not run a self-hosted Actions runner
on the shared ERP host.

## 3. One dedicated SSH key and host pin

Generate an **independent** key on a trusted administrator workstation (not
in this chat or the repository):

```bash
ssh-keygen -t ed25519 -a 100 -f ./menuminute_actions_deploy -C menuminute-actions
```

For unattended Actions, store the private key as the GitHub environment secret
below, restrict who can approve production, and rotate the key if exposed.
Append the public key to
`/var/lib/menuminute/deploy/.ssh/authorized_keys` owned by
`menuminute-deploy`, with `restrict` prefixed to the public-key line.
Set `.ssh` permissions to 0700 and `authorized_keys` to 0600.

Pin the SSH host **ED25519 public key**, verifying its fingerprint via the VPS
console or a previously trusted connection, not by accepting an unverified
`ssh-keyscan` result. GitHub known_hosts entry: `hostname ssh-ed25519 AAAA...`
(or `[hostname]:PORT ssh-ed25519 AAAA...` when port is not 22).

In **Settings -> Environments -> production**, restrict deployment branches to
`main`, add a required reviewer when available, and set:

| Type     | Name                  | Value                                             |
| -------- | --------------------- | ------------------------------------------------- |
| Secret   | `VPS_HOST`            | Verified host DNS name or IPv4 address            |
| Secret   | `VPS_SSH_KEY`         | Complete dedicated private key, including markers |
| Secret   | `VPS_SSH_KNOWN_HOSTS` | Independently verified OpenSSH known_hosts line   |
| Variable | `VPS_PORT`            | SSH port; defaults to 22                          |

Do not put database, Redis or Better Auth credentials in GitHub Actions.
They remain on the server under `/etc/menuminute`. No SSH secrets are needed
for PR CI or the ARM64 publisher.

## 4. Stage -> review -> activate

In **Actions -> Deploy verified MenuMinute ARM64 release -> Run workflow**,
select `main` and enter the exact 40-character SHA of a published ARM64
release. First run with `activate=false`; this verifies release tag/target,
downloads the artifact and checksum, verifies SHA-256 on the runner, copies the
archive via pinned SSH, verifies the digest on the server, checks ARM64/Node
and native modules, then stages it under
`/var/www/menuminute/releases/<full-SHA>`. It does not move `current`.

**Example currently published release (2026-10-16):**
`f2cf1fc44a8f12645c18236bbb835b9e65c5ed02`.
Always check whether a newer main release supersedes this before deployment.

Before activation: confirm an encrypted off-host backup/restore point, review
the release SQL and backward compatibility, provision the two systemd units
and the production Nginx site, verify ERP health, and apply only explicitly
approved migrations from this exact staged release. The bundled migration
runner is locked/checksummed, but **deployment never runs it automatically**.
One operator-only invocation after reviewing `migration.env`:

```bash
SHA=FULL_VERIFIED_40_CHARACTER_SHA
sudo bash -c 'set -a; source /etc/menuminute/migration.env; cd "$1"; exec /usr/bin/node dist/db-migrate.mjs' \
  _ "/var/www/menuminute/releases/$SHA"
```

After migration/backup approval, create a one-release, root-owned gate:

```bash
sudo install -o root -g root -m 0600 /dev/null "/etc/menuminute/approved-releases/$SHA"
```

Run the same workflow again with `activate=true` and the same full SHA.
It re-verifies/releases and stages idempotently, checks the approval marker,
validates Nginx and ERP localhost HTTP, atomically updates MenuMinute web and
worker links, restarts **only** the two MenuMinute units, verifies both units,
`127.0.0.1:3100/api/health/ready` and ERP HTTP after cutover. It restores
the prior MenuMinute application links and restarts its units on an activation
failure. **It never rolls back database migrations or data.** Revert only to
a schema-compatible prior application; once new writes occur, a DB restore
is not an automatic rollback. Review proxy/public TLS and ERP after success.

The script retains staged releases for rollback and does no automatic deletion.
Implement a separate reviewed retention policy after disk monitoring is live.

## 5. Troubleshooting

- Missing `approved-releases/<SHA>`: migration/release approval is incomplete.
- 503 on readiness: inspect only MenuMinute `journalctl -u menuminute-web`
  and the private PostgreSQL/Redis readiness; do not print credentials.
- Port 3100 occupied: investigate before provisioning; never move ERP off 3000
  as an automatic workaround.
- Checksum mismatch or wrong tag: abort, do not bypass it or manually extract.
- Any host-key mismatch: abort; verify host identity out of band.
- If a live data migration changes schema incompatibly, resolve forward rather
  than reverting DB blindly. Preserve ERP independently.

This is a deployment mechanism, not proof of production readiness, off-host
backups, load testing, restored data or app-domain TLS.
