# MenuMinute User Operation Guide (English + Hindi)

A 62-page A4 guide for non-technical restaurant owners and staff, with English first and Hindi directly below on
every page. The built PDF is [MenuMinute-User-Guide.pdf](MenuMinute-User-Guide.pdf).

## Where things live

| What               | Where                                                                 |
| ------------------ | --------------------------------------------------------------------- |
| Text (EN + HI)     | `src/content/guide/content.ts`, `chapters.ts`, `help.ts`              |
| Screenshot list    | `scripts/guide/shots.mjs` (call-out targets included)                 |
| Screenshot capture | `scripts/guide/capture.mjs` → `public/guide/shots/*.webp, marks.json` |
| Chapter artwork    | `public/guide/art/chapter-00..12.jpg` ([prompts](artwork-prompts.md)) |
| Fonts (SIL OFL)    | `public/guide/fonts/`                                                 |
| PDF builder        | `scripts/guide/build-pdf.mjs`                                         |

## Rebuild

Screenshots come from the local demo tenant only (never production). Start the app with the demo tenant provisioned
(see [docs/demo.md](../demo.md)), then:

```bash
node scripts/guide/capture.mjs            # all screenshots, or pass shot ids
pnpm exec tsx scripts/guide/build-pdf.mjs # writes docs/user-guide/MenuMinute-User-Guide.pdf
```

The capture script sends an `x-real-ip` header because the demo entry limiter expects the reverse proxy's header.

## Editing rules

- Keep Hindi in everyday spoken wording; keep on-screen words (Menu, Publish, QR) in English.
- Document only what the demo screens show. Never invent allergen, dietary or product claims.
- Photo import accepts photos only; the app states that PDFs are not supported.
