# MenuMinute — Local Development Guide

## 1. Prerequisites

- **Node.js**: LTS release pinned in `.nvmrc` (v22+ supported; verified on v24 with prebuilt binaries)
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
pnpm install

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
