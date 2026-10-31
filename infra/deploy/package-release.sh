#!/usr/bin/env bash
# Package the exact Next.js/worker compilation already exercised by browser CI.
set -Eeuo pipefail
sha="${1:?Full release SHA required}"
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "Invalid release SHA" >&2; exit 2; }
test "$sha" = "$(git rev-parse HEAD)"
node -e 'if(process.platform!=="linux"||process.arch!=="arm64"||Number(process.versions.node.split(".")[0])!==24)process.exit(1)'
test -s .next/standalone/server.js
test -s .next/standalone/.next/BUILD_ID
test -s dist/worker.mjs
test -s dist/db-migrate.mjs
test -s dist/env-validate.mjs
test -s dist/db-migration-verify.mjs
test -s dist/auth-session-preflight.mjs
test -s dist/demo-provision.mjs
# Only allowlisted compiled output and production dependencies enter the release.
# Neither browser demo fixtures nor test DB contents are serialized.
pnpm install --prod --frozen-lockfile --prefer-offline
node -e 'require("pg");require("bullmq");require("sharp");require("nodemailer")'
stage="$(mktemp -d)"
trap 'rm -rf -- "$stage"' EXIT
install -d "$stage/.next/standalone/.next" "$stage/dist" "$stage/src/db" "$stage/infra/log-collector"
cp -a .next/standalone/. "$stage/.next/standalone/"
cp -a .next/static "$stage/.next/standalone/.next/static"
cp -a public "$stage/.next/standalone/public"
cp -a dist/. "$stage/dist/"
cp -a node_modules "$stage/node_modules"
cp -a src/db/migrations "$stage/src/db/migrations"
cp -a infra/systemd "$stage/infra/systemd"
cp -a infra/log-collector/. "$stage/infra/log-collector/"
cp -a infra/nginx "$stage/infra/nginx"
cp package.json pnpm-lock.yaml pnpm-workspace.yaml "$stage/"
printf '%s\n' "$sha" > "$stage/RELEASE-SHA"
test -s "$stage/src/db/migrations/meta/_journal.json"
test -s "$stage/infra/log-collector/collector.mjs"
test ! -e "$stage/.env"
test ! -e "$stage/.env.production"
(
  cd "$stage"
  node -e 'require("pg");require("bullmq");require("sharp");require("nodemailer")'
  node --check dist/worker.mjs
  node --check dist/db-migrate.mjs
  node --check dist/env-validate.mjs
  node --check dist/db-migration-verify.mjs
  node --check dist/auth-session-preflight.mjs
  node --check dist/demo-provision.mjs
)
short="${sha:0:12}"
archive="menuminute-${short}-linux-arm64.tar.gz"
tar --sort=name --owner=0 --group=0 --numeric-owner -czf "$PWD/$archive" -C "$stage" .
sha256sum "$archive" > "$archive.sha256"
sha256sum --check --strict "$archive.sha256"
