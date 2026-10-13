# MenuMinute — Product Roadmap

## Phase Overview

MenuMinute follows a disciplined phased execution roadmap. Each phase delivers a complete, verifiable product milestone without premature complexity.

---

### Phase 0: Foundation and Working Skeleton (Completed ✅)

- Clean Next.js App Router, TypeScript strict mode, and Tailwind v4 setup.
- SQLite + Drizzle ORM foundation with WAL mode, foreign keys, and versioned migrations.
- Complete 22-table normalized schema.
- Idempotent seed script with realistic Indian restaurant demonstration data.
- Stable, permanent QR code generation linked to opaque tokens (`publicId`).
- Public mobile-first customer menu view (`/m/[publicMenuId]`).
- Authenticated owner dashboard with Menu Management CRUD vertical slice.
- Preview routes for upcoming Ordering (`/dashboard/orders`) and Kitchen (`/kitchen`).
- Comprehensive unit and integration test suite via Vitest.
- GitHub Actions CI workflow with least-privilege permissions.

---

### Phase A: Restaurant Onboarding & Complete Free QR Menus

- Interactive restaurant self-onboarding wizard (create restaurant profile, address, currency).
- Category reordering (drag-and-drop sort order).
- Dish variant builder (e.g. Half / Full, Small / Medium / Large).
- Printable QR PDF templates with restaurant branding.
- Restaurant logo & cover image uploads with Sharp thumbnail generation.

---

### Phase B: Smart Menu Import & Dish Photography

- Google Gemini Vision OCR menu import from photographed physical menus.
- Gemini text enhancement for appetizing dish descriptions.
- Multi-lingual menu translation (English, Hindi, regional Indian languages).
- Pexels stock photography search and integration with photographer attribution.
- Cloudflare R2 media storage adapter for production asset hosting.

---

### Phase C: Online Ordering & Subscriptions (₹149/month)

- Table-based QR ordering with URL token table binding.
- Customer cart and order submission without registration.
- Live order management dashboard for waitstaff.
- Order status notifications and customer tracking page.
- Razorpay subscription integration for ₹149/mo plan.

---

### Phase D: Kitchen Display System (Kitchen Pro — ₹299/month)

- Dedicated Kitchen Display System (KDS) tablet and touch interface (`/kitchen`).
- Order acceptance, preparation, and completion lifecycle.
- Audible kitchen chimes on new ticket receipt.
- Multi-station routing (Bar, Tandoor, Main Kitchen).
- Daily operational and preparation time analytics.

---

### Phase E: Production Hardening & Commercial Launch

- Oracle Cloud ARM64 Ubuntu deployment with systemd supervision.
- Nginx reverse proxy with automated Let's Encrypt SSL.
- Automated daily SQLite WAL backups to offsite storage.
- End-to-end monitoring, health check alerts, and error tracking.
- Public beta launch.
