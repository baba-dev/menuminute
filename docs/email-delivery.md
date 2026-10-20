# Transactional email delivery

MenuMinute authentication and security notifications call `sendAuthEmail()`. The compatibility
facade validates the application origin, creates the plain-text message and delegates to one private
server-side transport.

| `EMAIL_PROVIDER` | Required private settings                                                           | Behavior                                                                                  |
| ---------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `smtp`           | `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` | Authenticated SMTP; production requires implicit TLS and certificate/hostname validation. |
| `resend`         | `EMAIL_FROM`, `RESEND_API_KEY`                                                      | Existing Resend HTTPS API adapter.                                                        |
| `test`           | `AUTH_ALLOW_TEST_EMAIL=true` and isolated localhost/test database                   | In-process sink for tests only; rejected in production.                                   |

Production SMTP is `mx.bababuilds.com:465`, secure, with `food@bababuilds.com` as mailbox user and
sender. Store its password only in `/etc/menuminute/web.env`; never add it to GitHub, an artifact,
screenshots or command output. There is no provider fallback after authentication, TLS or delivery
failure.

## Rotation and troubleshooting

1. Confirm DNS resolution and TCP 465 reachability from the Oracle VPS.
2. Inspect the certificate with SNI `mx.bababuilds.com`; require a valid chain and hostname match.
3. Rotate the dedicated mailbox credential and update only the private VPS environment.
4. Run candidate preflight. It sends no mail, changes no data and reports variable names only.
5. Request one verification and password reset for controlled external accounts. Confirm messages
   arrive, links use `https://food.bababuilds.com`, and existing expiry/session behavior holds.
6. Inspect provider-side rejection counts without copying bodies, tokens, full recipients or secrets
   into logs.

Before activation, independently confirm SPF authorization, valid DKIM signing, DMARC alignment,
sender permission and inbox/spam placement across major providers. Prefer dedicated application
credentials and conservative per-account sending/abuse limits.

The app exposes no provider settings, credentials, arbitrary recipient tester or bulk-mail endpoint.
Future order notifications require separate queueing, retry, template, idempotency and abuse-control
design.
