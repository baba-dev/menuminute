package com.bababuilds.menuminute;

/** One selectable printer: a bonded Bluetooth Classic device or an attached USB device. */
final class PrinterOption {
    static final String BLUETOOTH = "bt";
    static final String USB = "usb";

    final String kind;
    /** Bluetooth MAC address or USB device name (stable while attached). */
    final String id;
    final String label;
    /** Likely a printer (imaging class / printer USB class); used only to sort the list. */
    final boolean likelyPrinter;

    PrinterOption(String kind, String id, String label, boolean likelyPrinter) {
        this.kind = kind;
        this.id = id;
        this.label = label;
        this.likelyPrinter = likelyPrinter;
    }

    String key() {
        return kind + ":" + id;
    }
}
