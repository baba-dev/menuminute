# Phase E — accessibility and responsive regressions

## Improvements

- Persistent, accessible labels for optional guest name, phone and instructions. Placeholders remain hints, not the only identifying information.
- Expose the selected fulfillment option with `aria-pressed` inside a named button group.
- Make guest cart close, quantity and remove controls at least 44px high and wide.
- Allow guest detail fields and fulfillment choices to wrap naturally on narrow phones.
- Keep the cart keyboard trap aware of future select elements; preserve Escape and return focus.
- Use role-appropriate language and accessible descriptions for operational destinations without changing account permissions.

## Automated verification

The existing real ordering Playwright journey now checks label discoverability, the order-mode state, pickup-time reveal, 320/360/390/768/1024/1440px horizontal scrolling, and close-button touch targets before it submits a test order. This complements existing public-menu accessibility and mobile tests, dashboard shell tests, and full five-step onboarding coverage.

## Manual release checks

Before merging, verify keyboard-only navigation on desktop and a real mobile viewport, 200% browser text zoom, color contrast in light/dark themes, reduced motion, screen-reader announcement of fulfillment selection, and recovery after a dropped guest-menu connection. Automation is evidence for covered paths, not a certification of all WCAG criteria.

No changes to tax, billing, ordering permissions, server-side validation or payment capture are included.
