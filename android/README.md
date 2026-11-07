# MenuMinute Restaurant Manager — Android (TWA)

This Android project packages the existing HTTPS merchant PWA as a **Trusted Web Activity** using Android Browser Helper. It does not embed a WebView or duplicate the Next.js app.

- Android application ID: `com.bababuilds.menuminute` (confirm before the first Play upload; the ID is permanent afterward).
- Target/compile API 36, minimum API 26.
- Trusted origin: `https://food.bababuilds.com`; launch URL: `/api/app/launch` (server redirects to `/app`).
- The web app uses this specific launch marker to enter **consumption-only mode**: Razorpay digital subscription checkout is disabled within the Play client. Existing subscribers keep their entitlements.
- The app does not claim native Bluetooth Classic printing. BLE GATT receipt printers can be accessed through Web Bluetooth in compatible Chrome/TWA installations after user permission.
- `assetlinks.json` must contain the **Play App Signing** certificate's SHA-256 fingerprint, not only the local upload-key fingerprint.

Build with JDK 17, Android SDK platform 36 and Gradle 8.13:

```bash
cd android
gradle :app:assembleDebug :app:bundleRelease
```

The debug APK is for internal QA only. The release bundle is **unsigned** unless a verified Play upload-signing process is configured. Do not upload unsigned artifacts to production.

Before production: configure verified Digital Asset Links, supply securely stored Play upload credentials, test Play Internal Testing on physical Android devices, verify Chrome provider and OAuth, confirm printer compatibility, and complete the Google Play Data Safety + access declarations. See `docs/android-release/README.md` for gates.
