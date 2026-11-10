import { NextResponse } from "next/server";
import { z } from "zod";
import { observedRoute } from "@/lib/observed-route";
import { errorResponse } from "@/lib/request-context";
import { boundedBytes } from "@/lib/bounded-input";
import { UnauthorizedError } from "@/lib/errors";
import { redeemNativePrintGrant } from "@/modules/pos/native-print";

const body = z.object({ grant: z.string().min(20).max(2048) }).strict();

// Called by the Android print bridge, which has no browser cookies. The bearer grant is bound to one
// sale/session/outlet and expires in two minutes; the service re-checks session and membership.
async function observed_POST(req: Request) {
  try {
    if (!req.headers.get("content-type")?.startsWith("application/json"))
      throw new UnauthorizedError();
    let raw: unknown = null;
    try {
      raw = JSON.parse(new TextDecoder().decode(await boundedBytes(req, 4096)));
    } catch {
      throw new UnauthorizedError();
    }
    const parsed = body.safeParse(raw);
    if (!parsed.success) throw new UnauthorizedError();
    const bytes = await redeemNativePrintGrant(parsed.data.grant);
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return errorResponse(e, req);
  }
}

export const POST = observedRoute(observed_POST);
