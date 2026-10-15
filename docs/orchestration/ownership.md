# Ownership and shared-file control

These are logical work lanes, not permission grants. Paths below exist unless marked **target**.
Task-specific reservations override the default lane only after integration-owner acknowledgement.

| Lane               | Primary write scope                                                                               | Required coordination                                        |
| ------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Foundation/data    | `src/db/`, `scripts/db-migrate.ts`, `scripts/db-seed.ts`, `drizzle.config.ts`                     | Identity, domain schema and migration consumers              |
| Identity/tenancy   | `src/lib/auth.ts`, `src/modules/restaurants/`, auth API routes, login/register pages              | Foundation; permission matrix; existing account mapping      |
| Menu/QR            | `src/modules/menus/`, `src/modules/qr/`, menu API routes, public menu and dashboard menu/QR pages | Foundation, published version and stable QR contracts        |
| Orders/KDS         | Kitchen page, dashboard orders page; **target** orders/kitchen services and API routes            | Foundation, menu quote and outbox contracts                  |
| Jobs/platform      | `src/lib/config/`, `scripts/env-validate.ts`; **target** worker, outbox and Redis adapters        | Foundation transaction helper and domain event owners        |
| Media/AI           | `src/modules/media/`, `src/modules/ai/`; **target** provider/asset adapters                       | Jobs, menus, upload provenance and reviewed drafts           |
| Design/UI          | `src/styles/`, **target** shared UI components; assigned pages only                               | Feature owners, exact approved tokens and accessibility      |
| Quality/operations | `tests/`, `.github/workflows/`, release docs                                                      | Test files reserved by scenario; domain review on assertions |

Do not infer future directories are implemented. The foundation contract PR records final paths
before downstream work begins. All domain schema edits still pass through the single data owner.
QA may author tests independently, but cannot change production modules without a new claim.

## Shared paths: serialize writes

| Shared path                                           | Reservation authority                    | Rule                                                          |
| ----------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------- |
| `package.json`, `pnpm-lock.yaml`, workspace config    | Integration owner                        | One dependency PR; frozen lockfile; native ARM64 evidence     |
| `src/db/**`, `drizzle.config.ts`, migration scripts   | Data owner through integration owner     | One migration sequence; no competing generated journals       |
| Auth/session and tenant-context helpers               | Identity owner through integration owner | Publish consumer contract before domain adoption              |
| `src/app/layout.tsx`, dashboard layout, global styles | UI owner through integration owner       | Central primitives first; feature agents use existing exports |
| Environment schema/example, CI and deployment config  | Platform owner through integration owner | No secrets; shared ERP coexistence and rollback review        |
| `AGENTS.md`, architecture, invariants, decisions      | Integration owner                        | Record impact on every active contract                        |
| `tests/setup.ts`, shared fixtures and E2E config      | QA owner through integration owner       | Shared fixture revisions coordinated with consumers           |

CODEOWNERS names @baba-dev because that is the verified repository owner. Logical ownership is
tracked in issues, not by creating fictitious GitHub teams. All issue status/claim updates must be
attributed to the acting session.

## Active outside work

Artwork is already being reviewed in [draft PR #4](https://github.com/baba-dev/menuminute/pull/4).
Do not duplicate or overwrite its `public/assets/food/dishes/`, `docs/food-artwork/` or
`scripts/food-artwork/` work. Integration remains separate and requires the recorded artwork gates.
Reinspect open PRs before every batch; this dated inventory is not a live lock service.
