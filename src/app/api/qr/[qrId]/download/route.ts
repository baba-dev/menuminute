import QRCode from "qrcode";
import { requestContext, errorResponse } from "@/lib/request-context";
import { getRestaurantQrCodes } from "@/modules/restaurants/service";
import { env } from "@/lib/config/env";
import { NotFoundError } from "@/lib/errors";
export async function GET(req: Request, c: { params: Promise<{ qrId: string }> }) {
  try {
    const { actor, restaurant } = await requestContext(req);
    const id = (await c.params).qrId;
    const qr = (await getRestaurantQrCodes(actor, restaurant.id)).find(
      (q) => q.id === id && q.isActive
    );
    if (!qr) throw new NotFoundError("Active QR");
    const svg = new URL(req.url).searchParams.get("format") === "svg";
    const url = `${env.APP_URL}/m/${qr.destinationToken}`;
    const data = svg
      ? await QRCode.toString(url, { type: "svg", margin: 4, errorCorrectionLevel: "M" })
      : await QRCode.toBuffer(url, { margin: 4, width: 1024, errorCorrectionLevel: "M" });
    return new Response(typeof data === "string" ? data : new Uint8Array(data), {
      headers: {
        "content-type": svg ? "image/svg+xml" : "image/png",
        "content-disposition": `${new URL(req.url).searchParams.has("inline") ? "inline" : "attachment"}; filename="menu-qr.${svg ? "svg" : "png"}"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (e) {
    return errorResponse(e, req);
  }
}
