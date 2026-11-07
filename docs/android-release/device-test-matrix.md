# Android acceptance matrix

Record build SHA, signed AAB SHA256, Android build/OS, Chrome version, printer vendor/model/firmware and timestamp for each case. Mark untested as untested, not passed.

| Area                   | Acceptance                                                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Install & verification | Play Internal Testing install, TWA full screen verified with Digital Asset Links; relaunch signed-in and signed-out              |
| Chrome fallback        | Browser missing / unsupported should fail intelligibly rather than silently break                                                |
| Launch                 | Signed-out login; already-signed-in dashboard; first outlet onboarding; back stack no loop                                       |
| Auth                   | Email signup and verification; password login; Google OAuth and 2FA; sign-out/revoke device                                      |
| Phone layouts          | 320/360/390/430 width; device portrait/landscape; keyboard/safe area; no clipped actions                                         |
| Tablets                | 7, 8 and 10 inch screens: POS and Kitchen with rotation/lock/sleep                                                               |
| POS                    | Enter cart, choose guest, tender, accept and verify immutable receipt, no repeated orders                                        |
| Printing               | Android Print/PDF; BLE printer 58/80 mm, long names, Unicode fallback, disconnection, denied Bluetooth, failed writes and cancel |
| Bluetooth Classic      | Blocked pending separate native SPP bridge and approved hardware QA                                                              |
| Kitchen                | Pending -> preparing -> ready, network flaps, foreground/background, wake lock fallback                                          |
| Push                   | Opt-in/deny, idle/closed app, multi-outlet isolation, revocation (only when rollout enabled)                                     |
| Uploads                | Camera and gallery menu import with user permission, JPEG/HEIC/PNG and upload errors                                             |
| Offline                | Private routes fail closed; guest snapshot displays stale warning; no offline orders queued                                      |
| Play commerce          | No external SaaS checkout in the Play build, even via `/billing`, `/pricing`, deep links, trial prompts or upgrade banners       |
| Accounts               | In-app request for deletion, verified public deletion URL and data-retention outcome                                             |
| Security               | Tenant permissions, secure transport, Chrome session isolation, debug APK cannot sign release                                    |
| Accessibility          | Screen readers, focus order, 44dp targets, reduced motion, high text scaling                                                     |
| Release                | CI, signed AAB, manifest target API 36, Play Console Data Safety + reviewer test                                                 |

Devices: at least Android 10, 13, 15 and 16, with a physical Android phone and Android tablet. Actual device records and screenshots are required for approval.
