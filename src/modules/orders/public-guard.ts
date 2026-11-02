import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { reserveOrderCapability, reserveOrderSource, verifiedOrderSource } from "./rate-limit";

const headers = { "cache-control": "no-store" };

/**
 * Edge checks shared by the public table-QR endpoints: same-origin for mutations, the proxy-asserted
 * client identity, and the per-source and per-QR Redis allowances. Returns a response to send when the
 * request must be refused, or null to continue. Fails closed (503) when the limiter is unavailable.
 */
export async function guestEdgeGuard(
  req: Request,
  token: string | null,
  options: { mutation: boolean }
): Promise<NextResponse | null> {
  if (options.mutation && req.headers.get("origin") !== new URL(env.APP_URL).origin) {
    return NextResponse.json({ message: "Invalid request origin" }, { status: 403, headers });
  }
  try {
    const source = verifiedOrderSource(req);
    if (!(await reserveOrderSource("tracking", source)))
      return NextResponse.json({ message: "Too many requests" }, { status: 429, headers });
    if (token && !(await reserveOrderCapability("tracking", source, token)))
      return NextResponse.json({ message: "Too many requests" }, { status: 429, headers });
  } catch {
    return NextResponse.json({ message: "Temporarily unavailable" }, { status: 503, headers });
  }
  return null;
}
