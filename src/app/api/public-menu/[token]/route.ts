import { NextResponse } from "next/server";
import { publicProduct } from "@/modules/menu-product/service";
export async function GET(_req: Request, c: { params: Promise<{ token: string }> }) {
  const data = await publicProduct((await c.params).token);
  return NextResponse.json(data ?? { message: "Menu unavailable" }, {
    status: data ? 200 : 404,
    headers: { "cache-control": "no-store" },
  });
}
