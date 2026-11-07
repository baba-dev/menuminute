# MenuMinute — Local Development Guide

> MenuMinute runs on PostgreSQL, Better Auth and separate Redis workloads. Docker is required for the isolated
> local dependencies. Foundation history: [Phase 1 status/cutover](foundation/phase-1.md).

## 1. Prerequisites

- **Node.js**: Node 24 LTS, selected in `.nvmrc` to match CI and the pnpm 11 toolchain
- **Package Manager**: `pnpm` 11, pinned by `packageManager` in `package.json`
- **Git**: v2.40+
- **GitHub CLI**: `gh` (optional, for repo management)

---

## 2. Quick Start

```bash
# 1. Clone repository
git clone https://github.com/baba-dev/menuminute.git
cd menuminute

# 2. Install dependencies
pnpm install --frozen-lockfile

# 3. Configure local environment
cp .env.example .env.local

# 4. Start isolated dependencies and export CLI configuration
pnpm infra:test:up
set -a
source .env.local
set +a
NODE_ENV=test pnpm exec tsx scripts/test-bootstrap.ts
pnpm db:migrate

# 5. Populate demonstration menu and user
ALLOW_DEMO_SEED=true DEMO_PASSWORD="set-a-unique-local-password" pnpm db:seed

# 6. Start development server
pnpm dev
```

Visit:

- **Landing Page**: `http://localhost:3000`
- **Interactive Demo**: `http://localhost:3000/demo`
- **Public Customer Menu**: `http://localhost:3000/m/demo-spice-route-kitchen-v1`
- **Dashboard Portal**: `http://localhost:3000/dashboard`

---

## 3. Demo Credentials

The database seed provides a pre-configured restaurant owner account:

- **Email**: `demo@menuminute.com`
- **Password**: the unique DEMO_PASSWORD you supplied to the explicit development seed
- **Restaurant**: Spice Route Kitchen
- **Public ID**: `demo-spice-route-kitchen-v1`

---

## 4. Development Scripts

Run `pnpm <script>`; the authoritative list is `scripts` in `package.json`.

| Command                                                  | Action                                                                                            |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `pnpm dev`                                               | Prepare dashboard/order media, then start Next.js on port 3000                                    |
| `pnpm build`                                             | Verify and prepare media assets, then create the optimized production build                       |
| `pnpm start`                                             | Run the production server                                                                         |
| `pnpm worker` / `pnpm build:worker`                      | Run / bundle the background worker (`dist/worker.mjs`)                                            |
| `pnpm lint` / `pnpm lint:fix`                            | ESLint with a zero-warning threshold / auto-fix                                                   |
| `pnpm format` / `pnpm format:check`                      | Prettier write / check (CI runs the check)                                                        |
| `pnpm typecheck`                                         | TypeScript type checking without emit                                                             |
| `pnpm test` / `pnpm test:watch` / `pnpm test:coverage`   | Vitest run / watch / coverage                                                                     |
| `pnpm test:e2e` / `pnpm test:e2e:ui`                     | Playwright browser tests (starts its own HTTPS server via `scripts/browser-server.mjs`) / UI mode |
| `pnpm infra:test:up` / `pnpm infra:test:down`            | Start / remove the isolated PostgreSQL and Redis containers                                       |
| `pnpm db:generate`                                       | Generate versioned Drizzle migrations from schema changes                                         |
| `pnpm db:migrate`                                        | Apply pending migrations                                                                          |
| `pnpm db:seed`                                           | Explicit non-production seed (needs `ALLOW_DEMO_SEED=true` and `DEMO_PASSWORD`)                   |
| `pnpm db:studio`                                         | Open Drizzle Studio                                                                               |
| `pnpm db:import:sqlite`                                  | One-time legacy SQLite import tool (read-only input)                                              |
| `pnpm env:validate`                                      | Validate environment configuration                                                                |
| `pnpm help:verify` / `pnpm floor:verify`                 | Verify the help registry / dining-floor system                                                    |
| `pnpm media:verify:studio` / `:qr` / `:orders` / `:docs` | Verify generated and documented media assets                                                      |
| `pnpm docs:capture`                                      | Re-capture documentation screenshots from the demo                                                |
| `pnpm perf:baseline`                                     | Measure the performance baseline                                                                  |

## ARM64 build contract

Production is Ubuntu 24.04 ARM64 on the shared ERP server; see
[server inventory](server-inventory.md) and [deployment](deployment.md). Local development may
use another architecture, but an x64 build does not satisfy the production release gate.

CI runs on `ubuntu-24.04-arm` and verifies `process.arch === "arm64"` before installing dependencies.
Use the packageManager-pinned pnpm version and a frozen lockfile. Install native dependencies
(Next.js SWC, Sharp and development-only SQLite import tooling) on the target architecture; never copy
node_modules or `.next` output from AMD64/macOS. Keep caches separated by OS, architecture and
Node major. Container builds, if introduced, must target `linux/arm64` and pass native runtime checks.

Build and test outside the ERP host. A green PR run only validates the change; it never deploys. After a merge to `main`, CI publishes an immutable ARM64 artifact and the deploy workflow stages and, when eligible, activates it. See [CI/CD 2.0](deployment-actions.md) and [automatic migration deployment](automatic-migration-deployment.md). Record Node, pnpm, architecture and artifact SHA for releases.

## Product and design contract

Before implementation, read [approved product requirements](product-requirements.md),
[product direction](product-direction.md), [design system](design-system.md),
[buttons](button-options.md), [feedback/motion](feedback-and-motion.md),
[AI/media policy](ai-and-media.md) and [roadmap](product-roadmap.md).

Use semantic theme tokens and shared shadcn/Radix primitives. Preserve Ink & Ember, Ember Flow
for everyday actions, selected Ink Press emphasis and app-wide Light / Dark / System. Each feature
PR identifies changed behavior, schema/migration requirements and acceptance evidence. Distinguish
previews from implementation; final-SHA checks are required. Map existing order enums explicitly
when adding pickup and expiry through reviewed migrations.
