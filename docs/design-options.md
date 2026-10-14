# MenuMinute — Five design directions for user selection

Status: **none selected**. The user will choose the visual system. This comparison supersedes any assumption that Olive & Linen was finalized.

The ten-page companion brochure, **MenuMinute-Design-Collection.pdf**, shows actual embedded fonts and representative owner, guest and kitchen mockups in Light and Dark. It also compares controls, layouts and appearance behavior. Illustrations are placeholders, not production screenshots.

## Quick comparison

| Option            | Character                      | Typography                   | Layout                               | Card radius |
| ----------------- | ------------------------------ | ---------------------------- | ------------------------------------ | ----------- |
| A — Olive & Linen | Editorial hospitality          | Fraunces + DM Sans           | Editorial sections + split editor    | 10px        |
| B — Ember & Stone | Warm, bold and rounded         | Plus Jakarta Sans + Manrope  | Rounded bento + visual item cards    | 18px        |
| C — Paper & Plate | Minimal, precise and neutral   | Inter, with distinct weights | Compact table + structured list      | 4px         |
| D — Citrus Grid   | Graphic, geometric and digital | Space Grotesk + DM Sans      | Modular grid + command toolbar       | 8px         |
| E — Coastal Calm  | Airy, refined and reassuring   | Lora + Source Sans 3         | Airy sidebar + balanced split panels | 12px        |

## Required across all options

Light / Dark / System throughout marketing, pricing, authentication, onboarding, guest menus/cart/tracking, owner tools, settings, overlays and kitchen. Persist the device preference; follow the system until explicitly overridden; avoid theme flash. No light-only guest/marketing or dark-only kitchen policy. See [shared design contract](design-system.md).

All palettes below are exploratory. The brochure's 60 key text/background contrast pair checks passed 4.5:1; final components, focus/boundary contrast, status colors and every state still require validation. Border swatches are decorative and are not automatically suitable input boundaries. Shared semantic status meanings stay independent of brand colors.

## A — Olive & Linen

**Editorial hospitality.** Quiet confidence. Food and stories take the lead.

- Typography: Fraunces + DM Sans; body 16/24, controls 14/20, editorial 40–64 and kitchen 18–24px targets.
- Layout: Editorial sections + split editor.
- Components: Thin rules and generous linen space; Small olive actions; terracotta detail; Food rows, editorial menu headings. 10px card radius is a candidate, not a global rule.
- Best fit: Independent cafés, bakeries and restaurants with a personal story.
- Trade-off: Serif headlines need restraint on dense operational screens.

| Candidate semantic role | Light     | Dark      |
| ----------------------- | --------- | --------- |
| Canvas                  | `#F7F5EE` | `#151B16` |
| Surface                 | `#FFFFFF` | `#222B23` |
| Text                    | `#232820` | `#F3F5EE` |
| Muted text              | `#62685C` | `#B8C3B2` |
| Primary action          | `#465C35` | `#C0D7A6` |
| On-primary text         | `#FFFFFF` | `#1F2B19` |
| Accent surface          | `#E4EAD9` | `#303D2E` |
| Decorative border       | `#D9DDCF` | `#465344` |
| Editorial detail        | `#A34F35` | `#EDAA8B` |

## B — Ember & Stone

**Warm, bold and rounded.** An inviting storefront with energetic, tactile controls.

- Typography: Plus Jakarta Sans + Manrope; body 16/24, controls 14/20, editorial 40–64 and kitchen 18–24px targets.
- Layout: Rounded bento + visual item cards.
- Components: Soft surfaces and 18px cards; Bold rounded sans-serif headings; Prominent action buttons and pill tabs. 18px card radius is a candidate, not a global rule.
- Best fit: Casual dining, street-food brands and expressive quick-service venues.
- Trade-off: Large cards consume more space; keep editing lists compact.

| Candidate semantic role | Light     | Dark      |
| ----------------------- | --------- | --------- |
| Canvas                  | `#FAF7F3` | `#1D1714` |
| Surface                 | `#FFFFFF` | `#2C221D` |
| Text                    | `#2A211D` | `#FFF4ED` |
| Muted text              | `#72645B` | `#D1B9AA` |
| Primary action          | `#B44720` | `#FFB18A` |
| On-primary text         | `#FFFFFF` | `#3C1D0E` |
| Accent surface          | `#F8E6DB` | `#493023` |
| Decorative border       | `#E8DCD2` | `#6F5140` |
| Editorial detail        | `#80562A` | `#E5C080` |

