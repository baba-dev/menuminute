import { NextResponse } from "next/server";
import { z } from "zod";
import { submitGuestOrder } from "@/modules/orders/service";
import { errorResponse } from "@/lib/request-context";
import { boundedBytes } from "@/lib/bounded-input";
import {
  publicOrderOutlet,
  reserveOrderCapability,
  reserveOrderSource,
  verifiedOrderSource,
} from "@/modules/orders/rate-limit";
import { env } from "@/lib/config/env";

const BODY_LIMIT = 65536;
const tokenSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
const noStore = { "cache-control": "no-store" };

export async function POST(req: Request) {
  try {
    if (req.headers.get("origin") !== new URL(env.APP_URL).origin) {
      return NextResponse.json({ message: "Invalid request origin" }, { status: 403 });
    }
    if (!req.headers.get("content-type")?.startsWith("application/json")) {
      return NextResponse.json({ message: "JSON required" }, { status: 415 });
    }
    // Never use client-supplied forwarded-IP headers as an abuse-limit identity.
    let source: string;
    try {
      source = verifiedOrderSource(req);
      if (!(await reserveOrderSource("submit", source))) {
        return NextResponse.json(
          { message: "Order submission limit reached. Please try again shortly." },
          { status: 429, headers: noStore }
        );
      }
    } catch {
      return NextResponse.json(
        { message: "Ordering temporarily unavailable" },
        { status: 503, headers: noStore }
      );
    }

    const declared = req.headers.get("content-length");
    if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > BODY_LIMIT)) {
      return NextResponse.json({ message: "Request too large" }, { status: 413 });
    }
    // Enforces the byte limit even for chunked/HTTP2 requests without Content-Length.
    const body = JSON.parse((await boundedBytes(req, BODY_LIMIT)).toString("utf8"));
    const token = tokenSchema.parse(body?.token);
    let allowed: boolean;
    try {
      const outletId = await publicOrderOutlet(token);
      if (!outletId) {
        return NextResponse.json({ message: "Menu unavailable" }, { status: 404 });
      }
      allowed = await reserveOrderCapability("submit", source, token, outletId);
    } catch {
      return NextResponse.json(
        { message: "Ordering temporarily unavailable" },
        { status: 503, headers: noStore }
      );
    }
    if (!allowed) {
      return NextResponse.json(
        { message: "Order submission limit reached. Please try again shortly." },
        { status: 429, headers: noStore }
      );
    }
    const result = await submitGuestOrder(token, body);
    return NextResponse.json(
      { success: true, ...result },
      { status: result.isDuplicate ? 200 : 201, headers: noStore }
    );
  } catch (err) {
    return errorResponse(err, req);
  }
}
