"use client";

import { useEffect, useMemo, useRef } from "react";
import { payBlockToRgba, renderPayBlock, type PayBlockInput } from "@/lib/pos/pay-block";
import type { ThermalPaper } from "@/lib/pos/thermal-receipt";

/** On-screen preview of the thermal "Scan & Pay" block. It draws the exact bitmap the printer
 * receives (same renderer), so what the merchant sees is what prints. Renders nothing when the
 * block cannot be rendered, matching the printed receipt.
 */
export function PayBlockPreview({ block, paper }: { block: PayBlockInput; paper: ThermalPaper }) {
  const bitmap = useMemo(() => renderPayBlock(block, paper), [block, paper]);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (!bitmap || !context) return;
    const image = context.createImageData(bitmap.widthDots, bitmap.heightDots);
    image.data.set(payBlockToRgba(bitmap));
    context.putImageData(image, 0, 0);
  }, [bitmap]);

  if (!bitmap) return null;
  return (
    <canvas
      ref={canvas}
      className="receipt-pay-block"
      width={bitmap.widthDots}
      height={bitmap.heightDots}
      role="img"
      aria-label={`UPI payment QR for ${block.amountLabel}`}
    />
  );
}
