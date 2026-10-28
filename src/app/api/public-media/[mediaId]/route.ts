import { publicMediaResponse } from "@/modules/media/product-service";
import { errorResponse } from "@/lib/request-context";
import { consumePublicMediaLimit, publicClientIdentity } from "@/lib/public-rate-limit";
import { RateLimitError, UnavailableError } from "@/lib/errors";

const cacheControl = "private, no-cache, max-age=0, must-revalidate";
export async function GET(req: Request, c: { params: Promise<{ mediaId: string }> }) {
  try {
    let rate;
    try {
      rate = await consumePublicMediaLimit(publicClientIdentity(req));
    } catch {
      throw new UnavailableError();
    }
    if (!rate.allowed) throw new RateLimitError(rate.retryAfterSeconds);
    const media = await publicMediaResponse(
      (await c.params).mediaId,
      new URL(req.url).searchParams.get("size") === "thumb",
      req.headers.get("if-none-match"),
      true
    );
    const headers = {
      "cache-control": cacheControl,
      etag: media.etag,
      "ratelimit-limit": String(rate.limit),
      "ratelimit-remaining": String(rate.remaining),
    };
    if (media.notModified) return new Response(null, { status: 304, headers });
    if (media.internalPath) {
      return new Response(null, {
        headers: {
          ...headers,
          "x-accel-redirect": media.internalPath,
          "content-type": "image/webp",
          "content-security-policy": "default-src 'none'; sandbox",
        },
      });
    }
    return new Response(new Uint8Array(media.bytes), {
      headers: {
        ...headers,
        "content-type": "image/webp",
        "content-security-policy": "default-src 'none'; sandbox",
      },
    });
  } catch (e) {
    return errorResponse(e, req);
  }
}
