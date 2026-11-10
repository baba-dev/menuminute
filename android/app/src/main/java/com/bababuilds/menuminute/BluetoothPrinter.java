package com.bababuilds.menuminute;

import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothClass;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import java.io.IOException;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Bluetooth Classic (RFCOMM / Serial Port Profile) transport. Printers must be paired first in Android
 * settings. Callers must hold BLUETOOTH_CONNECT on Android 12+ before calling any method here.
 */
@SuppressLint("MissingPermission")
final class BluetoothPrinter {
    private static final UUID SPP = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private static final int CHUNK = 512;

    private BluetoothPrinter() {}

    static BluetoothAdapter adapter(Context context) {
        BluetoothManager manager = (BluetoothManager) context.getSystemService(Context.BLUETOOTH_SERVICE);
        return manager == null ? null : manager.getAdapter();
    }

    static List<PrinterOption> bonded(Context context) {
        List<PrinterOption> result = new ArrayList<>();
        BluetoothAdapter adapter = adapter(context);
        if (adapter == null || !adapter.isEnabled()) return result;
        for (BluetoothDevice device : adapter.getBondedDevices()) {
            BluetoothClass klass = device.getBluetoothClass();
            boolean imaging = klass != null && klass.getMajorDeviceClass() == BluetoothClass.Device.Major.IMAGING;
            String name = device.getName() == null ? device.getAddress() : device.getName();
            result.add(new PrinterOption(PrinterOption.BLUETOOTH, device.getAddress(), name + " · Bluetooth", imaging));
        }
        return result;
    }

    /** Blocking. Tries the secure RFCOMM channel, then the insecure one (some printers need it). */
    static void print(Context context, String address, byte[] data) throws IOException {
        BluetoothAdapter adapter = adapter(context);
        if (adapter == null || !adapter.isEnabled()) throw new IOException("Turn Bluetooth on and try again.");
        BluetoothDevice device;
        try {
            device = adapter.getRemoteDevice(address);
        } catch (IllegalArgumentException e) {
            throw new IOException("That printer is no longer available.");
        }
        adapter.cancelDiscovery();
        BluetoothSocket socket = null;
        IOException failure = null;
        for (int attempt = 0; attempt < 2 && socket == null; attempt++) {
            BluetoothSocket candidate = null;
            try {
                candidate = attempt == 0
                        ? device.createRfcommSocketToServiceRecord(SPP)
                        : device.createInsecureRfcommSocketToServiceRecord(SPP);
                candidate.connect();
                socket = candidate;
            } catch (IOException e) {
                failure = e;
                closeQuietly(candidate);
            }
        }
        if (socket == null) {
            throw new IOException("Could not connect. Make sure the printer is on, in range and paired.", failure);
        }
        try {
            OutputStream out = socket.getOutputStream();
            for (int offset = 0; offset < data.length; offset += CHUNK) {
                out.write(data, offset, Math.min(CHUNK, data.length - offset));
                out.flush();
                // Cheap printers have tiny buffers; pacing prevents dropped or garbled lines.
                Thread.sleep(15);
            }
            Thread.sleep(400); // let the printer drain before the link is closed
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("Printing was interrupted.");
        } finally {
            closeQuietly(socket);
        }
    }

    private static void closeQuietly(BluetoothSocket socket) {
        if (socket == null) return;
        try {
            socket.close();
        } catch (IOException ignored) {
            // Nothing useful to do.
        }
    }
}
