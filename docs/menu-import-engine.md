# PR B — NVIDIA engine (review-only)

Depends on PR A candidate v1 and persistent private source storage. The browser sends no image directly to NVIDIA. Sources travel from worker-only private media as downsampled inline JPEG to the fixed NVIDIA chat-completions endpoint. Every response is strict JSON-validated, price decimals use the outlet's ISO currency exponent (ambiguous/malformed = null), source IDs are assigned by our code, and no dietary/allergen/ingredient claims are inferred. Only a candidate in needs_review is written; no published MenuDocument or public media is touched.

The configured NVIDIA NIM VLM must accept chat-completions user multimodal text/image_url and emit the JSON payload in the model prompt. Do not assume every catalog model supports the same response-format option or image quota. Integration tests use a fake fetch, with no billable calls.

Fail closed by default: set MENU_IMPORT_NVIDIA_ENABLED=true and NVIDIA_IMPORT_COMMERCIAL_APPROVED=true on web AND worker, provision NVIDIA_IMPORT_MODEL on both and NVIDIA_API_KEY ONLY in root-protected worker environment. Obtain and verify commercial production entitlement independently. NVIDIA developer/trial API access is for development/evaluation, not an automatic license to serve paying end-users. Authenticated GET /api/menu-imports/engine returns an enabled flag, never a credential. Unavailable engine rejects new requests with 503; the user must explicitly consent to off-host provider transmission.

Authenticated outlet editor + expected revision gate enqueue. One PostgreSQL transaction updates status, writes audit and outbox. A restricted worker RPC records one usage attempt by event ID BEFORE provider transmission; final receipt stores request count, provider-reported input/output tokens when available, and sanitized status. A retry after a crash while an attempt is started settles unknown without issuing a second potentially billable request. Provider errors and malformed output are terminal; recover with a new import. Provider usage is accounting only, NOT an invented subscription charge or customer invoice. Limit 20 attempts per organization per day; each import processes at most 12 images. No automatic publishing.

Migration 0010 is append-only; old SQL and journal prefix remain immutable. Validate worker private media ACL, owner-only migration backup and ARM64 cutover separately. Do not enable on production with an unlicensed/trial key.

References: https://docs.api.nvidia.com/nim/reference/llm-apis and https://docs.api.nvidia.com/nim/docs/product
