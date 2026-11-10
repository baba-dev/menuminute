package com.bababuilds.menuminute;

import android.Manifest;
import android.app.Activity;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.ScrollView;
import android.widget.TextView;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Pattern;

/**
 * Native receipt printing for Bluetooth Classic and USB printers, which a Trusted Web Activity cannot
 * reach. Launched by the web app with {@code menuminute-print://receipt?grant=...}. The activity
 * downloads ESC/POS bytes with the signed grant, lets the user pick a printer and prints only after an
 * explicit tap. It never prints automatically, holds no business logic and keeps no receipt data after it
 * closes.
 */
public class PrintBridgeActivity extends Activity {
    private static final String PREFS = "print_bridge";
    private static final String PREF_LAST = "last_printer";
    private static final String ACTION_USB_PERMISSION = "com.bababuilds.menuminute.USB_PERMISSION";
    private static final int REQUEST_BLUETOOTH = 41;
    private static final Pattern GRANT = Pattern.compile("^[A-Za-z0-9_-]{20,1900}\\.[A-Za-z0-9_-]{20,200}$");

    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final List<PrinterOption> printers = new ArrayList<>();

    private TextView status;
    private ProgressBar progress;
    private RadioGroup list;
    private Button printButton;
    private Button testButton;
    private Button refreshButton;
    private Button pairButton;

    private byte[] receipt; // ESC/POS bytes downloaded for this launch; null until ready or for test prints only
    private boolean busy;
    private boolean receiptLoading;
    private boolean usbReceiverRegistered;
    private PrinterOption pendingUsbPrinter;
    private byte[] pendingUsbData;

