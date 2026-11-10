# Native print bridge (Bluetooth Classic and USB)

**Status (10 November 2026): implemented and compiled; not tested on any physical printer.** Owner decision: Bluetooth Classic and USB printers are a launch requirement. Printer compatibility must not be advertised until [`device-test-matrix.md`](device-test-matrix.md) records passing vendor/model rows.

## Why a native bridge

A Trusted Web Activity runs inside Chrome. Chrome on Android offers Web Bluetooth (BLE GATT only) and cannot open Bluetooth Classic RFCOMM sockets; USB printers need Android's USB host API. So these two transports require native code. The rest of the app stays a TWA: Chrome-only features (web push, WebAuthn, Google sign-in, Digital Goods billing) are kept, which a WebView rewrite would lose.

## Flow

1. On the receipt page the merchant taps **Print thermal receipt (Bluetooth / USB)** (shown when the Play marker cookie is present).
2. The page calls `POST /api/pos/receipts/{saleId}/native-print-grant` with the paper width. The service verifies the live session, current outlet membership and that the receipt is not an issued fiscal document, then returns a **grant**: an HMAC-signed token (key derived from `AUTH_SECRET`, domain-separated) bound to user, session, organization, outlet, sale and paper, valid for 120 seconds.
3. The page navigates to `intent://receipt?grant=...#Intent;scheme=menuminute-print;package=com.bababuilds.menuminute;...`. The `package` restriction means only this app can receive it.
4. `PrintBridgeActivity` validates the grant's shape, then `POST`s it to the **fixed** URL in `strings.xml` (`/api/native-print/receipt`). The URL is never read from the intent. Redirects are not followed; the response is capped at 256 KiB.
5. The server redeems the grant: signature, expiry, **session still active**, **membership still current**, receipt still printable, then returns ESC/POS bytes produced by the same `buildThermalReceipt` + `encodeThermalReceipt` as the receipt page. Prices, taxes and statuses are copied from the immutable receipt, never recalculated.
6. The merchant picks a paired Bluetooth printer or an attached USB printer and taps **Print**. Nothing is ever printed automatically. The last printer is remembered as the pre-selection only.

## Security and failure behaviour

- The grant is not authorization. Every redemption re-checks session and membership, so sign-out or removal from the outlet stops printing.
- A leaked grant can only reprint one immutable receipt for at most two minutes; it carries no customer data.
- The exported activity can be launched by other apps, but it only acts on a valid server grant and still requires a tap.
- Failures are shown in the dialog with a retry: expired/signed out, receipt not printable (fiscal document: use the ledger page), printer off/out of range, USB unplugged or in use, permission declined. PDF/system print remains available on the receipt page.
- No order replay, offline finance write, or background printing exists.
- Bluetooth Classic needs the printer **paired first** in Android settings (the dialog links there). Android 12+ asks for the Nearby devices / `BLUETOOTH_CONNECT` permission at first use.

## Not covered

Non-ESC/POS (proprietary-protocol) printers, label printers, network/Wi-Fi printers, and printing from outside the receipt page.

## Verification still owed

- Real hardware: at least one 58 mm and one 80 mm Bluetooth Classic printer and one USB printer; Android 10, 13, 15, 16; denial of every permission; printer power-off mid-job; text with Unicode names.
- Play Console: declare Bluetooth and notification permission usage.
- Code: the Java is compiled in CI (`Android API 36 TWA build`) and locally; it has no automated hardware test.
