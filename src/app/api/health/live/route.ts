import { observedRoute } from "@/lib/observed-route";
function observed_GET() {
  return Response.json({ status: "alive" }, { headers: { "Cache-Control": "no-store" } });
}

export const GET = observedRoute(observed_GET);
