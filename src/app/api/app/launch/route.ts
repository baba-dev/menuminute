import { NextResponse } from "next/server";
import { PLAY_CLIENT_COOKIE } from "@/lib/app-distribution";

export const dynamic = "force-dynamic";

// The Android TWA always enters here. Mark the Chrome browser session as
// consumption-only before any merchant page is rendered. Never use this
// cookie to authorize a user, an outlet, a role or a financial transaction.
export function GET(_request: Request) {
  // Relative Location on purpose: behind Nginx the Node server listens on
  // HOSTNAME=127.0.0.1:PORT and Next derives request.url from that listener, not from
  // Host/X-Forwarded-*. NextResponse.redirect(new URL("/app", request.url)) therefore emitted
  // "https://localhost:3100/app" and sent the Android TWA to localhost. A relative redirect
  // (RFC 9110 §10.2.2) is resolved by the client against the origin it actually requested.
  const response = new NextResponse(null, { status: 307, headers: { Location: "/app" } });
  response.cookies.set(PLAY_CLIENT_COOKIE, "1", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Vary", "Cookie");
  return response;
}
