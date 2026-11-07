import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const packageName = "com.bababuilds.menuminute";

// Fingerprint must come from the Google Play APP SIGNING certificate, not
// a local debug keystore or upload certificate. No placeholder is published.
export function GET() {
  const fingerprint = process.env.ANDROID_PLAY_APP_SIGNING_SHA256?.trim().toUpperCase();
  const canonical = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/;
  if (!fingerprint || !canonical.test(fingerprint)) {
    return NextResponse.json([], {
      status: 503,
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  }
  return NextResponse.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: packageName,
          sha256_cert_fingerprints: [fingerprint],
        },
      },
    ],
    { headers: { "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff" } }
  );
}
