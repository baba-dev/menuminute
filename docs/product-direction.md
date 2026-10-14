# MenuMinute — Product direction

Direction baseline: 14 October 2026. Product scope is proposed in this PR; UI selection remains open following the user's clarification. No visual direction or tokens are approved.

## 1. Product promise

**A beautiful menu for every restaurant. A calmer service for every team.**

MenuMinute gives independent cafés, dhabas, bakeries and small restaurants a permanent QR menu at no subscription cost. Restaurants upgrade when they want guests to place orders and staff to manage service. Initial focus: Indian venues with roughly 5–30 tables, one outlet per initial workspace. The data model may support more; multi-outlet management is outside the first release.

Use **MenuMinute** consistently in code, documentation and interface copy. “Food Minutes” remains the project context, not a second customer-facing name. Domain and trademark clearance are still launch tasks.

The differentiator is the complete small-restaurant journey: a useful free menu, quick assisted setup, food-focused design, and reliable low-cost ordering that works on existing phones and kitchen tablets. These are positioning choices to test with pilots, not claims that competitors lack them.

## 2. What we recovered and what this PR resolves

| Decision                                                              | Provenance / treatment                                                     |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Permanent free QR menus; subscriptions for ordering and kitchen tools | Earlier user-selected commercial model                                     |
| Next.js, shadcn/ui, SQLite, Oracle free VPS                           | Earlier user-preferred stack; retained                                     |
| ₹149 Ordering and ₹299 Kitchen Pro per month                          | Earlier assistant proposals; retained as pilot price hypotheses            |
| Five visual directions in design-options.md                           | User will select; Olive & Linen is candidate A only                        |
| Typography                                                            | Different embedded font samples in the review brochure; no family selected |
| Pay at counter; diner online payments later                           | Earlier scope recommendation; retained for V1                              |
| One kitchen queue; multi-station routing later                        | Restores earlier scope after roadmap drift                                 |
| AI outside the ordering path                                          | Retained reliability requirement                                           |

## 3. Commercial model

| Tier        | Pilot price / outlet / month       | Included outcome                                                                                                            |
| ----------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Free Menu   | ₹0                                 | Published mobile menu, categories, item information, availability, restaurant branding, stable menu URL and downloadable QR |
| Ordering    | ₹149 hypothesis                    | Free features plus table QR, cart, guest order submission, staff acceptance, basic status tracking and order history        |
| Kitchen Pro | ₹299 hypothesis, includes Ordering | Kitchen ticket board, timers, sound opt-in, staff roles, reconnect recovery and basic operational summaries                 |

No MenuMinute percentage commission in this proposed model. No guest account required. Do not label paid plans as available before their workflows and billing pass acceptance.

The free menu must remain useful after a paid subscription ends: the existing printed menu QR continues to open the menu; order submission is disabled when entitlement expires. Retain order history according to the published retention policy. Allow active accepted tickets to be completed during a controlled expiry transition. Account deletion, abuse suspension and token rotation are explicit exceptions to continuity.

Free does not promise unlimited storage, AI calls or support. There is no proposed item-count paywall for the core menu. Define measured upload/storage limits before public launch and disclose them. Validate the ₹149/₹299 economics against support, storage, backups, billing costs and conversion. Tax treatment, annual pricing, trial/grace length and exact quotas remain commercial launch decisions; do not invent them in pricing UI.

Restaurant subscriptions: planned Razorpay integration, with signed, idempotent webhook processing and server-side entitlements. Guest payment: pay at counter in V1. Showing an order as Served must not imply payment received. Do not build a diner payment gateway into the first release.

## 4. Main journeys

### Restaurant owner

Register → restaurant details → create categories/items manually or review an import → preview mobile menu → publish → download QR → print and share.

Menu Studio is the primary workspace: category navigation, an efficient editable list and a live mobile preview on desktop. On mobile, switch explicitly between Edit and Preview. Owners can mark an item sold out quickly. Show saved, saving and failed states; never hide a failed save behind a success toast.

### Guest

Scan QR → verify restaurant/table → browse or search → choose required variant and quantity → review cart and total → submit → see server-issued confirmation and status.

Free menus stop at browsing. Ordering requires an active paid entitlement. Explain closed hours, ordering paused, sold-out items and invalid table links in plain language. Do not force phone collection for dine-in. Notes are requests, not guarantees about allergens or preparation.

