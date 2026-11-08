# Private Google Play upload-key setup (no JDK installation)

**Owner-operated only.** Never commit, upload to an issue/PR, send in chat, or attach the private `.jks`, Base64 text, or passwords. This procedure is independent of PR #342's Google Play Billing work.

## 1. Generate the permanent upload key on the owner's Windows PC

Download and review `scripts/android/prepare-play-signing.ps1` from this repository. Run it in PowerShell from the directory containing that file:

```powershell
powershell.exe -NoProfile -File .\prepare-play-signing.ps1
```

If local execution policy blocks the downloaded script, use **process-only** execution policy after inspecting the file:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\prepare-play-signing.ps1
```

The script fetches **Eclipse Temurin JDK 17** as a ZIP and checks the archive against the SHA-256 returned by the official Adoptium API before running `keytool.exe`. It installs nothing and deletes the temporary download after key creation. It refuses to overwrite an existing key.

Output: `%USERPROFILE%\MenuMinute-Play-Signing\menuminute-upload.jks` (RSA-3072, alias `menuminute-upload`, JKS).

**Back up the original JKS privately and securely** in at least one encrypted backup location, along with both the store and key passwords. Do not generate another key each release. Losing the upload key requires going through Google Play's upload-key reset process.

## 2. Configure GitHub's signing environment

In [Repository Settings → Environments](https://github.com/baba-dev/menuminute/settings/environments):

1. Create an environment named **exactly** `android-play-internal`.
2. Set **Deployment branches and tags → Selected branches and tags → Branch: main**. On supported plans, add an independent required reviewer, and disallow bypass if available.
3. Under **Environment secrets** (not repository secrets or variables), add the four secrets below:

| Secret | Value |
| --- | --- |
| `ANDROID_UPLOAD_KEYSTORE_BASE64` | Base64-encoded contents of the `.jks` file |
| `ANDROID_UPLOAD_STORE_PASSWORD` | Private JKS store password |
| `ANDROID_UPLOAD_KEY_ALIAS` | `menuminute-upload` |
| `ANDROID_UPLOAD_KEY_PASSWORD` | Private key password, which may equal the store password |

On the owner's Windows PC, this command copies the **sensitive** JKS Base64 to clipboard for immediate pasting into GitHub's environment secret editor:

```powershell
$path = Join-Path $env:USERPROFILE 'MenuMinute-Play-Signing\menuminute-upload.jks'
if (-not (Test-Path -LiteralPath $path)) { throw 'Upload JKS missing' }
[Convert]::ToBase64String([IO.File]::ReadAllBytes($path)) | Set-Clipboard
```

After pasting, run `Set-Clipboard -Value ''`. Do not save the Base64 to a text file, browser note or terminal transcript.

GitHub hides secret values after saving; you can verify the **four secret names** exist, but not read them back. Maintain your separate backup.

## 3. Create a signed internal-release candidate (not a Play submission)

Wait until the intended app changes in [PR #342](https://github.com/baba-dev/menuminute/pull/342) are merged into `main` and exact-head CI/Android build is green. In [GitHub Actions → Android signed internal-release candidate](https://github.com/baba-dev/menuminute/actions/workflows/android-release.yml), choose `Run workflow` with **main**.

The workflow checks that all four environment secrets are configured; decodes the JKS in its temporary private directory; builds `:app:bundleRelease` with the upload key; runs `jarsigner -verify -strict`; and uploads an AAB and SHA-256 as a **7-day** Actions artifact. No secrets, passwords, or JKS are uploaded as artifacts. Download the AAB ZIP before expiration and retain the SHA-256 for the release record.

**Never upload an unsigned/debug AAB or APK as the first release.** The package ID is `com.bababuilds.menuminute`. Keep the original upload key for future versions.

## 4. Google Play App Signing (only after Play Console approval)

Upload the signed AAB into a Play **Internal testing** release; enroll in **Play App Signing** with Google-managed app signing where available.

From Play Console's App integrity section obtain **App signing key certificate → SHA-256**; this is distinct from the **Upload key certificate**. The public website's `ANDROID_PLAY_APP_SIGNING_SHA256` must contain the **app signing** fingerprint, never the upload fingerprint. Verify public `/.well-known/assetlinks.json` returns 200 with the matching package and fingerprint before expecting TWA fullscreen.

See `docs/android-release/README.md`, `docs/android-release/device-test-matrix.md`, and `docs/android-release/play-billing.md` (after PR #342 is merged) for release gates. Internal testing does not waive actual device checks.

## Security rules

- Do not place the JKS under the repository working tree.
- Do not commit signing files or upload them to CI artifacts.
- Do not send passwords/Base64 in issue discussions or ChatGPT.
- The browser and GitHub App connected to ChatGPT cannot safely provision secrets from the user's local PC; the owner must enter them into the environment.
- Only sign reviewed `main` after the correct Android build has passed CI.
