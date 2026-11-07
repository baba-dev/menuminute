import { NextResponse } from "next/server";
import { PLAY_CLIENT_COOKIE } from "@/lib/app-distribution";

export const dynamic = "force-dynamic";

// The Android TWA always enters here. Mark the Chrome browser session as
// consumption-only before any merchant page is rendered. Never use this
// cookie to authorize a user, an outlet, a role or a financial transaction.
export function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/app", request.url), { status: 307 });
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
