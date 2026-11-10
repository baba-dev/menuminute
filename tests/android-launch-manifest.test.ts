import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const manifest = readFileSync(path.resolve("android/app/src/main/AndroidManifest.xml"), "utf8");
const application = manifest.split("<application")[1]?.split("</application>")[0] ?? "";

describe("Android Browser Helper startup manifest completeness", () => {
  it("declares the helper's site-settings activity before the TWA launcher", () => {
    // LauncherActivity calls ManageDataLauncherActivity.addSiteSettingsShortcut()
    // unconditionally; Android throws if its component is missing from the manifest.
    expect(application).toContain(
      'android:manageSpaceActivity="com.google.androidbrowserhelper.trusted.ManageDataLauncherActivity"'
    );
    expect(application).toContain(
      'android:name="com.google.androidbrowserhelper.trusted.ManageDataLauncherActivity"'
    );
    expect(application).toContain('android:exported="false"');
    expect(application).toContain(
      'android:name="android.support.customtabs.trusted.MANAGE_SPACE_URL"'
    );
    expect(application.indexOf("ManageDataLauncherActivity")).toBeLessThan(
      application.indexOf('android:name="com.google.androidbrowserhelper.trusted.LauncherActivity"')
    );
  });

  it("preserves the installed package, Play Billing integrations, and trusted origin", () => {
    expect(application).toContain("@string/asset_statements");
    expect(application).toContain("@string/launch_url");
    expect(application).toContain('android:name=".ExtraFeaturesService"');
    expect(application).toContain(
      'android:name="com.google.androidbrowserhelper.playbilling.provider.PaymentActivity"'
    );
  });

  it("ships a polished native shell: adaptive and themed icon, splash, system bars, short label", () => {
    const res = (file: string) =>
      readFileSync(path.resolve("android/app/src/main/res", file), "utf8");
    expect(application).toContain('android:icon="@mipmap/ic_launcher"');
    expect(application).toContain('android:roundIcon="@mipmap/ic_launcher_round"');
    expect(res("mipmap-anydpi/ic_launcher.xml")).toContain("<monochrome");
    expect(res("mipmap-anydpi/ic_launcher.xml")).toContain("<foreground");
    for (const key of [
      "STATUS_BAR_COLOR",
      "STATUS_BAR_COLOR_DARK",
      "NAVIGATION_BAR_COLOR",
      "NAVIGATION_BAR_COLOR_DARK",
      "SPLASH_IMAGE_DRAWABLE",
      "SPLASH_SCREEN_BACKGROUND_COLOR",
      "FILE_PROVIDER_AUTHORITY",
    ])
      expect(application).toContain(`android.support.customtabs.trusted.${key}"`);
    expect(application).toContain("androidx.core.content.FileProvider");
    expect(application).toContain("android.support.customtabs.trusted.SMALL_ICON");
    // Launcher labels longer than ~12 characters truncate on most launchers.
    const label = /<string name="app_name">([^<]+)</.exec(res("values/strings.xml"))?.[1] ?? "";
    expect(label.length).toBeLessThanOrEqual(14);
  });

  it("keeps merchant deep links in the app and diner menus in the browser", () => {
    for (const prefix of ["/api/app/launch", "/app", "/login", "/dashboard", "/kitchen", "/invite"])
      expect(application).toContain(`android:pathPrefix="${prefix}"`);
    expect(application).not.toContain('android:pathPrefix="/m"');
    expect(application).not.toContain('android:pathPrefix="/"');
  });

  it("declares the Bluetooth Classic and USB print bridge without making printers mandatory", () => {
    expect(manifest).toContain('android:name="android.permission.BLUETOOTH_CONNECT"');
    expect(manifest).toMatch(/BLUETOOTH"\s+android:maxSdkVersion="30"/);
    expect(manifest).toContain('android:name="android.permission.POST_NOTIFICATIONS"');
    expect(manifest).toMatch(/android.hardware.bluetooth"\s+android:required="false"/);
    expect(manifest).toMatch(/android.hardware.usb.host"\s+android:required="false"/);
    expect(application).toContain('android:name=".PrintBridgeActivity"');
    expect(application).toContain('android:scheme="menuminute-print" android:host="receipt"');
    // The print endpoint is a fixed HTTPS resource in strings.xml, never read from the intent.
    const strings = readFileSync(
      path.resolve("android/app/src/main/res/values/strings.xml"),
      "utf8"
    );
    expect(strings).toContain("https://food.bababuilds.com/api/native-print/receipt");
    const bridge = readFileSync(
      path.resolve("android/app/src/main/java/com/bababuilds/menuminute/PrintBridgeActivity.java"),
      "utf8"
    );
    expect(bridge).toContain('getQueryParameter("grant")');
    expect(bridge).not.toMatch(/getQueryParameter\("(url|endpoint|host)"\)/);
  });
});
