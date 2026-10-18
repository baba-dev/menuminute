import { NextResponse } from "next/server";
import { z } from "zod";
import { submitGuestOrder } from "@/modules/orders/service";
import { errorResponse } from "@/lib/request-context";
import { enforcePublicOrderLimit } from "@/modules/orders/rate-limit";
import { env } from "@/lib/config/env";

export async function POST(req: Request) {
  try {
    const length = Number(req.headers.get("content-length") ?? 0);
    if (!Number.isFinite(length) || length > 65536) {
      return NextResponse.json({ message: "Request too large" }, { status: 413 });
    }
    const origin = req.headers.get("origin");
    if (origin && origin !== new URL(env.APP_URL).origin) {
      return NextResponse.json({ message: "Invalid request origin" }, { status: 403 });
    }
    const source = await req.text();
    if (Buffer.byteLength(source, "utf8") > 65536) {
      return NextResponse.json({ message: "Request too large" }, { status: 413 });
    }
    const body = JSON.parse(source);
    const token = z.string().min(1).max(128).parse(body.token);
    try {
      if (!(await enforcePublicOrderLimit("submit", token, req))) {
        return NextResponse.json({ message: "Order submission limit reached. Please try again shortly." }, { status: 429 });
      }
    } catch {
      return NextResponse.json({ message: "Ordering temporarily unavailable" }, { status: 503 });
    }

    const result = await submitGuestOrder(token, body);

    return NextResponse.json(
      {
        success: true,
        ...result,
      },
      {
        status: result.isDuplicate ? 200 : 201,
        headers: { "cache-control": "no-store" },
      }
    );
  } catch (err) {
    return errorResponse(err);
  }
}
