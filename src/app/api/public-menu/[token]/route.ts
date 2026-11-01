import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { publicProduct } from "@/modules/menu-product/service";
import { etagMatches, publicMenuEtag } from "@/modules/menu-product/conditional-response";
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
  if (!data)
    return NextResponse.json({ message: "Menu unavailable" }, { status: 404, headers });
  const etag = publicMenuEtag(data);
  const responseHeaders = { ...headers, etag };
  if (etagMatches(req.headers.get("if-none-match"), etag)) {
    return new Response(null, { status: 304, headers: responseHeaders });
  }
  return NextResponse.json(data, { status: 200, headers: responseHeaders });
}

export const GET = observedRoute(observed_GET);
