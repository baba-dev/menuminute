# Workspace shell and navigation

Status: **implemented in one PR.** Scope is the signed-in merchant workspace shell (`src/app/(dashboard)`): navigation, command palette, topbar, mobile bar and notifications. It follows the [design system](design-system.md) and the [feedback and motion contract](feedback-and-motion.md). No authorization, order, payment or kitchen state machine changes.

## What shipped

| Area                | Behaviour                                                                                                                                                                                                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Grouped sidebar     | Overview, then **Run service** (Orders, Point of Sale, Kitchen, Dining floor), **Menu** (Menu Studio, QR codes), **Insights** (Reports), **Admin** (Organization, Settings). Destinations the plan or role does not include collapse into an **Add-ons** disclosure with a plain hint. |
| Mobile bottom bar   | Orders, Till, Kitchen, Floor and **More**, filtered by what the user can use. A menu-only outlet is back-filled with Overview / Menu so the bar is never nearly empty. More holds everything else, plus Search and Notifications.                                                      |
| Command palette     | `Ctrl/Cmd+K` or the topbar button. Pages, actions ("Open till", "Add a dish"), dishes ("Mark X sold out" / "Restore X"), orders by number, tables, and an "Ask Ember" hand-off.                                                                                                        |
| Topbar              | Search, **+ New** menu, **till chip**, **connection and last-sync** indicator, **notification bell**.                                                                                                                                                                                  |
| Notification centre | One drawer: status, aggregated alerts, and the single sound and mute control.                                                                                                                                                                                                          |
| Dining floor page   | `/dashboard/floor`: the tables and guest-request panels that were only an overview widget, so the bar, sidebar and palette have somewhere to go.                                                                                                                                       |

## Decisions

| Question                        | Decision                                                                                                                                                                                                                    | Why                                                                                                                   |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Where does "Floor" go?          | New `/dashboard/floor` page reusing the existing panels.                                                                                                                                                                    | There was no standalone page.                                                                                         |
| What is "Till open · £312"?     | `Till open · <expected cash>`, labelled "expected cash, not counted". Hidden for roles without till access or when unreadable.                                                                                              | The ledger knows opening float + cash taken - cash refunded, not a drawer count. Never presented as verified revenue. |
| Sound and mute                  | One preference `menuminute.sound.v1` (`enabled`, optional `mutedUntil`). The Orders, Kitchen, Kitchen-intake and per-outlet POS switches stay as shortcuts but read and write it. Old keys are migrated once, then removed. | Four separate keys with four value formats.                                                                           |
| Double chimes                   | The shell chimes for new orders and guest requests only on pages that do not already chime for their own events (`pageHasOwnAudio`). It still announces to screen readers everywhere.                                       | Orders, POS and Kitchen already play their own sound.                                                                 |
| Menu-only outlets on the bar    | Back-filled to at least three destinations.                                                                                                                                                                                 | Orders, Kitchen and Floor are unavailable there.                                                                      |
| Ember in the palette            | The palette only **opens the assistant with the question pre-filled** (`mm:ember-ask`). Nothing is sent until the person presses Send.                                                                                      | Keeps model use, budget and audit inside the existing assistant pipeline.                                             |
| Extending `DashboardNavigation` | Not extended. Extra flags (`menuWrite`, `outletManage`) come from a separate `shellCapabilities()`.                                                                                                                         | The existing role-matrix test pins that contract exactly.                                                             |

## Architecture

- **`nav-model.ts`** (pure): the one list of destinations and their availability. The sidebar, bottom bar and palette all derive from it, so the rules cannot drift. It preserves the existing gating exactly (ordering needs the entitlement **and** `orders.read`; the kitchen is usable when operational or in setup and reads "Kitchen Setup" until live; unknown capabilities are "unknown", never "not enabled").
- **`GET /api/dashboard/shell`**: one permission-checked poll (30 s, paused while the tab is hidden) for the till chip, notifications and connection state. Sections are `ready | restricted | unavailable` and isolated: a failing source never hides the others, and an unavailable read is never shown as zero.
- **`GET /api/dashboard/palette`**: an index of names, numbers and states (no customer names, phones or notes), fetched once per open (cached 60 s) and filtered in the browser. No request per keystroke.
- **`WorkspaceShellProvider`**: owns polling, connection state, the chime on genuinely new arrivals, the `Ctrl/Cmd+K` shortcut, and the open state of the palette, drawer and More sheet.
- **Alerts are derived, not stored**, so they cannot outlive the situation. A source that is unavailable produces an explicit notice, so silence is never read as "all clear". A source the user has no permission for is simply absent.
- Dish toggles in the palette reuse the existing `menu/quick-availability` endpoint and its database permission check (`orders.prepare` or `menu.write`).

## Accessibility

- Palette is a real combobox + listbox (`aria-activedescendant`, `aria-selected`, grouped options, result-count announcement). Focus returns to whatever opened it (see below).
- The bottom bar is a `nav` landmark. Visible labels are short ("Till"); accessible names stay full ("Point of Sale", "Kitchen Setup", "Orders, 3 waiting").
- Status is never colour alone: connection, till, alert severity, dish availability and table state all carry an icon and a word.
- 44 px minimum targets, safe-area insets, reduced motion honoured.

## Problems found while building, and how they were fixed

- **Provider closed the palette on first render.** The "close sheets when the page changes" effect also ran on mount. It now reacts only to an actual path change.
- **Focus was lost when a controlled sheet closed.** Radix returns focus via its `Dialog.Trigger`; the palette, drawer and More sheet have none. A small `useReturnFocus` hook restores it.
- **`RouteFocus` landed on a transient loading heading.** Pages with a `loading.tsx` that has its own `<h1>` lost focus when the real page replaced it. The heading is now followed while the page settles, but only while the person has not moved focus.
- **A permission error surfaced as an outage.** `kitchenAvailableDishes` lets a raw Postgres `42501` through for an outsider. `section()` now treats it as `restricted`.

## Verification

See the PR description for exact commands and results.

## Rollback

Revert the PR. There is no migration and no server-side data to undo. The one lasting effect is in each person's browser: the old per-page sound keys were removed when they were carried into `menuminute.sound.v1`, so after a revert anyone who had sound on will find it off again and must re-enable it once. The new key is ignored by the old code. Sound is off by default, so the failure mode is silence, not unexpected noise.
