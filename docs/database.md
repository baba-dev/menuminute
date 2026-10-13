# MenuMinute — Database Documentation

## 1. Engine and Connection Strategy

MenuMinute uses **SQLite** driven by **`better-sqlite3`** and orchestrated with **`drizzle-orm`**.

### Production SQLite Configuration (Pragmas)

In `src/db/index.ts`, the database connection enforces production-grade reliability:

- **`journal_mode = WAL`**: Write-Ahead Logging allows concurrent readers while a write transaction is executing.
- **`foreign_keys = ON`**: Strict foreign key enforcement ensuring relational integrity.
- **`busy_timeout = 5000`**: Busy timeout of 5,000 milliseconds to wait for concurrent writes instead of immediately throwing `SQLITE_BUSY`.
- **`synchronous = NORMAL`**: Balances high write throughput with power-loss durability when in WAL mode.
- **`cache_size = -65536`**: 64 MB in-memory page cache for high read speeds.
- **`mmap_size = 134217728`**: 128 MB memory-mapped I/O for lightning-fast reads.
- **`temp_store = MEMORY`**: Temporary tables and indices stored in memory for performant complex sorting.

---

## 2. Currency and Financial Integrity

All currency and financial figures (e.g. `pricePaise`, `monthlyPricePaise`, `subtotalPaise`, `totalPaise`) are stored as **64-bit integer minor units (paise / cents)** rather than floating-point numbers.

```text
₹299.00  -->  29900 paise
₹69.50   -->   6950 paise
```

This completely eliminates IEEE 754 floating-point rounding errors.

---

## 3. Relational Schema Summary

The database consists of 22 normalized tables:

| Domain          | Table                      | Purpose                                                         |
| --------------- | -------------------------- | --------------------------------------------------------------- |
| **Identity**    | `users`                    | User accounts, credentials, system roles (`user`, `superadmin`) |
|                 | `sessions`                 | Active JWT session records                                      |
|                 | `accounts`                 | OAuth identity provider links                                   |
|                 | `verification_tokens`      | Email verification & magic links                                |
| **Restaurants** | `restaurants`              | Restaurant identity, branding tokens, slug, stable `publicId`   |
|                 | `restaurant_members`       | Tenant membership (`owner`, `manager`, `staff`, `kitchen`)      |
|                 | `outlets`                  | Physical branch locations                                       |
|                 | `restaurant_tables`        | Dine-in tables with numbers & capacity                          |
|                 | `qr_codes`                 | Permanent QR code tokens and scan analytics                     |
| **Menus**       | `menu_categories`          | Menu sections with sort order                                   |
|                 | `menu_items`               | Dishes, descriptions, prices, dietary flags, spice levels       |
|                 | `menu_item_variants`       | Portions/sizes (Half/Full, Small/Large)                         |
|                 | `menu_media`               | Media attachments with license & attribution provenance         |
| **Orders**      | `orders`                   | Order headers with status and totals                            |
|                 | `order_items`              | Line items with historical price snapshots                      |
|                 | `order_status_events`      | Immutable audit trail of order status transitions               |
| **Billing**     | `subscription_plans`       | Product tiers (`free`, `ordering`, `kitchen_pro`)               |
|                 | `restaurant_subscriptions` | Active subscription status and billing periods                  |
| **Media & AI**  | `media_assets`             | Central registry for local and R2 media files                   |
|                 | `ai_usage_records`         | Token consumption tracking across AI providers                  |
| **System**      | `background_jobs`          | Persistent async queue for processing & notifications           |
|                 | `audit_logs`               | Security audit trail of administrative modifications            |

---

## 4. Migration & Seed Operations

- **Generate Migrations**: `pnpm db:generate` — generates deterministic SQL files in `src/db/migrations/`.
- **Run Migrations**: `pnpm db:migrate` — applies pending migrations safely.
- **Seed Development Data**: `pnpm db:seed` — idempotent script populating demo restaurant "Spice Route Kitchen".
