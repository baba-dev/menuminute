# Mobile production-readiness analysis and plan

**Status: proposed plan, 10 November 2026. Nothing here is deployed or proven on a device.** Evidence labelled _verified_ was reproduced or observed in this analysis; everything labelled _unverified_ needs a real-device or Play Console check. This plan extends [`README.md`](README.md) (phases A–F) and [`device-test-matrix.md`](device-test-matrix.md); it does not replace the owner's Play gates in [#340](https://github.com/baba-dev/menuminute/issues/340).

## 0. Update 10 November 2026 (second pass): owner decisions and what is built

Owner decisions: the app launches **login, then Menu Studio**; **edge-to-edge** layout; **Bluetooth Classic and USB printers are a launch requirement**. An external audit (ChatGPT) was merged in below.

| Item                                                                       | Status in this branch                                                                                                                                                                       | Still open                                                                                            |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Launch redirect to localhost (L1)                                          | Fixed; deterministic contract check `scripts/android/verify-launch-contract.sh` fails on the live bug today                                                                                 | Deploy, then re-run it (must pass)                                                                    |
| Launcher test can pass without confirming the destination (audit P0, L2)   | Emulator smoke now screenshots, dumps the UI, taps through Chrome first-run, and fails on localhost/error pages (strict on manual/daily runs, warning on PRs); daily scheduled contract run | Run once green on the emulator (not run in this sandbox)                                              |
| Previous Java crash fixed but installed Play version unverified (audit P0) | Any `android/` change makes the release workflow build a new signed AAB candidate                                                                                                           | Owner uploads it to Internal Testing and installs it from Play                                        |
| Fullscreen TWA trust (audit P1, L3/L4)                                     | `assetlinks.json` is live (200) with one fingerprint; contract check validates shape and can pin `EXPECT_ASSETLINKS_SHA256`                                                                 | Owner confirms the fingerprint equals Play Console App signing key; device check shows no browser bar |
| Smoke uses a debug APK, not the Play-signed install (audit P1)             | Documented limitation; Play pre-launch report is the signed-install test                                                                                                                    | Run Play internal-track install and pre-launch report                                                 |
| Billing implemented but disabled (audit P1)                                | Unchanged on purpose                                                                                                                                                                        | Live purchase, restore, cancel, refund tests before enabling `PLAY_BILLING_ENABLED`                   |
| `main` not branch-protected (audit P1)                                     | Cannot be changed from here                                                                                                                                                                 | **Owner:** require PR review and the "Required CI quality gate" check on `main`                       |
| Play cookie lasts one year and affects regular Chrome (audit P1)           | Unchanged; the cookie only hides Razorpay checkout                                                                                                                                          | Test switching between the Play app and web billing; decide whether a session-length cookie is better |
| App Links only handle `/api/app/launch` (audit P2, L5)                     | Merchant routes now open in the app; diner `/m/...` stays in the browser                                                                                                                    | Verify notification URLs and OAuth callbacks on a device                                              |
| Thermal printing limited to BLE (audit P2)                                 | Bluetooth Classic + USB native bridge built ([`print-bridge.md`](print-bridge.md)); BLE and PDF fallback kept                                                                               | **Untested on real printers**; hardware matrix rows                                                   |
| Native launcher presentation (audit P2, N1-N4)                             | Adaptive + themed icon, splash, status/navigation bar colours, notification small icon, short label (`MenuMinute`)                                                                          | Visual check on Android 10/13/15/16 and large screens                                                 |
| Edge-to-edge (W3)                                                          | `viewport-fit=cover`, safe-area padding, status-bar scrim in installed mode, sticky headers below the inset                                                                                 | Device verification; per-screen audit of every fixed bottom bar                                       |
| Launch journey                                                             | `/app` sends signed-in merchants to Menu Studio; signed-out goes to login and returns                                                                                                       | New-account and no-outlet paths on device                                                             |

Nothing in the table marked "open" is proven by this branch. CI proves compilation, unit tests and the server contract only.

## 1. Verdict

The Android shell is a thin Trusted Web Activity (TWA) around the Next.js PWA. That is the right architecture for "one codebase, every Android phone and tablet": all UI, authorization, billing validation and ordering stay server-side. But today the app is **not launch-ready**:

