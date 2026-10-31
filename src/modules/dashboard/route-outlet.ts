import { cookies } from "next/headers";
import { NotFoundError } from "@/lib/errors";
import { requestActor } from "@/lib/request-context";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";

/** Never accept a client-supplied organization or outlet: resolve both from the session. */
export async function routeOutlet(req: Request) {
  const actor = await requestActor(req);
  const outlet = await getDefaultOrActiveRestaurant(
    actor.userId,
    (await cookies()).get("menuminute.outlet")?.value
  );
  if (!outlet) throw new NotFoundError("Outlet");
  return { actor, outlet };
}