## C — Paper & Plate

**Minimal, precise and neutral.** Strong hierarchy. Efficient work. Almost no decoration.

- Typography: Inter, with distinct weights; body 16/24, controls 14/20, editorial 40–64 and kitchen 18–24px targets.
- Layout: Compact table + structured list.
- Components: 4px corners, crisp separators; Monochrome controls, quiet accents; Compact rows with visible metadata. 4px card radius is a candidate, not a global rule.
- Best fit: Owners who prioritize speed, clarity and a neutral restaurant canvas.
- Trade-off: Needs excellent spacing and food imagery to avoid feeling generic.

| Candidate semantic role | Light     | Dark      |
| ----------------------- | --------- | --------- |
| Canvas                  | `#F7F7F5` | `#111513` |
| Surface                 | `#FFFFFF` | `#1D2320` |
| Text                    | `#202321` | `#F2F5F1` |
| Muted text              | `#626760` | `#B9C3B9` |
| Primary action          | `#252C27` | `#E5EDE1` |
| On-primary text         | `#FFFFFF` | `#182019` |
| Accent surface          | `#E9ECE6` | `#2C352E` |
| Decorative border       | `#D6DCD3` | `#506053` |
| Editorial detail        | `#735D41` | `#D5BC94` |

## D — Citrus Grid

**Graphic, geometric and digital.** A fresh digital identity with confident graphic rhythm.

- Typography: Space Grotesk + DM Sans; body 16/24, controls 14/20, editorial 40–64 and kitchen 18–24px targets.
- Layout: Modular grid + command toolbar.
- Components: Geometric type and modular tiles; Citrus highlights with dark text; Visible toolbar and strong grid alignment. 8px card radius is a candidate, not a global rule.
- Best fit: Modern food brands, cloud kitchens and younger digital-first operators.
- Trade-off: Citrus stays an accent; large neon areas can tire busy teams.

| Candidate semantic role | Light     | Dark      |
| ----------------------- | --------- | --------- |
| Canvas                  | `#F6F8ED` | `#12180F` |
| Surface                 | `#FFFFFF` | `#202B19` |
| Text                    | `#202720` | `#F0F7E8` |
| Muted text              | `#626C58` | `#B7C7A7` |
| Primary action          | `#3F5D1C` | `#C4F264` |
| On-primary text         | `#FFFFFF` | `#223307` |
| Accent surface          | `#E7F2C6` | `#354725` |
| Decorative border       | `#CED9BA` | `#526942` |
| Editorial detail        | `#B8EC48` | `#C4F264` |

## E — Coastal Calm

**Airy, refined and reassuring.** A relaxed service experience with clear, polished structure.

- Typography: Lora + Source Sans 3; body 16/24, controls 14/20, editorial 40–64 and kitchen 18–24px targets.
- Layout: Airy sidebar + balanced split panels.
- Components: Teal controls with warm brass detail; Airy grouped cards and 12px corners; Balanced reading and action zones. 12px card radius is a candidate, not a global rule.
- Best fit: Bistros, premium cafés and venues seeking a calm, versatile identity.
- Trade-off: Keep decorative serif use to headings; tables remain sans serif.

| Candidate semantic role | Light     | Dark      |
| ----------------------- | --------- | --------- |
| Canvas                  | `#F2F8F7` | `#102322` |
| Surface                 | `#FFFFFF` | `#193532` |
| Text                    | `#193330` | `#EFF8F5` |
| Muted text              | `#57716C` | `#ACCCC3` |
| Primary action          | `#126C65` | `#83D9C7` |
| On-primary text         | `#FFFFFF` | `#102D25` |
| Accent surface          | `#DDF0EB` | `#264B43` |
| Decorative border       | `#C8DFD9` | `#477B6C` |
| Editorial detail        | `#A26A32` | `#E4BF86` |

## Choose a direction

Select A, B, C, D or E, or specify an intentional hybrid such as typography A + layout C + colors E. No candidate will be applied automatically.

After selection: refine complete semantic pairs and component states; make a focused guest/owner/kitchen prototype; then implement the accepted system app-wide in both modes. The starter orange/Inter UI remains unchanged by this documentation work.

All font families shown in the brochure were embedded for accurate comparison. Production will bundle only used scripts/weights with sensible fallbacks. Choose appropriate Devanagari support for Hindi independently of the Latin editorial family.
