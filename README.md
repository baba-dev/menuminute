# MenuMinute (Working Name)

> **Affordable, mobile-first restaurant SaaS.**  
> Create digital menus, generate permanent QR codes for free forever, and scale into online ordering and kitchen display systems.

[![CI](https://github.com/baba-dev/menuminute/actions/workflows/ci.yml/badge.svg)](https://github.com/baba-dev/menuminute/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/Node.js-LTS_v22%2B-green.svg)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/Database-SQLite_WAL-blue.svg)](https://sqlite.org/)
[![ORM](https://img.shields.io/badge/ORM-Drizzle-orange.svg)](https://orm.drizzle.team/)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](LICENSE)

---

## Approved architecture and implementation status

Production targets **Linux AMD64/x86_64**, PostgreSQL + Drizzle/pg, separate Redis queue/cache
instances, BullMQ and Better Auth database sessions. Launch ordering is dine-in with staff
acceptance and pay at restaurant. The code below is still the SQLite/NextAuth Phase 0 scaffold;
this documentation update does not migrate or deploy it. Server resources/OS are unverified.

Start with [architecture](docs/architecture.md), [decisions](docs/decisions.md),
[dependency plan](docs/dependency-plan.md), [implementation gates](docs/implementation-plan.md),
and [AI development primers](docs/ai-development-primers.md). Contributors must read [AGENTS.md](AGENTS.md).

## 🍽️ Product Overview & Tiers

- **Free Forever (Primary Customer Acquisition Channel)**:
  - Create full digital menus with categories, dishes, descriptions, and dietary indicators.
  - Generate permanent QR codes that diners scan with zero registration required.
  - Unlimited menu items with real-time updates.
- **Online Ordering — Planned ₹149/month (Phase C)**:
  - Table-based QR ordering with mobile cart and submission.
  - Live order management for front-of-house staff.
- **Kitchen Pro — Planned ₹299/month (Phase D)**:
  - Dedicated Kitchen Display System (KDS) tablet interface.
  - Order acceptance and preparation stages with audible notifications.

---

## 🛠️ Technical Stack

| Layer                | Technology                                                 |
| -------------------- | ---------------------------------------------------------- |
| **Framework**        | Next.js App Router (React 19)                              |
| **Language**         | TypeScript (Strict mode enabled)                           |
| **Styling**          | Tailwind CSS v4 with custom design tokens                  |
| **Icons**            | Lucide React + custom vector SVGs                          |
| **Database**         | SQLite in WAL mode via `better-sqlite3`                    |
| **ORM**              | Drizzle ORM with versioned SQL migrations                  |
| **Validation**       | Zod v3                                                     |
| **Authentication**   | NextAuth v5 (JWT sessions, bcrypt password hashing)        |
| **QR Generation**    | `qrcode` with high-density SVG & PNG output                |
| **Image Processing** | Sharp with automatic dimension resizing                    |
| **Testing**          | Vitest + React Testing Library + Playwright                |
| **Target Host**      | Linux AMD64 target; Nginx + systemd (provisioning pending) |

---

## 🚀 Quick Start Guide

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/baba-dev/menuminute.git
cd menuminute
pnpm install
```

### 2. Environment Configuration

```bash
cp .env.example .env.local
```

### 3. Initialize SQLite Database & Seed Demo Restaurant

```bash
pnpm db:generate   # Generate Drizzle migration files
pnpm db:migrate    # Apply migrations to data/menuminute.sqlite
pnpm db:seed       # Idempotently seed demonstration restaurant
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
│   ├── (marketing)/      # Landing page & pricing
│   ├── (auth)/           # Login and user registration
│   ├── (dashboard)/      # Restaurant management portal
│   ├── (public-menu)/    # Mobile-first customer menu view
│   └── api/              # RESTful endpoints for menu and auth
├── db/                   # Drizzle schema, migrations, and SQLite connection
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

- [Architecture Guide](docs/architecture.md)
- [Database & Schema](docs/database.md)
- [Development Workflow](docs/development.md)
- [Environment Variables](docs/environment.md)
- [Production Deployment (Linux AMD64 target)](docs/deployment.md)
- [Security Architecture](docs/security.md)
- [Product Roadmap](docs/product-roadmap.md)
- [Architecture Decision Records (ADRs)](docs/decisions.md)
