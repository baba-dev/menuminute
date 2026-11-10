#!/usr/bin/env bash
# Deterministic proof of the server half of the Android launch path. No emulator needed.
# Usage: verify-launch-contract.sh [origin]   (default https://food.bababuilds.com)
# Optional: EXPECT_ASSETLINKS_SHA256=AA:BB:..  also pins the Play App Signing fingerprint.
# Regression guard for the 2026-11-10 incident: /api/app/launch redirected to https://localhost:3100/app.
set -uo pipefail
origin="${1:-https://food.bababuilds.com}"
origin="${origin%/}"
failed=0
fail() { echo "::error::$*"; failed=1; }
ok() { echo "ok: $*"; }

headers() { curl -sS -m 25 -o /dev/null -D - "$@" | tr -d '\r'; }
status_of() { awk 'toupper($1) ~ /^HTTP/ {code=$2} END {print code}' <<<"$1"; }
header_of() { awk -v k="$2" 'BEGIN{IGNORECASE=1} tolower($0) ~ "^"tolower(k)":" {sub(/^[^:]*: */,""); v=$0} END {print v}' <<<"$1"; }

# 1. Play entry: relative or same-origin redirect to /app, never an internal listener.
launch="$(headers "$origin/api/app/launch")" || { fail "GET /api/app/launch unreachable"; launch=""; }
code="$(status_of "$launch")"; location="$(header_of "$launch" location)"; cookie="$(header_of "$launch" set-cookie)"
[[ "$code" == "307" ]] && ok "launch status 307" || fail "launch status is '$code', expected 307"
if [[ "$location" == "/app" || "$location" == "$origin/app" ]]; then ok "launch location '$location'"; else fail "launch Location is '$location' (expected /app on $origin). Internal host leak?"; fi
if grep -Eqi 'localhost|127\.0\.0\.1|0\.0\.0\.0|:[0-9]{4,5}(/|$)' <<<"$location"; then fail "launch Location leaks an internal address: $location"; fi
for attr in "menuminute.play_client=1" "HttpOnly" "Secure" "SameSite=lax"; do
  grep -qi -- "$attr" <<<"$cookie" || fail "launch cookie missing '$attr'"
done
grep -qi "no-store" <<<"$(header_of "$launch" cache-control)" || fail "launch response is cacheable"

# 2. /app is login-gated and returns to /app afterwards.
app="$(headers "$origin/app")" || app=""
app_loc="$(header_of "$app" location)"
if [[ "$app_loc" == *"/login?next=%2Fapp"* ]]; then ok "/app -> $app_loc"; else fail "/app redirect is '$app_loc', expected /login?next=%2Fapp when signed out"; fi
if grep -Eqi 'localhost|127\.0\.0\.1' <<<"$app_loc"; then fail "/app redirect leaks an internal address"; fi

# 3. The page the user lands on renders over HTTPS.
login="$(curl -sS -m 25 -o /tmp/mm-login.html -w '%{http_code} %{url_effective}' "$origin/login")" || login=""
[[ "${login%% *}" == "200" ]] && ok "login page 200" || fail "login page returned '$login'"
if grep -qi 'localhost:[0-9]' /tmp/mm-login.html 2>/dev/null; then fail "login HTML references localhost"; fi

# 4. Digital Asset Links: required for a fullscreen (no browser bar) TWA.
al_body="$(curl -sS -m 25 -w '\n%{http_code}' "$origin/.well-known/assetlinks.json")" || al_body=""
al_code="${al_body##*$'\n'}"; al_json="${al_body%$'\n'*}"
if [[ "$al_code" != "200" ]]; then
  fail "assetlinks.json returned $al_code (TWA will show a browser bar until it is 200)"
else
  fp="$(python3 -I - "$al_json" <<'PY'
import json, re, sys
try:
    data = json.loads(sys.argv[1])
    t = next(x["target"] for x in data if x["target"].get("package_name") == "com.bababuilds.menuminute")
    fps = [f for f in t["sha256_cert_fingerprints"] if re.fullmatch(r"(?:[0-9A-F]{2}:){31}[0-9A-F]{2}", f)]
    print(",".join(fps))
except Exception:
    print("")
PY
)"
  if [[ -z "$fp" ]]; then fail "assetlinks.json has no valid fingerprint for com.bababuilds.menuminute"; else ok "assetlinks fingerprint(s): $fp"; fi
  if [[ -n "${EXPECT_ASSETLINKS_SHA256:-}" && ",$fp," != *",${EXPECT_ASSETLINKS_SHA256^^},"* ]]; then
    fail "assetlinks fingerprint does not match the pinned Play App Signing fingerprint"
  fi
fi

if [[ "$failed" -ne 0 ]]; then echo "Launch contract FAILED for $origin"; exit 1; fi
echo "Launch contract passed for $origin"
