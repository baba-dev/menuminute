import { NextResponse } from "next/server";
import { z } from "zod";
import { requestActor, errorResponse } from "@/lib/request-context";
import { getRestaurantById } from "@/modules/restaurants/service";
import { env } from "@/lib/config/env";
export async function POST(req: Request) {
  try {
    const actor = await requestActor(req, true);
    const { outletId } = z
      .object({ outletId: z.string().min(1).max(128) })
      .strict()
      .parse(await req.json());
    await getRestaurantById(actor, outletId);
    const res = NextResponse.json({ ok: true });
    res.cookies.set("menuminute.outlet", outletId, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (e) {
    return errorResponse(e, req);
  }
}
