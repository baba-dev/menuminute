import { NextResponse } from "next/server";
import { boundedBytes } from "@/lib/bounded-input";
import { applyStripeWebhook } from "@/modules/pos/finance";

export async function POST(req: Request) {
  try {
    const body = await boundedBytes(req, 256_000);
    await applyStripeWebhook(body, req.headers.get("stripe-signature"));
    return NextResponse.json({ received: true }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json(
      { message: "Invalid provider event" },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }
}
