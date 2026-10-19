# Global public footer

`PublicFooter` is in `src/components/marketing/footer/` and belongs on the homepage, pricing, demo, login, register, and informational routes. Do not mount in root layout: merchant dashboards and customer-facing restaurant menus must remain free of marketing navigation.

| Area           | Current state                                                                                                                                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Brand          | Approved horizontal dark logo and square icon; links to Menu Minute and BabaBuilds                                                                                                                               |
| Explore        | Live feature anchor, pricing, demo and register; upcoming ordering page marked Soon                                                                                                                              |
| Ecosystem      | Live links to bababuilds.com and erp.bababuilds.com; other company pages are placeholders                                                                                                                        |
| Resources      | Help, FAQ, guides, integrations and status are placeholders; status does not imply live monitoring                                                                                                               |
| Legal          | Privacy has a distinct noindex legal-review draft; account deletion is a contact-only noindex review page; TOS, cookies, refund, accessibility and security remain unpublished placeholders. Do not claim store readiness before tested in-app deletion and data-processing inventory approval                                                             |
| Badges         | Menu Minute original product-principle artwork, explicitly not independent certifications                                                                                                                        |
| Payment visual | `public/brand/footer/payment-options-preview.svg` illustrates Visa, Mastercard and UPI; all marked planned / not currently available. Do not claim acceptance until gateway activation is independently verified |
| Copyright      | Exact owner-approved 2026 text                                                                                                                                                                                   |

Maintain responsive 375px layout, keyboard focus, clear external-link behavior, contrast and reduced-motion support. Test coverage: `tests/e2e/public-footer.spec.ts`.
