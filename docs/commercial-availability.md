# Commercial availability: what is sellable, and how the site decides

Decision record dated **6 November 2026**. It answers one question for every public surface: _what may a
visitor be told they can buy today?_ Prices and limits are unchanged and live in
`src/modules/billing/catalog.ts` and `src/modules/plans/catalog.ts`; this document is about
**availability**, not price.

## The rule

> A public page may only offer what this deployment can complete. Availability is read from the same
> switches checkout enforces, never typed into copy.

This follows [product direction](product-direction.md) ("do not label paid plans as available before
their workflows and billing pass acceptance") and the [Razorpay rollout](operations/razorpay-billing.md)
("paid checkout is off by default"). Because the repository cannot see the production environment, the
pricing page reads the switches **per request** (`src/modules/plans/sale-facts.ts`), so it is correct
whichever way an operator has them set, and corrects itself the moment one is flipped. No redeploy or
copy change is needed.

## Decision

| Plan                | Price (INR / USD)                 | Sellable today?                                                             | Pricing-page button                                                                                              |
| ------------------- | --------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Free**            | ₹0 / $0                           | **Yes.** Live and verified. 20 dishes, 2 QR codes, 100 guest orders a month | Get started free → `/register`                                                                                   |
| **Ordering**        | ₹119 / $5                         | **Only when Ordering checkout is open** (see _Switches_)                    | Open: Get Ordering → `/billing?plan=ordering`. Closed: Start free for now → `/register`                          |
| **Kitchen Pro**     | ₹499 flat, up to 10 outlets / $20 | **Only when Kitchen Pro checkout is open;** otherwise by request            | Open: Get Kitchen Pro → `/billing?plan=kitchen_pro`. Closed: Request early access → `/contact?topic=kitchen-pro` |
| **Dedicated**       | ₹30,000 / $3,000 on-prem          | By contract only                                                            | Talk to us about Dedicated → `/contact`                                                                          |
| **USD plans** (any) | $5 / $20                          | **No.** No USD checkout exists; enquiries only                              | Ask about USD billing → `/contact`                                                                               |

"Free for now" is a real offer, not a consolation: Free already accepts guest orders up to the monthly cap,
and (with the owner switches from migration 0086 on) a new owner gets an automatic 14-day Ordering trial the
first time they publish. Those are implemented and on by default in code; they are described here but the
public pricing page does not promise the trial, because the switch is an owner setting stored in the database
that a public page cannot read.

### Switches

A visitor is shown a purchase button only when all of these hold (computed by `publicSaleFacts()`):

| Plan        | Requires                                                                                     |
| ----------- | -------------------------------------------------------------------------------------------- |
| Ordering    | `RAZORPAY_ENABLED=true`, `RAZORPAY_PLAN_ORDERING_ID`, not `COMMUNITY_EDITION`                |
| Kitchen Pro | everything for Ordering, plus `RAZORPAY_KITCHEN_ENABLED=true` and `RAZORPAY_PLAN_KITCHEN_ID` |

Kitchen Pro checkout also needs the database release approval (`app_private.kitchen_commerce_enabled()`,
operated from `/admin/kitchen`). A public page has no signed-in actor, so it cannot read that. `/billing` and
the checkout route both enforce it and show "Kitchen Pro checkout is not available on this deployment yet", so
the only possible mismatch is a signed-in owner reading an honest explanation, never a failed charge.

If the switches cannot be read at all, the page falls back to "nothing for sale" (`NOTHING_FOR_SALE`).

## What each visitor experiences

| Situation                      | Journey                                                                                                                                                         |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New visitor, any plan          | Pricing → `/register` (Free, or Ordering while checkout is closed) → verify email → onboarding → publish menu                                                   |
| Anonymous, checkout open       | Pricing → `/billing?plan=…` → redirected to `/login?next=/billing?plan=…` → sign in, or **Create an account** (keeps `next`) → back to that plan's Billing card |
| Signed-in owner, checkout open | Pricing → Billing, plan highlighted → Upgrade → Razorpay checkout                                                                                               |
| Kitchen Pro, checkout closed   | Pricing → `/contact?topic=kitchen-pro` → pre-filled email. The team enables it with an operator grant (Admin → Payments → Grant studio)                         |
| USD / Dedicated                | Pricing → `/contact`                                                                                                                                            |

An unknown `plan` or `topic` query value is ignored, never echoed into a link, page or mail subject.

## Evidence and what is not verified

Verified from the live site on 2026-11-06: the pricing page renders, prices match the catalog, readiness is
healthy and the deployed SHA matched `main`. **Not verified, because it needs production access:** the actual
values of `RAZORPAY_*`, whether the provider plans and webhook are live, and whether the Kitchen release flag is
on. Do not infer them from source. Check `/admin/features` (superadmin) or fetch the page and read the state:

```bash
curl -s https://food.bababuilds.com/pricing | grep -o 'data-plan="[a-z_]*" data-sale-state="[a-z_]*"'
```

## Opening paid checkout (operator checklist)

Do these in order; the pricing page changes by itself at the end.

1. Provider side and database role per [Razorpay billing](operations/razorpay-billing.md): `menuminute_billing`
   role, ₹119 and ₹499 monthly plans, signed webhook, test/live keys not crossed.
2. Payment and cancellation smoke tests in the provider sandbox; refund/reversal procedure tested.
3. Legal gates in [legal README](legal/README.md): India-qualified review of the cancellation notice, registered
   address and grievance details, renewal/tax terms shown at checkout.
4. Set `RAZORPAY_ENABLED=true` (Ordering opens). Confirm with the `curl` above: `ordering` becomes `checkout`.
5. Kitchen Pro only after its own gates (issues #76 and #77, commercial release in `/admin/kitchen`): set
   `RAZORPAY_KITCHEN_ENABLED=true` and `RAZORPAY_PLAN_KITCHEN_ID`. `kitchen_pro` becomes `checkout`.
6. To pause sales during an incident, set `RAZORPAY_ENABLED=false`; both buttons revert at once.

## Homepage "AVAILABLE NOW" badges (decided: keep)

The homepage sections for ordering, the Kitchen Pass, service worlds and the journey link say **"AVAILABLE NOW"**
with prices. They are static and pinned by `tests/e2e/phase4-marketing.spec.ts` and the section specs. They are
only accurate for _buying_ while checkout is open.

**Decision, 6 November 2026 (owner):** production has both Ordering and Kitchen Pro checkout enabled, so the
badges are accurate and stay unchanged. Revisit this if either switch is turned off (for example
`RAZORPAY_ENABLED=false` during a provider incident): the pricing page reverts by itself, but these static
badges will not. Options at that point are to reword them (for example "TRY FREE" or "BY REQUEST", updating the
specs) or make the sections read `publicSaleFacts()`.
