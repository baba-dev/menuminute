import { NextResponse } from "next/server";
import { requestContext, errorResponse } from "@/lib/request-context";
import { readImportSource } from "@/modules/menu-import/service";
type C = { params: Promise<{ importId: string; sourceId: string }> };
export async function GET(req: Request, c: C) {
  try {
    const { actor, restaurant } = await requestContext(req);
    const { importId, sourceId } = await c.params;
    const bytes = await readImportSource(actor, restaurant.id, importId, sourceId);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    return errorResponse(error, req);
  }
}
