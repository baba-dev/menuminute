#!/usr/bin/env bash
# Run inside a clean Google Play emulator via android-emulator-runner.
# Captures startup failures from the actual launcher before further Play releases.
set -Eeuo pipefail
pkg="com.bababuilds.menuminute"
activity="com.google.androidbrowserhelper.trusted.LauncherActivity"
out="android-launch-smoke"
mkdir -p "$out"
adb wait-for-device
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell pm list packages > "$out/packages.txt"
adb shell dumpsys package "$pkg" > "$out/installed-package.txt"
adb shell getprop ro.build.version.release > "$out/android-version.txt"
adb shell settings put global window_animation_scale 0
adb logcat -c
adb shell am force-stop "$pkg"
echo "Launching $pkg/$activity in the clean emulator..."
if ! adb shell am start -W -n "$pkg/$activity" > "$out/launch-result.txt" 2>&1; then
  cat "$out/launch-result.txt"
  exit 1
fi
sleep 22
adb logcat -d -v threadtime -b crash > "$out/crash-buffer.txt" 2>&1 || true
adb logcat -d -v threadtime AndroidRuntime:E TWALauncherActivity:V TwaLauncher:V QualityEnforcer:V ActivityTaskManager:W '*:S' > "$out/twa-startup-log.txt" 2>&1 || true
adb shell dumpsys activity activities > "$out/activity-state.txt" || true
cat "$out/launch-result.txt"
if grep -Eq "(Process: $pkg|Process $pkg .* has died|FATAL EXCEPTION)" "$out/crash-buffer.txt"; then
  echo "::error::Android launcher reported a Java crash. See captured crash-buffer.txt artifact."
  sed -n '1,100p' "$out/crash-buffer.txt"
  exit 1
fi
echo "Clean-emulator startup did not report a Java fatal exception."
echo "NOTE: This checks the unsigned debug APK, not Google Play's re-signed bundle on the user's device."
