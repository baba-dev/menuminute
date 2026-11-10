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

# --- Destination check: a crash-free start is not enough; the screen must be the real login page. ---
# Regression guard for 2026-11-10 (the TWA opened https://localhost:3100/app and still "passed").
# STRICT_DESTINATION=true fails the job; otherwise the problem is reported as a warning (pull requests
# run against the currently DEPLOYED server, which can lag the code under review).
strict="${STRICT_DESTINATION:-false}"
classifier="$(dirname "$0")/classify-ui.py"
verdict="unknown"
for attempt in $(seq 1 30); do
  adb shell uiautomator dump /sdcard/ui.xml > /dev/null 2>&1 || true
  adb pull /sdcard/ui.xml "$out/ui.xml" > /dev/null 2>&1 || true
  adb exec-out screencap -p > "$out/screen-$attempt.png" 2> /dev/null || true
  verdict="$(python3 -I "$classifier" "$out/ui.xml" 2>&1 | tail -n 1)"
  echo "attempt $attempt: $verdict"
  case "$verdict" in
    good*|bad*) break ;;
    tap\ *) read -r _ x y <<< "$verdict"; adb shell input tap "$x" "$y" || true ;;
  esac
  sleep 5
done
cp "$out/screen-$attempt.png" "$out/final-screen.png" 2> /dev/null || true
echo "$verdict" > "$out/destination-verdict.txt"
case "$verdict" in
  good*)
    echo "Destination check passed: the app shows the MenuMinute login/app screen ($verdict)." ;;
  *)
    msg="Destination check did not confirm the login page: $verdict (see final-screen.png and ui.xml artifacts)."
    if [ "$strict" = "true" ]; then echo "::error::$msg"; exit 1; fi
    echo "::warning::$msg" ;;
esac
echo "NOTE: This checks the unsigned debug APK, not Google Play's re-signed bundle on the user's device."
