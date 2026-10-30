import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { publicProduct } from "@/modules/menu-product/service";
import { reserveOrderSource, verifiedOrderSource } from "@/modules/orders/rate-limit";
const headers = { "cache-control": "no-store" };
async function observed_GET(req: Request, c: { params: Promise<{ token: string }> }) {
  let source: string;
  try {
    source = verifiedOrderSource(req);
    if (!(await reserveOrderSource("tracking", source))) {
      return NextResponse.json({ message: "Menu request limit reached" }, { status: 429, headers });
    }
  } catch {
    return NextResponse.json({ message: "Menu temporarily unavailable" }, { status: 503, headers });
  }
  const data = await publicProduct(
    (await c.params).token,
    new URL(req.url).searchParams.get("lang")
  );
  return NextResponse.json(data ?? { message: "Menu unavailable" }, {
    status: data ? 200 : 404,
    headers,
  });
}

export const GET = observedRoute(observed_GET);
