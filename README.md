# MenuMinute

> **Affordable, mobile-first restaurant SaaS.**  
> Create digital menus, generate permanent QR codes for free forever, and scale into online ordering and kitchen display systems.

[![CI](https://github.com/baba-dev/menuminute/actions/workflows/ci.yml/badge.svg)](https://github.com/baba-dev/menuminute/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/Node.js-LTS_v22%2B-green.svg)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/Database-SQLite_WAL-blue.svg)](https://sqlite.org/)
[![ORM](https://img.shields.io/badge/ORM-Drizzle-orange.svg)](https://orm.drizzle.team/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Product direction

**A beautiful menu for every restaurant. A calmer service for every team.**

For independent cafés, dhabas, bakeries and small restaurants: free permanent QR menus, with subscriptions for guest ordering and kitchen operations.

| Tier        | Pilot pricing hypothesis             | Outcome                                                                           |
| ----------- | ------------------------------------ | --------------------------------------------------------------------------------- |
| Free Menu   | ₹0                                   | Mobile menu, restaurant branding, categories/items, availability and permanent QR |
| Ordering    | ₹149/outlet/month                    | Table ordering, guest cart, staff acceptance, tracking and history                |
| Kitchen Pro | ₹299/outlet/month, includes Ordering | Dedicated kitchen board, timers, staff roles and reconnect recovery               |

Prices are pilot hypotheses; paid workflows are planned. V1 guest payment is at the counter. Keep the free menu accessible when a paid plan ends. See [product direction](docs/product-direction.md) for exact boundaries and open launch decisions.

### Design baseline: Olive & Linen

Linen surfaces, olive primary actions, restrained terracotta accents, Fraunces editorial headings and DM Sans controls. Use Nova-inspired shadcn components and distinct guest, owner and kitchen layouts.

![Olive and Linen direction board](docs/assets/olive-linen-direction.svg)

The baseline is proposed in this documentation PR. The starter UI still uses orange/Inter. Orders and Kitchen are previews; AI services are stubs. This is not yet a live ordering or kitchen product.

Start with [product direction](docs/product-direction.md), [design system](docs/design-system.md), [AI and media policy](docs/ai-and-media.md) and [execution roadmap](docs/product-roadmap.md). These define the next implementation contract.

---

## 🛠️ Technical Stack

| Layer                | Technology                                                  |
| -------------------- | ----------------------------------------------------------- |
| **Framework**        | Next.js App Router (React 19)                               |
| **Language**         | TypeScript (Strict mode enabled)                            |
| **Styling**          | Tailwind CSS v4 with custom design tokens                   |
| **Icons**            | Lucide React + custom vector SVGs                           |
| **Database**         | SQLite in WAL mode via `better-sqlite3`                     |
| **ORM**              | Drizzle ORM with versioned SQL migrations                   |
| **Validation**       | Zod v3                                                      |
| **Authentication**   | NextAuth v5 (JWT sessions, bcrypt password hashing)         |
| **QR Generation**    | `qrcode` with high-density SVG & PNG output                 |
| **Image Processing** | Sharp with automatic dimension resizing                     |
| **Testing**          | Vitest + React Testing Library + Playwright                 |
| **Target Host**      | Oracle Cloud Always Free ARM64 Ubuntu VPS (Nginx + systemd) |

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
│   ├── page.tsx, pricing/ # Landing page & pricing
│   ├── login/, register/ # Login and user registration
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

- [Product Direction](docs/product-direction.md)
- [Design System and Tokens](docs/design-system.md)
- [AI and Media Policy](docs/ai-and-media.md)
- [Architecture Guide](docs/architecture.md)
- [Database & Schema](docs/database.md)
- [Development Workflow](docs/development.md)
- [Environment Variables](docs/environment.md)
- [Production Deployment (Oracle Cloud ARM64)](docs/deployment.md)
- [Security Architecture](docs/security.md)
- [Product Roadmap](docs/product-roadmap.md)
- [Architecture Decision Records (ADRs)](docs/decisions.md)
