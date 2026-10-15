# MenuMinute — Local Development Guide

> Current scaffold instructions: SQLite + NextAuth. PostgreSQL/Redis/Better Auth are the
> approved target, pending the foundation implementation. Do not use these commands as the
> target production deployment. See [implementation plan](implementation-plan.md).

## 1. Prerequisites

- **Node.js**: Node 24 LTS, selected in `.nvmrc` to match CI and the pnpm 11 toolchain
- **Package Manager**: `pnpm` (v11+)
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

# 4. Generate and run database migrations
pnpm db:generate
pnpm db:migrate

# 5. Populate demonstration menu and user
pnpm db:seed

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
- **Password**: `demo-password-change-me`
- **Restaurant**: Spice Route Kitchen
- **Public ID**: `demo-spice-route-kitchen-v1`

---

## 4. Development Scripts

| Command              | Action                                                    |
| -------------------- | --------------------------------------------------------- |
| `pnpm dev`           | Start Next.js development server on port 3000             |
| `pnpm build`         | Create optimized production build                         |
| `pnpm start`         | Run production server                                     |
| `pnpm lint`          | Run ESLint with zero-warning threshold                    |
| `pnpm typecheck`     | Run TypeScript compiler type checking without emit        |
| `pnpm test`          | Run Vitest unit & integration test suite                  |
| `pnpm test:coverage` | Run Vitest test coverage report                           |
| `pnpm test:e2e`      | Run Playwright end-to-end browser smoke tests             |
| `pnpm db:generate`   | Generate versioned Drizzle migrations from schema changes |
| `pnpm db:migrate`    | Execute pending database migrations                       |
| `pnpm db:seed`       | Idempotently seed demonstration restaurant and menu       |
| `pnpm env:validate`  | Verify environment configuration variables                |

## ARM64 build contract

Production is Ubuntu 24.04 ARM64 on the shared ERP server; see
[server inventory](server-inventory.md) and [deployment](deployment.md). Local development may
use another architecture, but an x64 build does not satisfy the production release gate.

CI runs on `ubuntu-24.04-arm` and verifies `process.arch === "arm64"` before installing dependencies.
Use the packageManager-pinned pnpm version and a frozen lockfile. Install native dependencies
(Next.js SWC, Sharp and the current SQLite scaffold) on the target architecture; never copy
node_modules or `.next` output from AMD64/macOS. Keep caches separated by OS, architecture and
Node major. Container builds, if introduced, must target `linux/arm64` and pass native runtime checks.

Build and test outside the ERP host. The CI build is scaffold validation, not a PostgreSQL/Redis
release or an automatic deployment. Record Node, pnpm, architecture and artifact SHA for releases.

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
