"use client";

import { useEffect, useRef } from "react";

export function ReceiptPrintActions({ auto }: { auto: boolean }) {
  const triggered = useRef(false);
  useEffect(() => {
    if (!auto || triggered.current) return;
    triggered.current = true;
    const id = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(id);
  }, [auto]);
  return (
    <button type="button" onClick={() => window.print()} className="receipt-print-button">
      Print / save PDF
    </button>
  );
}
