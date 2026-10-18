import { NextResponse } from "next/server";
import { z } from "zod";
import { submitGuestOrder } from "@/modules/orders/service";
import { errorResponse } from "@/lib/request-context";

export async function POST(req: Request) {
  try {
    const length = Number(req.headers.get("content-length") ?? 0);
    if (!Number.isFinite(length) || length > 65536) {
      return NextResponse.json({ message: "Request too large" }, { status: 413 });
    }
    const source = await req.text();
    if (source.length > 65536) {
      return NextResponse.json({ message: "Request too large" }, { status: 413 });
    }
    const body = JSON.parse(source);
    const token = z.string().min(1).max(128).parse(body.token);

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
