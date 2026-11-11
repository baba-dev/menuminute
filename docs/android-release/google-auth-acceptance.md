# Android / web Google authentication acceptance

MenuMinute's Play app is an Android Trusted Web Activity (Chrome), not a WebView.
The registered Google OAuth client is a **Web application** pointing at
`https://food.bababuilds.com/api/auth/callback/google`. Do not use an Android-only
OAuth redirect, and do not publish Google client secrets in app resources.

## Supported journeys

- Existing account, already linked to Google: sign in from the first screen; return to the
  validated `next` path (the TWA uses `/app`).
- Existing email/password-only account: do **not** silently link by matching email.
  Authenticate with password first, then explicitly link under Account Security.
- New owner: first-screen Create free account -> registration, check current Terms/Privacy
  acceptance -> Continue with Google -> Google identity -> verified session -> first outlet
  onboarding. A password is not required for a Google-created account.
- New owner via email/password: the existing signup, deferred verification and onboarding
  remain available.
- A user protected by TOTP cannot bypass the authenticator with Google. Continue with
  email/password and TOTP instead.

The backend requires `requestSignUp` and signed server-side OAuth consent state before
creating an account through Google. Linked-account sign-in never creates users implicitly.
No new database migration or Android binary change is needed.

## Production verification (not proven by CI)

1. Confirm `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` exist on the production web
   service and the Google Cloud OAuth consent screen is published/available to testers.
2. Confirm the **Authorized redirect URI** is exactly
   `https://food.bababuilds.com/api/auth/callback/google`.
   This is unrelated to Android App Links / `assetlinks.json`.
3. Test on the installed Play closed-testing TWA using a fresh Google identity. Consent,
   browser return, authenticated session, welcome onboarding and app relaunch must work.
4. Test a previously linked account and an email/password-only account with the same email:
   the latter must remain unlinked until authenticated account-security linking.
5. Verify declining the legal checkbox blocks Google registration; manipulation of
   `additionalData` and a missing or expired consent state cannot create a user.
6. Test both light/dark, narrow phone widths, keyboard accessibility and failure messages.
7. Verify an MFA-enabled account remains blocked by Google sign-in.
8. Record the deployed release SHA, Chrome version, device/Android version, and results.

Google rejects sign-in inside some embedded WebViews. The Play client uses Chrome TWA:
do **not** add an unreviewed native WebView or pass Google tokens to Android Java code.
