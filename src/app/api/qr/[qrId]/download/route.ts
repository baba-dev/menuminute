import QRCode from "qrcode";
import { requestContext, errorResponse } from "@/lib/request-context";
import { getRestaurantQrCodes } from "@/modules/restaurants/service";
import { env } from "@/lib/config/env";
import { NotFoundError } from "@/lib/errors";
import { validatedQrInk } from "@/modules/qr/ink";
export async function GET(req: Request, c: { params: Promise<{ qrId: string }> }) {
  try {
    const { actor, restaurant } = await requestContext(req);
    const id = (await c.params).qrId;
    const qr = (await getRestaurantQrCodes(actor, restaurant.id)).find(
      (q) => q.id === id && q.isActive
    );
    if (!qr) throw new NotFoundError("Active QR");
    const params = new URL(req.url).searchParams;
    const svg = params.get("format") === "svg";
    const ink = validatedQrInk(params.get("ink"));
    const url = `${env.APP_URL}/m/${qr.destinationToken}`;
    const data = svg
      ? await QRCode.toString(url, {
          type: "svg",
          margin: 4,
          errorCorrectionLevel: "M",
          color: { dark: ink + "FF", light: "#FFFFFFFF" },
        })
      : await QRCode.toBuffer(url, {
          margin: 4,
          width: 1024,
          errorCorrectionLevel: "M",
          color: { dark: ink + "FF", light: "#FFFFFFFF" },
        });
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
