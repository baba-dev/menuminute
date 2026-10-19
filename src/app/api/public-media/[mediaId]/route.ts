import { publicMedia } from "@/modules/media/product-service";
import { errorResponse } from "@/lib/request-context";
export async function GET(req: Request, c: { params: Promise<{ mediaId: string }> }) {
  try {
    return new Response(
      new Uint8Array(
        await publicMedia(
          (await c.params).mediaId,
          new URL(req.url).searchParams.get("size") === "thumb"
        )
      ),
      {
        headers: {
          "content-type": "image/webp",
          "cache-control": "private, no-store",
          "content-security-policy": "default-src 'none'; sandbox",
        },
      }
    );
  } catch (e) {
    return errorResponse(e);
  }
}
