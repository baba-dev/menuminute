package com.bababuilds.menuminute;

import android.content.Context;
import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/** USB host transport: writes ESC/POS to the first bulk-OUT endpoint of a printer-class interface. */
final class UsbPrinter {
    private static final int TIMEOUT_MS = 5_000;
    private static final int MAX_CHUNK = 16 * 1024;

    private UsbPrinter() {}

    static UsbManager manager(Context context) {
        return (UsbManager) context.getSystemService(Context.USB_SERVICE);
    }

    /** Prefers the standard printer class (7); accepts vendor-specific (255) interfaces with a bulk-OUT endpoint. */
    private static UsbInterface findInterface(UsbDevice device, boolean[] standardPrinter) {
        UsbInterface fallback = null;
        for (int i = 0; i < device.getInterfaceCount(); i++) {
            UsbInterface candidate = device.getInterface(i);
            int klass = candidate.getInterfaceClass();
            if (klass != UsbConstants.USB_CLASS_PRINTER && klass != UsbConstants.USB_CLASS_VENDOR_SPEC) continue;
            if (bulkOut(candidate) == null) continue;
            if (klass == UsbConstants.USB_CLASS_PRINTER) {
                standardPrinter[0] = true;
                return candidate;
            }
            if (fallback == null) fallback = candidate;
        }
        return fallback;
    }

    private static UsbEndpoint bulkOut(UsbInterface usbInterface) {
        for (int i = 0; i < usbInterface.getEndpointCount(); i++) {
            UsbEndpoint endpoint = usbInterface.getEndpoint(i);
            if (endpoint.getType() == UsbConstants.USB_ENDPOINT_XFER_BULK
                    && endpoint.getDirection() == UsbConstants.USB_DIR_OUT) {
                return endpoint;
            }
        }
        return null;
    }

    static List<PrinterOption> attached(Context context) {
        List<PrinterOption> result = new ArrayList<>();
        UsbManager manager = manager(context);
        if (manager == null) return result;
        for (UsbDevice device : manager.getDeviceList().values()) {
            boolean[] standard = {false};
            if (findInterface(device, standard) == null) continue;
            String product = device.getProductName() == null ? "USB printer" : device.getProductName();
            String label = String.format("%s · USB %04x:%04x", product, device.getVendorId(), device.getProductId());
            result.add(new PrinterOption(PrinterOption.USB, device.getDeviceName(), label, standard[0]));
        }
        return result;
    }

    static UsbDevice find(Context context, String deviceName) {
        UsbManager manager = manager(context);
        return manager == null ? null : manager.getDeviceList().get(deviceName);
    }

    /** Blocking. The caller must already hold USB permission for the device. */
    static void print(Context context, UsbDevice device, byte[] data) throws IOException {
        UsbManager manager = manager(context);
        if (manager == null || !manager.hasPermission(device)) throw new IOException("USB permission was not granted.");
        UsbInterface usbInterface = findInterface(device, new boolean[1]);
        if (usbInterface == null) throw new IOException("This USB device does not look like a printer.");
        UsbEndpoint endpoint = bulkOut(usbInterface);
        UsbDeviceConnection connection = manager.openDevice(device);
        if (connection == null) throw new IOException("Could not open the USB printer.");
        try {
            if (!connection.claimInterface(usbInterface, true)) throw new IOException("Another app is using this USB printer.");
            int chunk = Math.min(MAX_CHUNK, Math.max(64, endpoint.getMaxPacketSize() * 8));
            for (int offset = 0; offset < data.length; ) {
                int length = Math.min(chunk, data.length - offset);
                int written = connection.bulkTransfer(endpoint, data, offset, length, TIMEOUT_MS);
                if (written <= 0) throw new IOException("The USB printer stopped responding.");
                offset += written;
            }
            connection.releaseInterface(usbInterface);
        } finally {
            connection.close();
        }
    }
}
