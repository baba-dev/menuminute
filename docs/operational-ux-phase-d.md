# Operational workspace clarity — Phase D

MenuMinute keeps the existing service-area permissions and routes; descriptions supplement names without changing gates.

| Destination | Primary action | Navigation name |
| --- | --- | --- |
| Orders | Review and accept guest requests; track live orders and history | Orders |
| Point of Sale | Record counter sales, prepare bills and record cashier payments | Point of Sale (POS on mobile) |
| Kitchen | Prepare routed dishes, manage stations and complete preparation | Kitchen / Kitchen Setup |
| Dining floor | Monitor table activity and respond to guest calls | Dining floor |

The application surfaces concise descriptions in desktop and mobile navigation and uses matching explanatory copy across Orders, Point of Sale and Kitchen. Editorial headings and permissions remain unchanged. `Till` is retained only as an internal technical/search synonym or where it refers literally to a physical cash drawer.

## Regression contract

- No changes to route authorization, payment, order acceptance, kitchen readiness or financial activation.
- Sidebar and bottom bar use `nav-model.ts` as their single source of truth; unavailable actions retain the same gate behavior.
- A small-screen navigator sees **POS**, not **Till**, and a screen-reader user hears a description of operational navigation.
