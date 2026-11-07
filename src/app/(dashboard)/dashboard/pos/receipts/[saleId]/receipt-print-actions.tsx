"use client";

import { useEffect, useRef, useState } from "react";
import { isAndroidInstalledClient, printThermalBle } from "@/lib/pos/thermal-ble";
import type { ThermalPaper, ThermalReceipt } from "@/lib/pos/thermal-receipt";

export function ReceiptPrintActions({
  auto,
  paper,
  receipt,
}: {
  auto: boolean;
  paper: ThermalPaper;
  receipt: ThermalReceipt;
}) {
  const triggered = useRef(false);
  const [environment, setEnvironment] = useState<"checking" | "ble" | "browser">("checking");
  const [printing, setPrinting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setEnvironment(isAndroidInstalledClient() ? "ble" : "browser");
  }, []);

  useEffect(() => {
    if (!auto || triggered.current || environment === "checking") return;
    triggered.current = true;
    if (environment === "ble") {
      setMessage("Tap Print thermal receipt to choose a Bluetooth LE printer.");
      return;
    }
    const id = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(id);
  }, [auto, environment]);

  async function printBluetooth() {
    if (printing) return;
    setPrinting(true);
    setMessage(null);
    try {
      await printThermalBle(receipt, paper);
      setMessage("Receipt data sent to the printer. Confirm it printed before closing.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Bluetooth receipt printing failed. Use system print."
      );
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div className="receipt-print-actions">
      {environment === "ble" && (
        <button
          type="button"
          onClick={() => void printBluetooth()}
          disabled={printing}
          className="receipt-print-button"
        >
          {printing ? "Sending receipt…" : "Print thermal receipt (BLE)"}
        </button>
      )}
      <button type="button" onClick={() => window.print()} className="receipt-print-button">
        Print / save PDF
      </button>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