The server validates restaurant, menu publication, table binding, opening/ordering state, entitlement, quantities, variants, availability and current prices. Preserve a cart after a validation failure and show what changed. Require explicit review if a price change affects the total. The confirmation is shown only after the transaction commits.

A printed table QR identifies a table; it is not proof that the guest is physically present. Use scoped ordering sessions, server rate limits and staff acceptance to reduce remote/spam orders. A public restaurant ID is not an authorization credential.

### Service and kitchen staff

New order → Accepted → Preparing → Ready → Served. Staff can reject an unaccepted order with a reason; cancellation of accepted work requires an authorized role and reason. Payment is a separate concern.

| UI label             | Existing schema value | Planned rule                                   |
| -------------------- | --------------------- | ---------------------------------------------- |
| New                  | `pending`             | Await staff acceptance; no preparation assumed |
| Accepted             | `confirmed`           | Staff committed to fulfillment                 |
| Preparing            | `preparing`           | Kitchen started                                |
| Ready                | `ready`               | Await service                                  |
| Served               | `delivered`           | Terminal fulfillment state                     |
| Cancelled / Rejected | `cancelled`           | Terminal; distinguish reason in event history  |

Preserve existing enum values unless a migration is explicitly justified. Only allow defined forward transitions; terminal states cannot silently reopen. Commit status changes and append-only events together. Check expected status/version so two devices cannot overwrite each other. The ordinary Ordering staff list supports the complete lifecycle; Kitchen Pro adds a specialized preparation interface, not the only way to finish orders.

## 5. Reliability contract

- Submission has a tenant-scoped idempotency key; retry returns the original result rather than another ticket.
- Snapshot item/variant names, price, currency and totals at acceptance of submission. Monetary math uses integer minor units with an explicit rounding policy.
- Tenant authorization applies to every read/write and every event stream. Guests receive only their own order through an unguessable scoped tracking token.
- Durable order/events storage is the source of truth. SSE improves delivery, with cursor/replay or a fresh snapshot on reconnect and polling fallback.
- Display connection state and last successful sync. A stale kitchen screen must never look live.
- Sound requires user interaction/permission where applicable and has a visible mute control. Sound alone never communicates a new order.
- PWA installation does not imply offline ordering. Cache only approved public read-only content; show offline/stale labels. Never cache private order APIs or automatically replay order submissions.
- Test restart, duplicate submit, concurrent status actions, expired plan, sold-out item, price change and lost connection before paid pilots.

## 6. AI and dish imagery

AI helps owners import, describe and translate menus. Owner review precedes publication; AI must not invent prices, ingredients, dietary assurances or allergens.

An image-less dish immediately receives a local category SVG. Background suggestions can offer approved reusable imagery, licensed Pexels results or optional generated illustrations. A suggestion is not automatically published. Preserve source, attribution and approval metadata. See [AI and media policy](ai-and-media.md).

R2 stores media; it is not an image generation API. NVIDIA trial access must not be assumed to permit production. No paid inference or quota overage is required for a restaurant's ordinary menu or order flow.

## 7. Exclusions and pilot success

Defer full POS, inventory, accounting, delivery fleet/aggregator integration, guest online payments, thermal printer integrations, multi-station routing, advanced reports, multi-outlet operations and conversational/voice ordering.

Pilot with 3–5 independent venues before broad launch. Measure time to first published menu, QR-to-menu success, order submission success, duplicate/lost tickets, reconnect recovery, staff training effort, weekly active venues and willingness to pay. A useful target is first menu publication within ten minutes using an existing menu; validate it rather than advertise it as a proven result.

Launch requires usable mobile flows, tenant-isolation tests, order integrity, backup restore evidence and measured load on the actual VPS. “Oracle free” is a hosting target, not an uptime or permanent capacity guarantee.

## 8. UI selection and appearance requirement

The user has explicitly not finalized UI tokens. [Five design candidates](design-options.md) remain open; obtain their design choice before making any one palette, typography or layout the implementation contract. A specific hybrid may be requested.

Light, Dark and System support is required throughout the app, including marketing, authentication, onboarding, guest menus/cart/tracking, owner tools, overlays and kitchen. This supersedes any earlier light-only guest/marketing or kitchen-only dark guidance. See [design system](design-system.md).