1. **Launch is broken in production (P0, found and fixed here).** `GET /api/app/launch` redirected to `https://localhost:3100/app`.
2. The CI signal that says "Android is fine" ([run 42807375988](https://github.com/baba-dev/menuminute/actions/runs/42807375988)) only proves a signed AAB can be _built_. No check ever loads the app's real URL, so a green run says nothing about whether the app opens.
3. The native shell has none of the polish a store-quality app needs (adaptive/themed icon, splash, bar colours, notification permission, short launcher label, wide deep links).
4. Real-device coverage is zero. Device claims in the docs are explicitly "untested".

## 2. Incident: the app opens `localhost`

### What happens

| Step                                                                                                            | Evidence                                                               |
| --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| TWA starts at `https://food.bababuilds.com/api/app/launch` (`strings.xml`)                                      | _verified_ in source                                                   |
| Route returns `307 Location: https://localhost:3100/app`                                                        | _verified_ live: `curl -D- https://food.bababuilds.com/api/app/launch` |
| Chrome follows it off the verified origin, so the TWA drops to a Custom Tab (or an unreachable-host error page) | consequence; _unverified_ on device                                    |

### Root cause

`new URL("/app", request.url)`. systemd runs the standalone server with `HOSTNAME=127.0.0.1 PORT=3100` (`infra/systemd/menuminute-web.service`). Next 16 derives `request.url` from that listener, **not** from `Host` or `X-Forwarded-*`, even though Nginx forwards them correctly. Reproduced on a minimal Next 16.4.5 standalone server with the production env:

```text
GET /api/d   Host: food.bababuilds.com  X-Forwarded-Host: food.bababuilds.com  X-Forwarded-Proto: https
-> request.url = "https://localhost:3100/api/d"
GET /api/launch (NextResponse.redirect(new URL("/app", request.url)))  -> Location: https://localhost:3100/app
GET /api/a      (Response 307, Location: /app)                          -> Location: /app
```

Every other redirect in the app is fine: pages use `redirect()` (relative, e.g. live `/app` -> `/login?next=%2Fapp`) and absolute links use `env.APP_URL`. This was the only `request.url`-derived redirect.

### Why nothing caught it

- `tests/app-distribution.test.ts` _encoded the bug_: it constructed the request with the public URL and asserted `https://food.bababuilds.com/app`. Unit tests cannot see the proxy-derived URL.
- `scripts/android/launch-smoke.sh` only greps the crash buffer for a Java fatal exception after 22 s. A browser error page passes.
- No post-deploy public check requests `/api/app/launch` (`grep` over `scripts/`, `.github/`, `infra/`: none).

### Fix (this PR)

`src/app/api/app/launch/route.ts` returns a relative `Location: /app`; cookie and `no-store` headers unchanged. The test now asserts the relative location for both `localhost:3100` and `127.0.0.1:3100` request URLs. Verified with the standalone repro above, unit tests, ESLint, Prettier and `tsc`. **Takes effect only after the normal gated web deploy; no Android app update is needed.**

## 3. Findings

Severity: **P0** blocks launch, **P1** required for a polished store release, **P2** quality.

### Launch integrity

| #   | Sev | Finding                                                                                                                                  | Evidence                          | Action                                                                                                                    |
| --- | --- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| L1  | P0  | Launch redirect to localhost                                                                                                             | §2                                | Fixed; deploy and verify live                                                                                             |
| L2  | P0  | No automated proof the TWA loads the real origin                                                                                         | smoke test only checks crashes    | §4 Phase 1                                                                                                                |
| L3  | P0  | `assetlinks.json` is now 200 with fingerprint `74:12:F2:…:15:2B`; nothing proves it is the **Play App Signing** key (not the upload key) | live fetch; #340 Gate 3 unchecked | Owner compares with Play Console > App integrity; add CI/deploy check that the served fingerprint equals the recorded one |
| L4  | P1  | Until L3 passes, the TWA silently falls back to a Custom Tab with a URL bar, which looks like a browser, not an app                      | Digital Asset Links design        | Device check "no toolbar"; consider `FALLBACK_STRATEGY` so failure is visible in test builds                              |
| L5  | P1  | Verification emails, password-reset and shared links open in Chrome, not the app: the `autoVerify` filter only matches `/api/app/launch` | `AndroidManifest.xml`             | Product decision: also claim `/app`, `/login`, `/dashboard`, `/kitchen`, `/invite/*`; keep diner `/m/*` in the browser    |

### Native shell polish (`android/`)

| #   | Sev | Finding                                                                                                                                                                                                      | Action                                                                                                                                   |
| --- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| N1  | P1  | Launcher icon is one 192 px bitmap in `drawable-nodpi`: no adaptive icon, no Android 13+ themed (monochrome) icon, blurry on xxxhdpi/tablets                                                                 | Build adaptive icon (foreground/background/monochrome vector) from the approved SVG in `docs/brand-assets.md`                            |
| N2  | P1  | No splash: `Theme.Translucent.NoTitleBar` gives a blank/white gap, then the system icon splash, then Chrome cold start                                                                                       | `SPLASH_IMAGE_DRAWABLE`, `SPLASH_SCREEN_BACKGROUND_COLOR` (needs `FILE_PROVIDER_AUTHORITY`) plus Android 12+ `windowSplashScreen*` theme |
| N3  | P1  | No status/navigation bar colours (helper supports `STATUS_BAR_COLOR[_DARK]`, `NAVIGATION_BAR_COLOR[_DARK]`)                                                                                                  | Match `#f97316` / `#1c1917` from `viewport.themeColor`                                                                                   |
| N4  | P1  | Launcher label is "MenuMinute Restaurant Manager" (30 chars) and truncates on most launchers                                                                                                                 | Short `android:label` "MenuMinute"; keep the long name as the Play title                                                                 |
| N5  | P1  | Web push on Android 13+ needs `POST_NOTIFICATIONS` and the helper's `NotificationPermissionRequestActivity`; neither is in the manifest (helper 2.7.4 AAR manifest declares neither). _Unverified_ on device | Add both, then test opt-in/deny on Android 13, 15, 16                                                                                    |
| N6  | P2  | No launcher shortcuts (POS, Kitchen) although the helper ships `ShortcutTrampolineActivity`                                                                                                                  | Static shortcuts to `/dashboard/pos` and `/kitchen`                                                                                      |
| N7  | P2  | No explicit `SCREEN_ORIENTATION`; PWA manifest says `any`                                                                                                                                                    | Keep `any` (tablets, kitchen displays); document the decision                                                                            |
| N8  | P2  | No Play-vitals gate, no crash/ANR budget                                                                                                                                                                     | Phase 5                                                                                                                                  |

### Web layer on mobile (`src/`)

| #   | Sev | Finding                                                                                                                                                                                               | Evidence                                            | Action                                                                                                      |
| --- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| W1  | P1  | 20 files still use `100vh`/`min-h-screen`/`h-screen` (33 occurrences of dynamic units elsewhere). On Android Chrome the address bar and keyboard change the viewport, causing clipped footers/buttons | `grep` over `src`                                   | Replace with `dvh`/`svh`; audit POS, Kitchen, auth, onboarding first                                        |
| W2  | P1  | No `interactive-widget` / `visualViewport` handling for the soft keyboard in forms or POS search                                                                                                      | 19 matches for overscroll/viewport handling overall | Test every form at 320 px with keyboard open; set `interactive-widget=resizes-content` where needed         |
| W3  | P1  | `viewport` lacks `viewportFit: "cover"`, so `env(safe-area-inset-*)` is always 0 and cutout/gesture-bar handling is untested on Android                                                               | `src/app/layout.tsx`                                | Decide edge-to-edge policy; if adopted, add and test insets                                                 |
| W4  | P2  | Sonner `<Toaster position="top-right">` ignores mobile ergonomics (status bar overlap, thumb reach)                                                                                                   | `layout.tsx`                                        | Bottom-centre on narrow screens, above the bottom bar                                                       |
| W5  | P1  | Only **one** mobile Playwright profile (Pixel 5)                                                                                                                                                      | `playwright.config.ts`                              | Add a small-phone (360x640), large-phone (430x932), tablet (800x1280) and landscape project for P0 journeys |
| W6  | P2  | No client-side error reporting; only a server log collector                                                                                                                                           | no Sentry/Crashlytics usage                         | Capture unhandled client errors with route, app version, Play flag                                          |
| W7  | P1  | Touch targets (44 dp), text scaling (200%), reduced motion and focus order are "to verify" in the matrix, not automated                                                                               | `device-test-matrix.md`                             | axe + Playwright assertions for target size on the P0 journeys                                              |

### Not defects, but limits to state honestly

- iOS is **not** covered by this app. iPhone users get the PWA in Safari.
- A TWA needs Chrome (or another TWA-capable browser) installed and enabled. Devices without it get the fallback.
- Bluetooth Classic/USB printers remain unsupported; only BLE GATT via Web Bluetooth. If these printers matter commercially, that is a separate native bridge decision.

## 4. Plan

Each phase has an exit criterion. A phase is not "done" until its evidence is attached to #340.

### Phase 0 — Hotfix (days)

1. Merge this PR through the normal gated pipeline and deploy the reviewed SHA.
2. Verify live: `curl -sSI https://food.bababuilds.com/api/app/launch` returns `307`, `Location: /app`, `Set-Cookie ... HttpOnly; Secure; SameSite=Lax`. Record in `docs/deployment-actions.md`.
3. Exit: a physical Android device opens the installed build and lands on `/login?next=%2Fapp` with no `localhost`.

### Phase 1 — Prove the launch path (1 week)

1. **Server contract test in CI**: build the standalone output, start it with `HOSTNAME=127.0.0.1 PORT=<p>`, send requests with a public `Host`/`X-Forwarded-*`, and assert every redirect `Location` is relative or on `APP_URL`'s origin (covers `/api/app/launch`, `/app`, `/dashboard`, `/login`). This is the exact repro from §2 and would have caught the incident.
2. **Post-deploy public check**: add `/api/app/launch` (relative `Location`, cookie attributes) and `/.well-known/assetlinks.json` (200, package id, fingerprint equals the recorded Play App Signing value) to the existing public-readiness verification.
3. **Smarter emulator smoke**: after launch, dump the UI (`uiautomator dump`) and fail unless login (or dashboard) text is present, no URL bar is shown, and the foreground package is the app/Chrome TWA. Keep the 35-minute budget; upload a screenshot as an artifact.
4. **Guardrail**: a test or lint rule that rejects `NextResponse.redirect(` / `new URL(<path>, req.url)` for user-facing redirects; use relative redirects or `env.APP_URL`.
5. Owner: confirm the assetlinks fingerprint against Play Console and decide L5 deep-link scope.
6. Exit: all of the above green on `main`; fullscreen TWA confirmed on a device from Play Internal Testing.

### Phase 2 — Native shell polish (1–2 weeks, Android-only, auto-triggers a signed candidate)

N1–N7. Add `FileProvider` (required by the splash), adaptive + monochrome icon, splash, bar colours, short label, notification permission pieces, shortcuts. Extend `tests/android-launch-manifest.test.ts` so each item above is asserted (permission, activity, meta-data, icon resources). Exit: AAB candidate passes the manifest tests and the emulator smoke; screenshots on Android 10, 13, 15, 16.

### Phase 3 — Mobile web polish (2–3 weeks, web-only, no AAB)

Work the P0 merchant journeys in this order: login/MFA, `/app` entry, onboarding, dashboard, POS cart and tender, Kitchen board, menu import (camera/gallery), billing (Play mode). For each: W1–W4, W7, plus keyboard, rotation, split-screen/foldable resize and 200% font. One PR per journey with before/after screenshots at 320/360/390/430/768 px. Exit: P0 journeys pass at all widths in the new Playwright projects (W5).

### Phase 4 — Real-device and store gates (2 weeks, mostly owner-run)

1. Execute `device-test-matrix.md` on at least Android 10, 13, 15 and 16, one phone and one tablet; add a low-RAM/low-end device and a Samsung device. A device farm (Firebase Test Lab or similar) can supplement but not replace physical printer/BLE tests.
2. Use Play's pre-launch report on the internal track; fix every crash/ANR and accessibility warning.
3. Complete Data Safety, app access (reviewer account without one-time MFA), screenshots from the real app.
4. Exit: matrix filled with build SHA, AAB SHA-256, device, Chrome version, timestamp; no "untested" in P0 rows.

### Phase 5 — Release and operate

1. Internal -> closed (meet the 12-tester/14-day rule if the account is subject to it) -> staged production (5% -> 20% -> 50% -> 100%) with owner sign-off per step.
2. Watch Play vitals (crash < 1.09%, ANR < 0.47% bad-behaviour thresholds as published by Google, re-check current numbers), client error reports (W6), and login/order success rate by `Play` flag.
3. Rollback: Play halt rollout + server-side Play flag; web fixes ship independently of the AAB.

## 5. Support matrix to advertise

| Platform                                     | Supported path   | Notes                                     |
| -------------------------------------------- | ---------------- | ----------------------------------------- |
| Android 8–16 phones/tablets with Chrome      | Play TWA         | minSdk 26; verified origin required       |
| Android without Chrome / unsupported browser | Browser fallback | Message must be intelligible (matrix row) |
| iPhone/iPad                                  | PWA in Safari    | No Play app; no TWA features              |
| Desktop                                      | Web              | Unchanged                                 |

## 6. Decisions for the owner

1. Which merchant URLs should open in the app (L5)?
2. ~~Edge-to-edge or letterboxed layout (W3)?~~ **Edge-to-edge (decided 2026-11-10).**
3. ~~Are Bluetooth Classic/USB printers a launch requirement?~~ **Yes (decided 2026-11-10).** Native bridge built; needs hardware verification.
4. Is an iOS App Store app in scope, or is the PWA sufficient?

## 7. What this analysis could not verify

- Behaviour on any physical device or the emulator (no device access here).
- That the served fingerprint is the Play App Signing key.
- N5 (notification permission) is based on the helper AAR contents and its documented delegation model; confirm on Android 13+.
- Play policy thresholds change; re-check Google's current vitals and testing requirements before submission.
