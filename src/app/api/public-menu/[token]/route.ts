import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { publicProduct } from "@/modules/menu-product/service";
async function observed_GET(req: Request, c: { params: Promise<{ token: string }> }) {
  const data = await publicProduct(
    (await c.params).token,
    new URL(req.url).searchParams.get("lang")
  );
  return NextResponse.json(data ?? { message: "Menu unavailable" }, {
    status: data ? 200 : 404,
    headers: { "cache-control": "no-store" },
  });
}

export const GET = observedRoute(observed_GET);
