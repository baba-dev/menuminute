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
});
