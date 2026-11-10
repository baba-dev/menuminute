"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { isAndroidInstalledClient, printThermalBle } from "@/lib/pos/thermal-ble";
import { printViaNativeBridge } from "@/lib/pos/native-print";
import type { ThermalPaper, ThermalReceipt } from "@/lib/pos/thermal-receipt";

function subscribeInstalledApp(onChange: () => void) {
  const standalone = window.matchMedia("(display-mode: standalone)");
  const fullscreen = window.matchMedia("(display-mode: fullscreen)");
  standalone.addEventListener?.("change", onChange);
  fullscreen.addEventListener?.("change", onChange);
  window.addEventListener("appinstalled", onChange);
  return () => {
    standalone.removeEventListener?.("change", onChange);
    fullscreen.removeEventListener?.("change", onChange);
    window.removeEventListener("appinstalled", onChange);
  };
}

function getInstalledEnvironment(): "ble" | "browser" {
  return isAndroidInstalledClient() ? "ble" : "browser";
}

function getServerEnvironment(): "checking" {
  return "checking";
}

export function ReceiptPrintActions({
  auto,
  paper,
  receipt,
  saleId,
  nativePrint,
}: {
  auto: boolean;
  paper: ThermalPaper;
  receipt: ThermalReceipt;
  saleId: string;
  /** The MenuMinute Android app has been used on this device (server-read marker, UI only). */
  nativePrint: boolean;
}) {
  const triggered = useRef(false);
  const environment = useSyncExternalStore(
    subscribeInstalledApp,
    getInstalledEnvironment,
    getServerEnvironment
  );
  const [printing, setPrinting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!auto || triggered.current || environment !== "browser") return;
    triggered.current = true;
    const id = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(id);
  }, [auto, environment]);

  async function printNative() {
    if (printing) return;
    setPrinting(true);
    setMessage(null);
    try {
      await printViaNativeBridge(saleId, paper);
      setMessage("Opening the printer screen in the MenuMinute app…");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start printing.");
    } finally {
      setPrinting(false);
    }
  }

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

  const status =
    message ??
    (auto && environment === "ble"
      ? "Tap Print thermal receipt to choose a Bluetooth LE printer."
      : null);

  return (
    <div className="receipt-print-actions">
      {environment === "ble" && nativePrint && (
        <button
          type="button"
          onClick={() => void printNative()}
          disabled={printing}
          className="receipt-print-button"
        >
          Print thermal receipt (Bluetooth / USB)
        </button>
      )}
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
      {status && <p role="status">{status}</p>}
    </div>
  );
}
