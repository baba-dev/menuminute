# MenuMinute

> **Affordable, mobile-first restaurant SaaS.**  
> Create digital menus, generate permanent QR codes for free forever, and scale into online ordering and kitchen display systems.

[![CI](https://github.com/baba-dev/menuminute/actions/workflows/ci.yml/badge.svg)](https://github.com/baba-dev/menuminute/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/Node.js-LTS_v24-green.svg)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/Database-PostgreSQL-blue.svg)](https://www.postgresql.org/)
[![ORM](https://img.shields.io/badge/ORM-Drizzle-orange.svg)](https://orm.drizzle.team/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Approved architecture and implementation status

Production targets **Linux ARM64/aarch64**, PostgreSQL + Drizzle/pg, separate Redis queue/cache
instances, BullMQ and Better Auth database sessions. Launch supports dine-in and pickup for restaurants, takeout and cloud kitchens, with staff
acceptance and payment at the restaurant/counter. Phase 1 converts foundation/menu services to PostgreSQL, Better Auth and scoped tenancy;
Phase 2 adds organization/outlet management, scoped roles, durable projection jobs and explicit billing
entitlements. Phase 3 adds versioned Menu Studio, reviewed media, permanent service-point QR codes
and the public menu product. Ordering/KDS remain subsequent slices. The initial Free QR Menu web/worker release was activated on the shared Oracle ARM64 host on
2026-10-16. Public HTTPS readiness and signup were verified; the full production media/QR flow,
nightly backup operation, external alerting and capacity sign-off remain open. The audited host
has 4 visible ARM cores and 23 GiB RAM. See the [production runbook](docs/production-runbook.md)
for actual paths, deployed SHA, live status and shared-ERP protections.

Phase 4 merchant-readiness work is tracked by [execution epic #37](https://github.com/baba-dev/menuminute/issues/37) and [the scoped plan](docs/orchestration/phase-4.md). Its [acceptance matrix](docs/orchestration/phase-4-acceptance.md) separates integrated CI from the [operator-backed production checks](docs/orchestration/phase-4-ops-evidence.md); do not label Phase 4 complete solely on merged PRs or a deployment badge.

Start with [architecture](docs/architecture.md), [decisions](docs/decisions.md),
[dependency plan](docs/dependency-plan.md), [implementation gates](docs/implementation-plan.md),
and [AI development primers](docs/ai-development-primers.md). Contributors must read [AGENTS.md](AGENTS.md).

See [approved product requirements](docs/product-requirements.md) for worldwide multi-outlet scope,
outlet-type onboarding, role permissions, variants/add-ons, closing-time expiry and the initial
25-owner / 50-restaurant / 1,000-orders-per-hour planning envelope. Platform subscriptions use
USD/INR; outlets select supported local transaction currencies independently.

## Approved design direction

Ink & Ember remains approved: vivid color on white, gold/orange on charcoal, expressive restaurant
typography and selective chef's-note details. Use Ember Flow for everyday actions and Ink Press
for selected tactile emphasis; both use gradients and intent-driven motion. Service Card is for
routine dialogs, Ink Ticket for milestones and Chef's Note for optional guidance.

Light / Dark / System is required app-wide, including marketing, authentication, guests, owner tools
and future kitchen surfaces. Phase 4 adds shared Ink & Ember primitives and improves current free-menu
surfaces; older scaffold layouts need explicit visual acceptance. Orders/Kitchen remain previews and AI
is stubbed.
See [design system](docs/design-system.md), [buttons](docs/button-options.md) and
[feedback/motion](docs/feedback-and-motion.md) for preserved implementation contracts.

## 🍽️ Product Overview & Tiers

- **Free Forever (Primary Customer Acquisition Channel)**:
  - Create full digital menus with categories, dishes, descriptions, and dietary indicators.
  - Generate permanent QR codes that diners scan with zero registration required.
  - Unlimited menu items with real-time updates.
- **Online Ordering — ₹149/outlet/month hypothesis**:
  - Dine-in/table and pickup ordering with mobile cart and staff acceptance.
  - Live order management for front-of-house staff.
- **Kitchen Pro — ₹299/outlet/month hypothesis**:
  - Dedicated Kitchen Display System (KDS) tablet interface.
  - Order acceptance and preparation stages with audible notifications.

---

Prices are hypotheses, not finalized paid offerings. Free menus remain accessible after a paid plan ends.
Subscription collection, USD prices and exact plan quotas remain decisions.

## 🛠️ Technical Stack

| Layer                | Technology                                            |
| -------------------- | ----------------------------------------------------- |
| **Framework**        | Next.js App Router (React 19)                         |
| **Language**         | TypeScript (Strict mode enabled)                      |
| **Styling**          | Tailwind CSS v4 with custom design tokens             |
| **Icons**            | Lucide React + custom vector SVGs                     |
| **Database**         | PostgreSQL via `pg` (SQLite import tool only)         |
| **ORM**              | Drizzle ORM with versioned SQL migrations             |
| **Validation**       | Zod v4                                                |
| **Authentication**   | Better Auth database sessions; scrypt + legacy bcrypt |
| **QR Generation**    | `qrcode` with high-density SVG & PNG output           |
| **Image Processing** | Sharp with automatic dimension resizing               |
| **Testing**          | Vitest + React Testing Library + Playwright           |
| **Target Host**      | Ubuntu 24.04 ARM64; shared ERP host; Nginx + systemd  |

---

## Production deployment and release safety

The live origin is [food.bababuilds.com](https://food.bababuilds.com), with a separate
ERP-preserving Nginx virtual host. Runtime media is **local private shared-group storage**;
Cloudflare R2 is used for **encrypted off-host backups**, not live media. After a successful merge,
native ARM64 CI publishes an immutable release and the deploy workflow automatically stages and
activates the latest verified `main` build, including append-only migrations, once the reviewed
root-owned **helper v4** and the root-only migration-owner/off-host restic prerequisites are installed.
A migration-changing release first creates and verifies a new encrypted remote backup, then applies
the exact staged checksummed SQL before switching both services. No per-SHA operator marker is needed.
Failed prerequisites or migrations fail the deployment rather than silently claiming it is live.
The GitHub `production` environment, ERP/readiness checks and exact-SHA verification still apply.
See [unattended migration deployment](docs/automatic-migration-deployment.md) for the one-time
bootstrap and forward-only recovery contract.

Start with the [production source-of-truth runbook](docs/production-runbook.md), then consult the
[ARM64 deployment contract](docs/deployment.md) and [CI/CD 2.0: automatic safe releases and manual migration path](docs/deployment-actions.md).
Do not follow first-install examples on an already-live host or change `/usr/bin/node` used by ERP.

## 🚀 Quick Start Guide

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/baba-dev/menuminute.git
cd menuminute
pnpm install --frozen-lockfile
```

### 2. Environment Configuration

```bash
cp .env.example .env.local
```

### 3. Start isolated dependencies and apply reviewed migrations

```bash
pnpm infra:test:up
set -a
source .env.local
set +a
NODE_ENV=test pnpm exec tsx scripts/test-bootstrap.ts
pnpm db:migrate
# Optional explicit non-production demo:
ALLOW_DEMO_SEED=true DEMO_PASSWORD="set-a-unique-local-password" pnpm db:seed
```

### 4. Start Local Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔑 Local test/demo access only

The explicit **non-production** demo seed provides a local restaurant owner account. Never run it
against production or interpret this account as an actual merchant:

- **Login URL**: [http://localhost:3000/login](http://localhost:3000/login)
- **Email**: `demo@menuminute.com`
- **Password**: `demo-password-change-me`
- **Demo Restaurant**: _Spice Route Kitchen_ (23 dishes across 7 categories)
- **Public Menu URL**: [http://localhost:3000/m/demo-spice-route-kitchen-v1](http://localhost:3000/m/demo-spice-route-kitchen-v1)

---

## 📂 Project Architecture

See [docs/architecture.md](docs/architecture.md) for architectural details.

```text
src/
├── app/                  # Next.js App Router route handlers & pages
│   ├── page.tsx, pricing/ # Landing page & pricing
│   ├── login/, register/ # Login and user registration
│   ├── (dashboard)/      # Restaurant management portal
│   ├── (public-menu)/    # Mobile-first customer menu view
│   └── api/              # RESTful endpoints for menu and auth
├── db/                   # PostgreSQL schema, migrations, and scoped transactions
├── lib/                  # Validated config, errors, utility helpers
├── modules/              # Core business services (menus, restaurants, qr, ai, media)
└── styles/               # Design tokens and Tailwind CSS theme definitions
```

---

## 🧪 Testing & Verification

```bash
# Unit & integration tests
pnpm test

# Type checking
pnpm typecheck

# Code quality & linting
pnpm lint

# E2E browser smoke tests
pnpm test:e2e
```

---

## 📚 Documentation Index

- [Phase 1 foundation status, cutover and infrastructure](docs/foundation/phase-1.md)
- [Phase 3 free QR menu contracts](docs/menu-product/contracts.md) and [operations](docs/menu-product/operations.md)
- [Phase 2 core domain contracts](docs/core-domains/contracts.md) and [worker/billing operations](docs/core-domains/operations.md)

- [Phase 0 Development Orchestration](docs/orchestration/README.md)
- [Approved Product Requirements](docs/product-requirements.md)
- [Product Direction](docs/product-direction.md)
- [Design Exploration and Recorded Decision](docs/design-options.md)
- [Design and Theme Contract](docs/design-system.md)
- [Approved Buttons](docs/button-options.md)
- [AI and Media Policy](docs/ai-and-media.md)
- [Feedback and Motion](docs/feedback-and-motion.md)
- [Architecture Guide](docs/architecture.md)
- [Database & Schema](docs/database.md)
- [Development Workflow](docs/development.md)
- [Environment Variables](docs/environment.md)
- [Production operations source of truth: paths, release, checks and rollback](docs/production-runbook.md)
- [Production Deployment (Linux ARM64 target)](docs/deployment.md)
- [GitHub Actions CI/CD 2.0: automated safe deployment](docs/deployment-actions.md)
- [Audited ARM server and coexistence requirements](docs/server-inventory.md)
- [Security Architecture](docs/security.md)
- [Product Roadmap](docs/product-roadmap.md)
- [Architecture Decision Records (ADRs)](docs/decisions.md)

### CI/CD 2.0 release status

The native ARM64 CI runs quality, TypeScript, isolated PostgreSQL/Redis integration
and production build/browser checks in parallel. A final aggregate gate requires
all four to pass on the same SHA. The CI-tested production archive is the sole
input to immutable publication (no publisher rebuild). Its authenticated
publication handoff drives staging; the separate GitHub `production` activation
job exposes [the live application](https://food.bababuilds.com) and verifies
the public SHA. Stage-only results never count as verified deployment.
Migration-changing releases use the versioned automatic migration path with a fresh verified
off-host snapshot; helper v4, migration-owner env and restic provisioning are one-time root tasks. See [deployment actions](docs/deployment-actions.md)
and the [measured pre-change baseline](docs/ci-cd-baseline.md). Repository code
alone does not update the installed VPS helper or establish live deployment.


### Approved brand resources

| Resource | Canonical location | Guidance |
| --- | --- | --- |
| Logo, emblem, favicon | [`public/brand/logos`](public/brand/logos), [`icons`](public/brand/icons) | Light/dark SVG; same identity in top nav |
| One-shot animated logo | [`public/brand/motion`](public/brand/motion) | 2.4 s; stays static; replays on resolved theme change |
| UI loaders | [`public/brand/loaders`](public/brand/loaders) | SVG, reduced-motion aware |
| QR centre mark and sticker layouts | [`public/brand/print`](public/brand/print) | Replace template placeholder with validated live QR before print |
| Social / raster graphics | `public/brand/social` | Prefer optimized WebP when adding images; never crop concept boards |
| Future PWA images | Deferred | Do not alter current manifest/icons as part of this asset import |

[Full brand usage and asset registry](docs/brand/README.md). The homepage nav uses the approved one-shot vector reveal; all other routes and the existing theme bootstrap remain unchanged.
