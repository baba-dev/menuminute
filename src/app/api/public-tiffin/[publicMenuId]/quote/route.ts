import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { z } from "zod";
import { boundedBytes } from "@/lib/bounded-input";
import { env } from "@/lib/config/env";
import { NotFoundError } from "@/lib/errors";
import { errorResponse } from "@/lib/request-context";
import { verifiedOrderSource } from "@/modules/orders/rate-limit";
import { quoteSelection } from "@/modules/tiffin/service";
import {
  reserveTiffinPublicSource,
  reserveTiffinPublicToken,
  tiffinRoutesEnabled,
} from "@/modules/tiffin/rate-limit";

const BODY_LIMIT = 16384;
const tokenSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
const noStore = { "cache-control": "no-store" };
// Identical for flag off, malformed, unknown, revoked and unpublished tokens.
const notFound = () =>
  NextResponse.json({ message: "Menu unavailable" }, { status: 404, headers: noStore });
const tooMany = () =>
  NextResponse.json(
    { message: "Too many requests. Please try again shortly." },
    { status: 429, headers: noStore }
  );
const unavailable = () =>
  NextResponse.json({ message: "Menu temporarily unavailable" }, { status: 503, headers: noStore });

async function observed_POST(
  req: Request,
  { params }: { params: Promise<{ publicMenuId: string }> }
) {
  try {
    if (!tiffinRoutesEnabled()) return notFound();
    if (req.headers.get("origin") !== new URL(env.APP_URL).origin) {
      return NextResponse.json(
        { message: "Invalid request origin" },
        { status: 403, headers: noStore }
      );
    }
    if (!req.headers.get("content-type")?.startsWith("application/json")) {
      return NextResponse.json({ message: "JSON required" }, { status: 415, headers: noStore });
    }
    // Never use client-supplied forwarded-IP headers as an abuse-limit identity.
    let source: string;
    try {
      source = verifiedOrderSource(req);
      if (!(await reserveTiffinPublicSource("quote", source))) return tooMany();
    } catch {
      return unavailable();
    }
    const token = tokenSchema.safeParse((await params).publicMenuId);
    if (!token.success) return notFound();
    try {
      if (!(await reserveTiffinPublicToken("quote", source, token.data))) return tooMany();
    } catch {
      return unavailable();
    }
    const declared = req.headers.get("content-length");
    if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > BODY_LIMIT)) {
      return NextResponse.json({ message: "Request too large" }, { status: 413, headers: noStore });
    }
    // Enforces the byte limit even for chunked/HTTP2 requests without Content-Length.
    const body = JSON.parse((await boundedBytes(req, BODY_LIMIT)).toString("utf8"));
    const quote = await quoteSelection(token.data, body);
    return NextResponse.json(quote, { headers: noStore });
  } catch (err) {
    if (err instanceof NotFoundError) return notFound();
    const res = errorResponse(err, req);
    res.headers.set("cache-control", "no-store");
    return res;
  }
}

export const POST = observedRoute(observed_POST);
