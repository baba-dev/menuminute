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
orders/outbox remain subsequent slices. No production cutover has occurred. The audited host runs Ubuntu 24.04.4 LTS with
4 visible ARM cores, 23 GiB RAM and 43 GB free disk after confirmed cleanup. See
[server inventory](docs/server-inventory.md) for shared-ERP constraints and outstanding inputs.

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
and kitchen. The starter UI is still orange/Inter, Orders/Kitchen are previews and AI is stubbed.
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

## 🔑 Demo Access Credentials

The database seed provides a pre-configured demo restaurant owner account:

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
- [Production Deployment (Linux ARM64 target)](docs/deployment.md)
- [Audited ARM server and coexistence requirements](docs/server-inventory.md)
- [Security Architecture](docs/security.md)
- [Product Roadmap](docs/product-roadmap.md)
- [Architecture Decision Records (ADRs)](docs/decisions.md)
