import { encodeThermalReceipt, type ThermalPaper, type ThermalReceipt } from "./thermal-receipt";
import { isInstalledAppClient } from "@/lib/pwa/installed";

// Browser-native Web Bluetooth speaks BLE GATT only. Bluetooth Classic SPP is
// deliberately NOT treated as supported and requires a separately tested native bridge.
const profiles = [
  {
    service: "0000ffe0-0000-1000-8000-00805f9b34fb",
    characteristic: "0000ffe1-0000-1000-8000-00805f9b34fb",
  },
  {
    service: "49535343-fe7d-4ae5-8fa9-9fafd205e455",
    characteristic: "49535343-8841-43f4-a8d4-ecbe34729bb3",
  },
] as const;

interface WriteCharacteristic {
  writeValueWithResponse?: (value: Uint8Array) => Promise<void>;
  writeValue?: (value: Uint8Array) => Promise<void>;
}
interface Device {
  gatt?: {
    connect(): Promise<{
      getPrimaryService(id: string): Promise<{
        getCharacteristic(id: string): Promise<WriteCharacteristic>;
      }>;
    }>;
    disconnect(): void;
  };
}
interface BluetoothPicker {
  requestDevice(options: {
    acceptAllDevices: boolean;
    optionalServices: string[];
  }): Promise<Device>;
}

export function canUseAndroidThermalBle(
  isAndroid: boolean,
  isInstalled: boolean,
  bluetoothSupported: boolean
): boolean {
  return isAndroid && isInstalled && bluetoothSupported;
}

export function isAndroidInstalledClient(): boolean {
  if (typeof window === "undefined") return false;
  const isAndroid = /Android/i.test(navigator.userAgent);
  return canUseAndroidThermalBle(isAndroid, isInstalledAppClient(), "bluetooth" in navigator);
}

export async function printThermalBle(receipt: ThermalReceipt, paper: ThermalPaper): Promise<void> {
  if (!isAndroidInstalledClient())
    throw new Error("Bluetooth printing needs an installed Android PWA or app.");
  const bluetooth = (navigator as Navigator & { bluetooth?: BluetoothPicker }).bluetooth;
  if (!bluetooth) throw new Error("This device does not expose Web Bluetooth.");

  // Must run immediately inside a user-initiated click. Never pick a printer or
  // send customer information automatically on page load.
  const device = await bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: profiles.map((profile) => profile.service),
  });
  if (!device.gatt) throw new Error("This printer has no Bluetooth LE GATT service.");
  const gatt = device.gatt;
  try {
    const server = await gatt.connect();
    let writer: WriteCharacteristic | undefined;
    for (const profile of profiles) {
      try {
        const service = await server.getPrimaryService(profile.service);
        writer = await service.getCharacteristic(profile.characteristic);
        break;
      } catch {
        // Try the next documented BLE printer profile.
      }
    }
    if (!writer || (!writer.writeValueWithResponse && !writer.writeValue)) {
      throw new Error("Printer does not expose a supported BLE receipt characteristic.");
    }
    const write = writer.writeValueWithResponse
      ? (part: Uint8Array) => writer!.writeValueWithResponse!(part)
      : (part: Uint8Array) => writer!.writeValue!(part);
    const bytes = encodeThermalReceipt(receipt, paper);
    // Conservative ATT payload fits the default BLE MTU (23 bytes = 20 data).
    // Await each write: no parallel chunks or unacknowledged partial sale output.
    for (let offset = 0; offset < bytes.length; offset += 20) {
      await write(bytes.slice(offset, offset + 20));
    }
  } finally {
    gatt.disconnect();
  }
}
