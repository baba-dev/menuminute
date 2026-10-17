import { NextResponse } from "next/server";
import { z } from "zod";
import { submitGuestOrder } from "@/modules/orders/service";
import { errorResponse } from "@/lib/request-context";

export async function POST(req: Request) {
  try {
    const body = await req.json();
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
