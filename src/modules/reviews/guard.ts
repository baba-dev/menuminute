import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import {
  reserveOrderCapability,
  reserveOrderSource,
  verifiedOrderSource,
} from "@/modules/orders/rate-limit";

const headers = { "cache-control": "no-store" };

/**
 * Shared admission for public review endpoints: feature flag, optional same-origin check for
 * writes, and the bounded per-source and per-menu allowances. Returns a response to send, or null.
 */
export async function admitReviewRequest(
  req: Request,
  menuToken: string | null,
  options: { write: boolean }
): Promise<NextResponse | null> {
  if (!env.PUBLIC_DINER_REVIEWS_ENABLED)
    return NextResponse.json({ enabled: false }, { status: 404, headers });
  if (options.write && req.headers.get("origin") !== new URL(env.APP_URL).origin)
    return NextResponse.json({ message: "Invalid request origin" }, { status: 403, headers });
  try {
    const source = verifiedOrderSource(req);
    if (!(await reserveOrderSource("tracking", source)))
      return NextResponse.json({ message: "Limit reached" }, { status: 429, headers });
    if (menuToken && !(await reserveOrderCapability("tracking", source, menuToken)))
      return NextResponse.json({ message: "Limit reached" }, { status: 429, headers });
  } catch {
    return NextResponse.json({ message: "Temporarily unavailable" }, { status: 503, headers });
  }
  return null;
}
