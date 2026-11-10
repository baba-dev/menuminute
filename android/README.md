# MenuMinute Restaurant Manager — Android (TWA)

This Android project packages the existing HTTPS merchant PWA as a **Trusted Web Activity** using Android Browser Helper. It does not embed a WebView or duplicate the Next.js app.

- Android application ID: `com.bababuilds.menuminute` (confirm before the first Play upload; the ID is permanent afterward).
- Target/compile API 36, minimum API 26.
- Trusted origin: `https://food.bababuilds.com`; launch URL: `/api/app/launch` (server redirects to `/app`).
- The web app uses this launch marker to enter **Play mode**: Razorpay checkout is disabled within the Play client and subscriptions are sold through **Google Play Billing** (Digital Goods API via `androidbrowserhelper:billing`, Play Billing Library 8.3.0). The app contains no billing logic; the server verifies every purchase with the Google Play Developer API. See `docs/android-release/play-billing.md`.
- Receipt printing: Bluetooth Classic (SPP) and USB printers go through the native `PrintBridgeActivity` (see `docs/android-release/print-bridge.md`; implemented, not yet hardware-verified). BLE GATT printers use Web Bluetooth in Chrome after user permission. PDF/system print remains the fallback.
- Launcher icon is an adaptive + themed (monochrome) vector built from the approved brand mark; splash, system-bar colours and notification small icon are configured in the manifest and `res/`.
- `assetlinks.json` must contain the **Play App Signing** certificate's SHA-256 fingerprint, not only the local upload-key fingerprint.

Build with JDK 17, Android SDK platform 36 and Gradle 8.13:

```bash
cd android
gradle :app:assembleDebug :app:bundleRelease
```

The debug APK is for internal QA only. The release bundle is **unsigned** unless a verified Play upload-signing process is configured. Do not upload unsigned artifacts to production. After green push CI on current `main`, native Android changes automatically produce a **versioned, signed AAB candidate** via the separate protected GitHub workflow. Web-only updates never generate an AAB. See `docs/android-release/release-automation.md` for the manual Play draft upload and review gate.

Before production: configure verified Digital Asset Links, supply securely stored Play upload credentials, test Play Internal Testing on physical Android devices, verify Chrome provider and OAuth, confirm printer compatibility, and complete the Google Play Data Safety + access declarations. See `docs/android-release/README.md` for gates.