    private final BroadcastReceiver usbPermissionReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (!ACTION_USB_PERMISSION.equals(intent.getAction())) return;
            PrinterOption option = pendingUsbPrinter;
            byte[] data = pendingUsbData;
            pendingUsbPrinter = null;
            pendingUsbData = null;
            boolean granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false);
            if (option == null || data == null) return;
            if (!granted) {
                finishJob("USB access was declined. Tap Print to try again.", false);
                return;
            }
            runPrint(option, data);
        }
    };

    @Override
    protected void onCreate(android.os.Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        buildUi();
        handleLaunch(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleLaunch(intent);
    }

    @Override
    protected void onResume() {
        super.onResume();
        refreshPrinters(); // picks up printers paired or plugged in while we were in Settings
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        worker.shutdownNow();
        if (usbReceiverRegistered) {
            try {
                unregisterReceiver(usbPermissionReceiver);
            } catch (IllegalArgumentException ignored) {
                // Already unregistered.
            }
            usbReceiverRegistered = false;
        }
        receipt = null;
    }

    // --- launch --------------------------------------------------------------------------------

    private void handleLaunch(Intent intent) {
        receipt = null;
        Uri data = intent == null ? null : intent.getData();
        String grant = data == null ? null : data.getQueryParameter("grant");
        if (grant == null) {
            // Opened without a receipt: still useful to verify a printer with a test page.
            setStatus("Choose a printer and send a test page to check the connection.");
            updateButtons();
            return;
        }
        if (!GRANT.matcher(grant).matches()) {
            setStatus("This print link is not valid. Go back and tap Print again.");
            updateButtons();
            return;
        }
        receiptLoading = true;
        setBusy(true, "Preparing receipt…");
        final String endpoint = getString(R.string.print_api_url);
        worker.execute(() -> {
            try {
                final byte[] bytes = ReceiptDownloader.fetch(endpoint, grant);
                runOnUiThread(() -> {
                    receiptLoading = false;
                    receipt = bytes;
                    setBusy(false, "Receipt ready. Choose a printer, then tap Print.");
                });
            } catch (IOException e) {
                runOnUiThread(() -> {
                    receiptLoading = false;
                    setBusy(false, e.getMessage() == null ? "Could not prepare the receipt." : e.getMessage());
                });
            }
        });
    }

    // --- printers ------------------------------------------------------------------------------

    private boolean bluetoothPermitted() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.S
                || checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
    }

    private void refreshPrinters() {
        printers.clear();
        if (bluetoothPermitted()) {
            printers.addAll(BluetoothPrinter.bonded(this));
        } else {
            requestPermissions(new String[] {Manifest.permission.BLUETOOTH_CONNECT}, REQUEST_BLUETOOTH);
        }
        printers.addAll(UsbPrinter.attached(this));
        Collections.sort(printers, (a, b) -> {
            if (a.likelyPrinter != b.likelyPrinter) return a.likelyPrinter ? -1 : 1;
            return a.label.compareToIgnoreCase(b.label);
        });
        renderPrinters();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQUEST_BLUETOOTH) return;
        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            refreshPrinters();
        } else {
            setStatus(getString(R.string.print_bluetooth_permission) + " USB printers still work.");
        }
    }

    private void renderPrinters() {
        String last = getSharedPreferences(PREFS, MODE_PRIVATE).getString(PREF_LAST, "");
        String selected = selectedKey();
        list.removeAllViews();
        for (int i = 0; i < printers.size(); i++) {
            PrinterOption option = printers.get(i);
            RadioButton radio = new RadioButton(this);
            radio.setId(View.generateViewId());
            radio.setTag(option.key());
            radio.setText(option.label);
            radio.setTextSize(16);
            radio.setMinHeight(dp(48));
            list.addView(radio, new RadioGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
            if (option.key().equals(selected) || (selected == null && option.key().equals(last))) radio.setChecked(true);
        }
        if (printers.isEmpty()) {
            TextView empty = new TextView(this);
            empty.setText(R.string.print_no_printers);
            empty.setPadding(0, dp(8), 0, dp(8));
            list.addView(empty);
        } else if (list.getCheckedRadioButtonId() == -1) {
            ((RadioButton) list.getChildAt(0)).setChecked(true);
        }
        updateButtons();
    }

    private String selectedKey() {
        int id = list.getCheckedRadioButtonId();
        if (id == -1) return null;
        View checked = list.findViewById(id);
        return checked == null ? null : (String) checked.getTag();
    }

    private PrinterOption selectedPrinter() {
        String key = selectedKey();
        if (key == null) return null;
        for (PrinterOption option : printers) if (option.key().equals(key)) return option;
        return null;
    }

    // --- printing ------------------------------------------------------------------------------

    private void onPrintTapped(boolean test) {
        if (busy || receiptLoading) return;
        PrinterOption option = selectedPrinter();
        if (option == null) {
            setStatus(getString(R.string.print_no_printers));
            return;
        }
        byte[] data = test ? testPage() : receipt;
        if (data == null) {
            setStatus("There is no receipt to print. Go back and tap Print again, or send a test page.");
            return;
        }
        if (PrinterOption.USB.equals(option.kind)) {
            UsbDevice device = UsbPrinter.find(this, option.id);
            UsbManager manager = UsbPrinter.manager(this);
            if (device == null || manager == null) {
                setStatus("That USB printer was unplugged. Reconnect it and tap Refresh.");
                refreshPrinters();
                return;
            }
            if (!manager.hasPermission(device)) {
                requestUsbPermission(manager, device, option, data);
                return;
            }
        }
        runPrint(option, data);
    }

    private void requestUsbPermission(UsbManager manager, UsbDevice device, PrinterOption option, byte[] data) {
        if (!usbReceiverRegistered) {
            IntentFilter filter = new IntentFilter(ACTION_USB_PERMISSION);
            if (Build.VERSION.SDK_INT >= 33) registerReceiver(usbPermissionReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
            else registerReceiver(usbPermissionReceiver, filter);
            usbReceiverRegistered = true;
        }
        pendingUsbPrinter = option;
        pendingUsbData = data;
        // Explicit and (on 12+) mutable: the system adds the permission result to this intent.
        Intent intent = new Intent(ACTION_USB_PERMISSION).setPackage(getPackageName());
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0;
        setBusy(true, "Waiting for USB permission…");
        manager.requestPermission(device, PendingIntent.getBroadcast(this, 0, intent, flags));
    }

    private void runPrint(PrinterOption option, byte[] data) {
        setBusy(true, "Sending to " + option.label + "…");
        worker.execute(() -> {
            try {
                if (PrinterOption.BLUETOOTH.equals(option.kind)) {
                    BluetoothPrinter.print(getApplicationContext(), option.id, data);
                } else {
                    UsbDevice device = UsbPrinter.find(getApplicationContext(), option.id);
                    if (device == null) throw new IOException("That USB printer was unplugged.");
                    UsbPrinter.print(getApplicationContext(), device, data);
                }
                getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(PREF_LAST, option.key()).apply();
                runOnUiThread(() -> finishJob("Sent to the printer. Check that it printed before closing.", true));
            } catch (SecurityException e) {
                runOnUiThread(() -> finishJob(getString(R.string.print_bluetooth_permission), false));
            } catch (IOException e) {
                runOnUiThread(() -> finishJob(e.getMessage() == null ? "Printing failed." : e.getMessage(), false));
            }
        });
    }

    private void finishJob(String message, boolean ok) {
        setBusy(false, message);
        if (ok) printButton.setText(R.string.print_action);
    }

    /** ESC @ (init), text, feed. No cut command: not every printer implements one. */
    private static byte[] testPage() {
        byte[] init = {0x1B, 0x40};
        byte[] text = "MenuMinute test print\nIf you can read this, the printer is connected.\n\n\n\n".getBytes(StandardCharsets.US_ASCII);
        byte[] out = new byte[init.length + text.length];
        System.arraycopy(init, 0, out, 0, init.length);
        System.arraycopy(text, 0, out, init.length, text.length);
        return out;
    }

    // --- UI ------------------------------------------------------------------------------------

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void setStatus(String message) {
        status.setText(message);
    }

    private void setBusy(boolean value, String message) {
        busy = value;
        progress.setVisibility(value ? View.VISIBLE : View.GONE);
        setStatus(message);
        updateButtons();
    }

    private void updateButtons() {
        boolean idle = !busy && !receiptLoading;
        boolean hasPrinter = selectedPrinter() != null;
        printButton.setEnabled(idle && hasPrinter && receipt != null);
        testButton.setEnabled(idle && hasPrinter);
        refreshButton.setEnabled(idle);
        pairButton.setEnabled(idle);
        printButton.setVisibility(receipt != null || receiptLoading ? View.VISIBLE : View.GONE);
    }

    private Button button(int label, View.OnClickListener listener) {
        Button button = new Button(this);
        button.setText(label);
        button.setAllCaps(false);
        button.setMinHeight(dp(48));
        button.setOnClickListener(listener);
        return button;
    }

    private void buildUi() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(20), dp(20), dp(20), dp(12));

        TextView title = new TextView(this);
        title.setText(R.string.print_title);
        title.setTextSize(22);
        title.setPadding(0, 0, 0, dp(4));
        root.addView(title);

        status = new TextView(this);
        status.setTextSize(15);
        status.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
        status.setPadding(0, dp(4), 0, dp(8));
        root.addView(status);

        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setIndeterminate(true);
        progress.setVisibility(View.GONE);
        root.addView(progress, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        TextView choose = new TextView(this);
        choose.setText(R.string.print_choose_printer);
        choose.setTextSize(16);
        choose.setPadding(0, dp(8), 0, dp(4));
        root.addView(choose);

        list = new RadioGroup(this);
        list.setOnCheckedChangeListener((group, id) -> updateButtons());
        root.addView(list);

        printButton = button(R.string.print_action, v -> onPrintTapped(false));
        testButton = button(R.string.print_test_action, v -> onPrintTapped(true));
        refreshButton = button(R.string.print_refresh, v -> refreshPrinters());
        pairButton = button(R.string.print_pair_bluetooth, v -> startActivity(new Intent(Settings.ACTION_BLUETOOTH_SETTINGS)));
        Button close = button(R.string.print_close, v -> finish());

        for (Button b : new Button[] {printButton, testButton, refreshButton, pairButton, close}) {
            root.addView(b, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        }

        ScrollView scroll = new ScrollView(this);
        scroll.addView(root);
        setContentView(scroll);
    }
}
