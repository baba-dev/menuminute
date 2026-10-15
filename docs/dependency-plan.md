# Dependency and external API plan

Status: approved selections, pending compatibility/pinning implementation. Existing package.json
and lockfile still describe the SQLite scaffold. No packages are installed by this document.

| Concern          | Selected                            | Alternative considered      | Reason / constraint                                                  |
| ---------------- | ----------------------------------- | --------------------------- | -------------------------------------------------------------------- |
| Application      | Next.js + TypeScript                | Fastify/NestJS API          | Keep current codebase; services independent of framework             |
| ORM/driver       | Drizzle + pg                        | Prisma, Kysely, postgres.js | Existing ORM, explicit SQL and bounded pools                         |
| Redis/jobs       | ioredis + BullMQ                    | node-redis, pg-boss         | Shared Redis integration; outbox remains in PostgreSQL               |
| Identity         | Better Auth + Drizzle adapter       | Auth.js, hosted auth        | Revocable database sessions and selected plugins                     |
| Validation       | Zod                                 | Valibot                     | Existing forms and job/AI schema reuse                               |
| APIs             | REST + OpenAPI                      | tRPC                        | External integration contract; thin Server Actions where appropriate |
| UI               | shadcn + Radix + Tailwind           | Base UI                     | Retain scaffold primitives and approved custom tokens                |
| Forms            | React Hook Form                     | TanStack Form               | Existing integration                                                 |
| Live data/tables | TanStack Query / Table              | SWR, handwritten grid       | KDS/dashboard only; server pagination                                |
| Cart             | React reducer                       | Zustand                     | Start small; persist versioned non-sensitive cart state              |
| Motion           | CSS, selective Motion               | GSAP                        | Lazy features and reduced-motion support                             |
| Localization     | next-intl + Intl                    | i18next                     | App Router, locale/currency precision and future RTL                 |
| Rate limits      | rate-limiter-flexible               | handwritten Redis scripts   | Distributed limits; explicit outage rules                            |
| Storage          | R2 via AWS SDK v3 S3 client         | local filesystem            | Tenant-scoped objects and controlled uploads                         |
| Images/QR        | Sharp / qrcode                      | external QR API             | Background variants; stable URLs; no external QR dependency          |
| AI               | AI SDK + provider adapters          | native-only SDKs, LangChain | Shared text/structured contracts; native adapters when needed        |
| Email            | Resend adapter                      | Nodemailer/SMTP             | Queued transactional delivery with idempotency                       |
| Logging          | Pino                                | ad-hoc console logging      | Structured identifiers and redaction                                 |
| Tests            | Vitest, Testing Library, Playwright | full mocks                  | Keep suite; real PostgreSQL/Redis via Testcontainers                 |
| Load             | k6                                  | browser-only load           | Separate realistic API/SSE workload profiles                         |

## External API boundaries

- Gemini: benchmark menu image/PDF extraction, translations and structured drafts.
- NVIDIA hosted endpoints: benchmark rewriting/classification; verify account/model commercial
  terms, quotas and feature compatibility before enablement.
- Workers AI: evaluate model-specific text/image tasks; separate from R2 storage.
- Pexels: merchant-approved stock suggestions, attribution and license/provenance records;
  verify API use rules before building a reusable asset collection.
- Turnstile: server-verified challenge on signup/recovery/suspicious submission, not every menu view.
- Resend: account notifications and administrative messages; not the kitchen order transport.
- R2: upload originals privately, validate/process, then publish approved derivatives.

All adapters need deadlines, bounded retries, cancellation, redacted errors, usage accounting,
provider-specific idempotency where available and recorded capability tests. Free allowances are
not unlimited capacity. Paid calls require task authorization; tests use fixtures/provider mocks.
No online payment, SMS, delivery/maps or WhatsApp API is required for launch.

## Installation gate

1. Inspect current imports and migration impact; select compatible stable versions, not guessed pins.
2. Verify registry provenance, maintenance, licenses, advisories and transitive/native dependencies.
3. Validate Node/pnpm constraints and Linux AMD64 native binaries against deployment OS/libc.
4. Pin direct runtime versions and lockfile; keep frozen installs in CI.
5. Run integration/build tests before replacing existing dependencies. Do not mix Zod major versions
   or incompatible AI SDK/provider generations without adapter tests.
6. Keep optional libraries out of diner bundles; add only when the implementing slice needs them.

## Primary references

- [Drizzle PostgreSQL](https://orm.drizzle.team/docs/get-started-postgresql)
- [BullMQ production](https://docs.bullmq.io/guide/going-to-production)
- [Better Auth installation](https://better-auth.com/docs/installation)
- [Auth.js migration guidance](https://authjs.dev/getting-started/migrate-to-better-auth)
- [shadcn components](https://ui.shadcn.com/docs/components)
- [AI SDK providers](https://ai-sdk.dev/providers/ai-sdk-providers)
- [R2 API](https://developers.cloudflare.com/r2/api/)
- [Turnstile verification](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [Pexels API](https://www.pexels.com/api/documentation/)

Verify these sources again when implementing; documentation links are not version guarantees.
