# USD subscription price book and activation path

**Price book approved for planning by the owner on 2026-11-03.**
USD subscription prices are **50% higher** than the INR prices after converting
at the frozen reference of **INR 95 = USD 1**. They are rounded once to a
cent and **do not automatically float with FX changes**. Any future repricing
requires versioned plan IDs, notice and renewal/grandfathering decisions.

| Plan | INR monthly | USD monthly | USD minor units |
| --- | ---: | ---: | ---: |
| Free | ₹0 | $0 | 0 |
| Ordering | ₹119 | $1.88 | 188 |
| Kitchen Pro | ₹499 | $7.88 | 788 |
| Dedicated (by contract) | ₹30,000 | $473.68 | 47368 |

USD amounts are **listed but not yet payable**. The current Razorpay
implementation is INR-only at the checkout route, webhook verification and
restricted billing database grant writer. In particular, it hardcodes INR for
subscription charge minimum verification, refund currency, entitlement billing
currency and resumed subscription grants. Switching a currency selector
cannot safely circumvent those controls.

## Live USD payment acceptance: planned follow-up

Razorpay documentation supports international-currency subscription plans via
card for eligible merchant accounts, settled in INR. The operator must verify
its account supports this specific flow. Subscriptions cannot be assumed
active solely because plans exist in the provider dashboard.

1. Create **two distinct, immutable USD monthly provider plans**, for
   USD 1.88 and USD 7.88, and configure their USD plan IDs separately from
   the existing INR plan IDs. Dedicated stays contract-only, not a self-serve
   plan. Verify card-method eligibility, permitted payment countries, account
   KYC, taxes, fees and settlement rules.
2. Add an explicit `billingCurrency: "INR" | "USD"` choice to the
   authenticated billing page. Keep outlet menu currency completely separate.
   Do not infer billing country from an IP address or browser timezone.
3. Store the product, original provider plan ID, **currency**, amount minor,
   catalog version and effective rate book with every checkout intent,
   subscription and verified payment. Current INR subscriptions must retain
   their existing provider plan IDs and renewal prices. Backfill historic
   subscriptions with **INR** in an append-only migration.
4. Version the checkout reservation key by organization, plan **and currency**;
   persist a checkout attempt and reject currency substitution or stale plan
   IDs. Reject incomplete provider configuration **before** opening checkout.
   Keep only the verified provider-owned subscription id as a source of truth.
5. Check subscription webhook HMAC, plan ID, exact **USD currency**, captured
   amount, valid billing interval, recorded reservation and replay/duplicate
   protection **before** the restricted billing writer grants entitlements.
   Validate full and partial USD refunds by the original captured currency,
   preserve provider settled INR separately, and keep renewal/resume windows
   reconciled. An existing INR webhook cannot approve a USD transaction.
6. Cover cancellation, pause/restart, plan upgrade (Ordering → Kitchen Pro),
   no double billing, mixed-currency plan changes, partial/full refunds,
   retries, lost HTTP responses and order-drain behavior. Maintain the
   existing Kitchen commercial release gate independently of currency.
7. Add provider sandbox acceptance, test live international card
   authorization/renewal/settlement where approved, run CI and require
   deployment/operator sign-off before setting a default-off USD billing
   enable flag. **No USD payment authorisation is enabled by the catalog PR.**

Current pricing UI exposes a query-driven INR/USD price comparison on
`/pricing`. INR remains the only automated checkout, and USD paid CTAs
direct customers to contact the business until an integrated billing
migration and real provider validation are complete.

## Rollback and compatibility

This price-book-only change adds **no database migration**, no secrets, no
new provider calls and no payment or financial API changes. Rolling back the
UI/catalog commit does not change existing subscriptions or captured charges.
The later payment-support project requires append-only schema changes,
staged server migrations and a replay-safe rollback that disables *new* USD
checkouts but continues to honor verified existing USD subscriptions.
Review [Razorpay billing operations](razorpay-billing.md),
[pricing and quotas](../plans-and-limits.md),
[worldwide scope issue #8](https://github.com/baba-dev/menuminute/issues/8)
and [tax configuration plan](../tax/merchant-tax-configuration-plan.md).
