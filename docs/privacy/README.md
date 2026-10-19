# Privacy Ledger — legal-review delivery and release gate

Status: DRAFT FOR COUNSEL AND OPERATIONS. Prepared 19 October 2026. Do not merge, enable indexing, label the footer link published, or use /privacy as an app-store privacy URL until the release gates below are satisfied. Written approval of product direction is not evidence that every control is deployed.

## Approved identity and operating decisions

- Operator: BabaBuilds, Indian sole proprietorship; published locality Pilani, Rajasthan, India.
- Contact: admin@bababuilds.com. Verify whether a complete postal/grievance address and jurisdictional representative are needed.
- No sale of personal information. Personalized advertising only a possibility, **not** an active use.
- Potential analytics: Google Analytics or a comparable service, with vendor-specific data inventory and lawful consent/choice before activation where required.
- Service messages and opt-in promotion have separate preferences; there is no verified marketing-management UI in this PR.
- Infrastructure includes Oracle-hosted VPS and Cloudflare; review configuration, region and other active subcontractors.
- When an AI feature is enabled, the chosen workflow may automatically process its permitted input. Actual outbound AI provider and data-processing terms must be verified at activation.
- Web, PWA, and future native Android/iOS; worldwide scope. Business owners/admins 18+; no child-targeting.
- Guest QR reading without a platform account; minimize order details. Where a restaurant controls its own diner contact data, identify processing roles in merchant documentation.

## Current code evidence and limitations

| Function            | Checked source                                                   | Privacy relevance                                                                                                   |
| ------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Account and session | `src/db/schema/users.ts`, `src/lib/auth.ts`                      | Name, email, emailVerified, credential storage, sessions, IP/user-agent, limited request rate records               |
| Organization access | `src/db/schema/tenancy.ts`                                       | Members, permissions and multi-outlet roles                                                                         |
| Restaurant setup    | `src/db/schema/restaurants.ts`                                   | Public and staff-facing business information                                                                        |
| Guest ordering      | `src/db/schema/orders.ts`, `src/app/api/public-orders/route.ts`  | Name, phone, notes, order snapshots, tracking token                                                                 |
| Images              | `src/db/schema/media.ts`, `src/modules/media/product-service.ts` | Source image, derivative, provenance, upload ownership; actual storage must be reconciled                           |
| Audit               | `src/db/schema/audit.ts`                                         | IP, user agent, before/after details; confirm redaction and retention                                               |
| AI                  | `src/modules/ai/service.ts`                                      | Existing service interface is scaffold; do not advertise a specific third-party AI provider as active on this basis |
| Commercial          | `src/db/schema/billing.ts`                                       | Subscription status, but not proof of a live payment gateway                                                        |

The page uses an original inline SVG, scoped Ink & Ember styling, sticky table of contents, semantic anchored sections, a theme toggle, reduced-motion animation, mobile navigation and print styles. It is deliberately noindex and visibly marked review draft.

## Proposed retention schedule — NOT an assertion of implemented expiry

These are targets to validate with Indian and each applicable market's recordkeeping obligations, security needs, actual data flows, production deletion jobs, backups, and counsel. Do not copy numbers into the public policy before they are verified.

| Data                                                | Initial proposed rule                                                                                                            | Conditions                                                                                            |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Active accounts and membership                      | While account/merchant relationship is active                                                                                    | Provide export, verified closure, identity and delegated-role handling                                |
| Closed accounts                                     | Remove identifying account data within 30 days after approved verified request where no exception applies                        | Handle shared organization ownership, external providers and pending legal holds                      |
| Orders and associated financial records             | Separate restaurant transaction retention schedule; default design hypothesis 7 years where applicable, otherwise lawful minimum | Validate tax/accounting obligations country by country; minimize diner phone/notes sooner when lawful |
| Optional guest contact and nonessential order notes | Default design hypothesis 90 days after terminal order                                                                           | Retain only as long as merchant's lawful need; separate from mandatory transaction amount/order trail |
| Unused media originals / failed uploads             | Default design hypothesis 30 days after rejection or orphan identification                                                       | Exclude referenced/public approved derivatives; verify restore dependencies                           |
| AI inputs and temporary artifacts                   | Default design hypothesis 30 days or less after completion unless retained by user request                                       | Verify vendor-side retention and model-training terms, exceptions for approved published output       |
| Security and operational logs                       | Default design hypothesis 90 days; longer for a documented incident/hold                                                         | No raw secrets, passwords, customer notes in logs; validate data security and tax exceptions          |
| Backups                                             | Default design hypothesis rolling 30 days                                                                                        | Verify actual Restic retention, encryption/access and restoration-time deletion replay                |
| Consent receipts and formal requests                | As needed to prove permissions and comply with relevant legal limitations                                                        | Restrict access and redact unnecessary submitted documents                                            |

## Publication and app-store blockers

1. Counsel approves operative identity, lawful processing/roles, worldwide targeting, lawful basis, data subject rights, the DPDP phased timeline, required postal contact/representatives, and retention schedule. Indian official DPDP Rules: https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf . Relevant major rules have 18-month phased commencement from the notification, so do not treat every provision as effective on the draft date.
2. Complete actual vendor inventory: Oracle hosting location and contracts, Cloudflare products, any third-party email, analytics, AI, logging, payments, push/SDKs; record data types, purposes, sub-processors, transfer locations, deletion and training terms, and contract / DPA / SCC where needed.
3. Verify all current cookies, browser localStorage, server signals and future SDKs; activate an appropriate consent/settings experience before nonessential tracking. Do not claim future advertising is presently used.
4. Implement / test in-app deletion (and native route if relevant), plus public online request/completion path; removal of personal and public UGC, organization co-ownership workflow, legal holds, provider cascade, backups, acknowledgement/completion and rejection appeal. **Current /delete-account is a contact-based draft, not store-compliant self-service.**
5. Implement category-specific retention and erasure jobs, export, separate marketing preferences, rights/grievance workflow. Do not use planned durations as actual durations before verification.
6. Confirm AI activation notices, consent/legal bases when appropriate, provider terms, sensitive material minimization, and prompt sanitization; account for automatic processing of an enabled feature.
7. Audit Android and iOS _built_ binaries and every SDK. Prepare Google Play Data safety and Apple App Privacy responses separately based on released build; camera, photo library, local notifications and location only on disclosed feature invocation, with platform permission purpose text.
8. Once approved: remove review banner, add effective date, set metadata `robots: { index: true, follow: true }`, remove footer `soon`, update placeholder links, audit read-time locale/contrast and verify external URL from outside a logged-in session. Obtain final approval on the exact production copy.

Official app-store sources:

- Google User Data and privacy policy https://support.google.com/googleplay/android-developer/answer/10144311
- Google account deletion https://support.google.com/googleplay/android-developer/answer/13327111
- Apple in-app account deletion https://developer.apple.com/support/offering-account-deletion-in-your-app/
- Apple app privacy https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy
- GDPR Articles 13–14 https://eur-lex.europa.eu/eli/reg/2016/679/oj

## QA checklist

- Review /privacy and /delete-account at 375px, 768px, desktop; no overflow or missing content.
- Ensure keyboard skip link, heading order, table-of-contents anchors and inline mailto work.
- Check dark/light theme, reduced motion, zoom, no JS reading fallback, and print.
- Check noindex until approval, and no assertions that a vendor/deletion job or security certification is deployed without evidence.
- Maintain public footer exactly once; no marketing footer in merchant dashboard or diner menu.
