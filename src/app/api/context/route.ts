import { NextResponse } from "next/server";
import { z } from "zod";
import { requestActor, errorResponse } from "@/lib/request-context";
import {
  getRestaurantById,
  getRestaurantsByUserId,
  getDefaultOrActiveRestaurant,
} from "@/modules/restaurants/service";
import { auth } from "@/lib/auth";
import { readWorkspacePreference, selectWorkspacePreference } from "@/modules/organizations/workspace-preferences";
import { listOrganizations } from "@/modules/organizations/service";
import { ForbiddenError } from "@/lib/errors";
import { UnauthorizedError } from "@/lib/errors";
import { cookies } from "next/headers";
import { env } from "@/lib/config/env";
export async function POST(req: Request) {
  try {
    const actor = await requestActor(req, true);
    // Legacy outlet payload remains supported for existing clients.
    const selection = z.union([
      z.object({ outletId: z.string().min(1).max(128) }).strict(),
      z.object({ organizationId: z.string().min(1).max(128) }).strict(),
    ]).parse(await req.json());
    let outletId: string | null = null;
    let organizationId: string;
    if ("outletId" in selection) {
      const outlet = await getRestaurantById(actor, selection.outletId);
      if (!outlet?.isActive) throw new ForbiddenError("Outlet access changed");
      outletId = outlet.id;
      organizationId = outlet.organizationId;
    } else {
      organizationId = selection.organizationId;
      const outlets = await getRestaurantsByUserId(actor.userId);
      outletId = outlets.find((outlet) => outlet.organizationId === organizationId)?.id ?? null;
    }
    await selectWorkspacePreference(actor, organizationId, outletId);
    const res = NextResponse.json(
      { ok: true, selectedOutletId: outletId, selectedOrganizationId: organizationId },
      { headers: { "cache-control": "private, no-store" } }
    );
    if (outletId) res.cookies.set("menuminute.outlet", outletId, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    else res.cookies.delete("menuminute.outlet");
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user.id) throw new UnauthorizedError();
    const [outlets, preference, organizations] = await Promise.all([
      getRestaurantsByUserId(session.user.id),
      readWorkspacePreference(session.user.id),
      listOrganizations({ userId: session.user.id }),
    ]);
    const selected = await getDefaultOrActiveRestaurant(
      session.user.id,
      (await cookies()).get("menuminute.outlet")?.value
    );
    return NextResponse.json(
      {
        hasOutlets: outlets.length > 0,
        selectedOutletId: selected?.id ?? null,
        selectedOrganizationId: organizations.some((o) => o.id === preference?.organizationId && o.isActive)
          ? preference?.organizationId
          : selected?.organizationId ?? null,
        outlets: outlets.map((o) => ({
          id: o.id,
          name: o.name,
          organizationId: o.organizationId,
          currency: o.currency,
          country: o.country,
          timezone: o.timezone,
        })),
      },
      {
        headers: { "cache-control": "private, no-store" },
      }
    );
  } catch (e) {
    return errorResponse(e);
  }
}
