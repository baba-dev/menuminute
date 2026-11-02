# Worldwide availability and commercial boundaries (issue #8)

**Owner direction recorded: 2026-11-03.** MenuMinute is intended for restaurants worldwide.
This approves the **geographic scope of product access**, not unreviewed tax rules,
foreign payment acquisition, fiscal invoicing, bank settlement or sanctions exemptions.

## Product behavior and currencies

- Merchants can set up an outlet in any country in the supported ISO 3166-1 list.
  Existing merchant country, currency, timezone, menus and order history are retained.
- A **new** onboarding draft may use the browser's locale and timezone as a suggestion.
  Restored server-owned drafts always win. Unmapped countries require the operator to
  explicitly select a pricing currency; a previous country's currency must not leak
  into the new selection.
- An outlet's supported ISO 4217 transaction currency is independent of the platform's
  INR subscription currency. Outlet-local prices must be confirmed by the merchant.
- Published menu quotes use integer minor-unit amounts and expose an explicit exponent.
  Examples of currency math (pre-tax; not statutory totals):

  | Currency | Display amount | Exact minor units | Fraction digits |
  | -------- | -------------: | ----------------: | --------------: |
  | JPY      |            120 |               120 |               0 |
  | INR      |         120.50 |             12050 |               2 |
  | USD      |         120.50 |             12050 |               2 |
  | OMR      |          1.250 |              1250 |               3 |

- Do not combine outlet-level totals in different currencies without an approved FX
  conversion and effective-rate policy. Historical orders retain their recorded currency.

## Revenue surface and activation boundary

| Stream                                 | Global product availability                                                                | Payment/legal limitation                                                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Free QR menus and published catalogues | Geographic access is approved                                                              | Must still follow laws and platform abuse rules                                                                                          |
| Merchant POS and internal receipts     | Existing non-fiscal flows continue                                                         | Staff-recorded external tenders do not prove settlement; internal receipts are not statutory invoices                                    |
| Guest ordering and Kitchen Pro         | Existing plan entitlements, rate limits, outlet rules and order state machines still apply | Region-specific food-sale taxes, mandatory receipts and guest policies require review; paid Kitchen commercial approval remains separate |
| SaaS Ordering/Kitchen subscriptions    | Current provider integration and INR plan catalogue remain unchanged                       | Cross-border cards require provider/account/issuer eligibility; no untested gateway switching or automatic global charges                |
| Dedicated/custom plans                 | Contact-led commercial availability                                                        | Contract, invoicing, tax and settlement are negotiated and reviewed separately                                                           |
| AI features                            | Existing consent, quota, budget and provider gates remain                                  | No automatic provider enablement or paid fallback                                                                                        |

The **platform charges** and a **restaurant's customer sales** are separate transactions
and separate tax/compliance responsibilities. Using a currency does not establish an
approved tax rate. There is no blanket worldwide zero-tax rule.

## Still outstanding for full global revenue

1. **Payments:** verify Razorpay international recurring-card eligibility for the
   actual merchant account and selected plans, payment methods, international buyer
   authorisation, refund/cancellation, settlement and webhook reconciliation in a
   controlled provider sandbox. INR plans remain the only live integration in source.
   Any later USD price or merchant-of-record path requires its own product decision,
   immutable billing ledger contract, tax handling and tests.
2. **Local tax and fiscal documents:** approve one country-specific fixture suite at a
   time. Include inclusive/exclusive price, tax category, fees, discounts, rounding
   for 0/2/3-digit currencies, retention, legally required merchant/buyer fields,
   refund/credit handling and applicable registrations. No statutory-invoice switch
   can bypass the existing database guard (see #226).
3. **Operational policies:** approve quote expiry, closing/no-show, pickup, cancellation,
   paid entitlement pauses/grace, privacy/retention and jurisdiction-specific controls.
   The server remains authoritative for pricing and permission checks.
4. **Legal/release evidence:** sanctions/provider coverage, effective Terms/privacy,
   appropriate tax and legal sign-off, real merchant negative fixtures, independent
   QA (#76) and rollout proof (#77). Do not infer legality from source CI.

## Acceptance and rollback

- Automated tests in `tests/worldwide-onboarding-money.test.ts` verify region hints,
  explicit currency selection for unmapped regions, precision and invalid amounts.
  Existing quote and entitlement suites remain required.
- This source change has **no SQL migration**, no provider calls, no new feature flag,
  no billing price change, no legal/fiscal activation and no production deployment.
- Rollback is a normal application-release revert; saved merchant country/currency
  choices remain durable. Do not revert the database or rewrite order snapshots.
- Before PR acceptance: run `pnpm format:check`, `pnpm typecheck`,
  `pnpm lint`, `pnpm test`, and relevant onboarding/browser suites using the
  project's native ARM64 CI. Record exact SHA and actual results.
- Issue #8 remains open for the explicit policy decisions above; code completion is
  not their approval.

Related: [approved worldwide scope](product-requirements.md),
[currency and organization decisions](decisions.md),
[subscription rollout](operations/razorpay-billing.md),
[statutory finance follow-up](https://github.com/baba-dev/menuminute/issues/226).
