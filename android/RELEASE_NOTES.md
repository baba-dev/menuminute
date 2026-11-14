# MenuMinute Android — November 2026 review update

Release intent: refresh the signed Android Trusted Web Activity (TWA) candidate after
the first-review mobile experience improvements and their CI fixes.

## User-facing improvements

- Google sign-in now supports first-time Google account creation with terms/privacy disclosure.
- New users enter guided restaurant onboarding; returning users go to the dashboard.
- Mobile bottom navigation surfaces Menus, QR Codes, Orders, Floor and a More menu.
- POS and Kitchen are available in More, along with Sign out.
- Mobile headers, Orders hero, POS layouts and Kitchen phone controls have been refined.
- Mobile browser regression tests now account for the phone navigation and hidden sidebar.

## Release and verification

- Android package: `com.bababuilds.menuminute`.
- This is still the existing TWA launcher; the application UI is loaded from the
  production site, so deploy the same reviewed main commit before distributing
  this bundle. No unnecessary native permission, asset-link, or signing changes.
- Build a new Android App Bundle only after a successful push CI on `main`.
- Verify the launch-contract and emulator smoke workflow.
- Sign using the protected Android release workflow and retain its immutable
  `.aab` and provenance metadata.
- Upload to the approved Play testing track only after reviewing the signed
  artifact and confirming the production site points to the same release.
