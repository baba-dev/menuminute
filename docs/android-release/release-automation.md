# Two independent MenuMinute release pipelines

MenuMinute is a live Next.js application wrapped by an Android Trusted Web Activity (TWA). **Website changes** continue through the existing CI → ARM64 VPS deploy; users see the updated site when they reload/navigate, subject to browser/service-worker caching. Web-only changes **do not require Google Play updates**.

**Native Android changes** (files in `android/`, `scripts/android/`, or `.github/workflows/android-release.yml`) produce a signed candidate **after successful push CI on the exact current main SHA**. Pull requests, failed CI, superseded commits and web-only changes do not access signing secrets. Required Android compilation still runs as part of ordinary CI.

## Managed version numbers

- The first manually signed AAB is `versionCode=1`, `versionName=1.0.0`.
- Every **new** invocation of the existing `Android signed internal-release candidate` workflow receives `versionCode = github.run_number + 1` and `versionName = 1.0.<run_number>`. The version line `1.0` is configured in the workflow. Codes strictly increase across **new workflow runs**; gaps are normal. No version bump commit is required.
- **Do not re-upload the same run**: GitHub reruns keep the same `run_number`. If a bundle was accepted by Play, manually dispatch a **new** workflow run for a new version code. Preserve this workflow's identity/history; reconcile the highest Play-accepted version if you ever replace it or migrate workflows.
- Google Play caps `versionCode` at `2100000000`; the planner and Gradle both reject out-of-range numbers.
- Default unsigned debug/CI Android builds stay at v1.0.0/code 1. The protected signed workflow injects its version into Gradle.
- After cryptographic verification, a signed candidate produces only `app-release.aab`, `app-release.aab.sha256` and `android-release.json` (including source SHA, workflow run ID, and version). These remain available in GitHub Actions for **30 days**. **No Play upload happens from the signing workflow.**
- A manual `workflow_dispatch` can prepare a new candidate on the exact current `main` only after successful push CI.

## Separate operator-approved Google Play upload

The `Google Play internal draft submission` workflow is **manual only**. It fetches the precise previously signed run and checks: successful signing provenance, user-confirmed full SHA, artifact existence, SHA-256 checksum, package identity and release metadata. It never rebuilds or re-signs an artifact.

**Before enabling it, the owner must:**

1. Finish developer verification and **upload the first AAB manually** to Play Console's Internal Testing track; enroll in Play App Signing. Obtain Google's **app-signing** SHA-256 certificate for `assetlinks.json`. The Play Developer API action expects an app/package already registered through Play Console.
2. Create the **separate** GitHub Actions environment named `android-play-publish`. Restrict its deployment branches to `main`, enable **required reviewer approval**, and disable administrator bypass where supported. Do not use `android-play-internal` for publishing. An unknown environment name can be auto-created by GitHub without protections, so the workflow independently requires a deliberate enable flag before making any Google API call.
3. Enable the **Google Play Android Developer API** in Google Cloud. Configure an approved Workload Identity Federation provider with an identity condition restricting access to this repository and the `android-play-publish` environment. Grant a dedicated service account **app-scoped** Play Console permissions sufficient to create/update **internal testing** releases only. No JSON service account private-key download is required. Verify the federation trust with your cloud administrator.
4. Under `android-play-publish` **environment variables**, set `PLAY_PUBLISH_ENABLED=true`, `PLAY_WIF_PROVIDER=<provider resource name>`, `PLAY_SERVICE_ACCOUNT_EMAIL=<publisher account email>`. Do not set the enable flag until the environment has reviewer protection.
5. Invoke `Google Play internal draft submission` on `main`, providing the successful signed-run ID and the full, reviewed 40-character source SHA. After environmental approval, the workflow uploads the verified AAB to **internal** track with `status: draft` and `changesNotSentForReview: true`. It does **not** submit a public production release or distribute the draft automatically. The owner must inspect and approve the draft in Play Console.

The Play upload job requires human review in GitHub **and** an explicit Play Console distribution action. A passing workflow is not proof of Play Store compliance, app integrity verification, billing correctness, physical-printer compatibility or Google approval.

## Daily operating model

- **Web-only update:** Merge → main CI → VPS deployment → existing Android users see refreshed web content. No signed AAB is produced.
- **Android/native update:** Merge → main CI → automated signed candidate with new code → manual testing/download → separate optional Play draft upload → human Play Console release.
- **Hotfix to installed native shell:** Manually dispatch new signed candidate on green `main`, then follow the same operator approvals.
- **Billing/web compatibility:** Keep server-side API contracts compatible with older installed Android versions until Play updates reach users.
- **Secrets:** Reuse the _same_ encrypted offline upload JKS and protected `android-play-internal` secrets for every Android build. Google Play uses a distinct app-signing key.

Also see `docs/android-release/signing-setup.md`, `docs/android-release/play-compliance.md` and `docs/android-release/device-test-matrix.md`. Neither the web publishing workflow nor the VPS deployment workflow is changed by this architecture.
