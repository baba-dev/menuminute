/**
 * QR Code generation service.
 * Generates SVG and PNG QR codes linking to stable public menu URLs.
 *
 * The QR destination uses the restaurant's publicId (never the slug),
 * so QR codes remain valid even if the restaurant name or slug changes.
 */
import QRCode from "qrcode";
import { env } from "@/lib/config/env";

export type QrGenerateResult = {
  svgData: string;
  dataUrl: string;
  destinationUrl: string;
};

/**
 * Generate a QR code for a public menu URL.
 * @param destinationToken - The stable token (publicId) for the public menu
 */
export async function generateMenuQrCode(destinationToken: string): Promise<QrGenerateResult> {
  const destinationUrl = `${env.APP_URL}/m/${destinationToken}`;

  const svgData = await QRCode.toString(destinationUrl, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    color: {
      dark: "#1c1917",
      light: "#ffffff",
    },
  });

  const dataUrl = await QRCode.toDataURL(destinationUrl, {
    type: "image/png",
    errorCorrectionLevel: "M",
    margin: 2,
    scale: 8,
    color: {
      dark: "#1c1917",
      light: "#ffffff",
    },
  });

  return { svgData, dataUrl, destinationUrl };
}
