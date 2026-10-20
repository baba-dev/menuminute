import { NextResponse } from "next/server";
import { z } from "zod";
import { requestActor, errorResponse } from "@/lib/request-context";
import { getRestaurantById, getRestaurantsByUserId, getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import { auth } from "@/lib/auth";
import { UnauthorizedError } from "@/lib/errors";
import { cookies } from "next/headers";
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
    return errorResponse(e);
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user.id) throw new UnauthorizedError();
    const outlets = await getRestaurantsByUserId(session.user.id);
    const selected = await getDefaultOrActiveRestaurant(session.user.id,
      (await cookies()).get("menuminute.outlet")?.value);
    return NextResponse.json({ hasOutlets: outlets.length > 0, selectedOutletId: selected?.id ?? null,
      outlets: outlets.map(o => ({ id:o.id, name:o.name, organizationId:o.organizationId,
        currency:o.currency, country:o.country, timezone:o.timezone })) }, {
      headers: { "cache-control": "private, no-store" },
    });
  } catch(e) { return errorResponse(e); }
}
