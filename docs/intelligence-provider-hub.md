# MenuMinute Intelligence — PR A: provider hub

Status: provider-only contract; **not a live assistant, tool executor, or feature activation**.
Epic: [#152](https://github.com/baba-dev/menuminute/issues/152).

## Current integration and intended boundary

The existing review-only `src/modules/menu-import/nvidia.ts` + `engine.ts` remain unchanged. They own menu-import candidate provenance and `NVIDIA_IMPORT_COMMERCIAL_APPROVED`. The new `src/modules/intelligence/` hub is separate from that importer, but reuses its fixed-endpoint, schema-validation and fail-closed principles. No route, DB migration, UI action, tool implementation, new dependency, queue job or provider call is introduced into orders, POS, menu publication or page render paths.

Provider-neutral `createProviderHub(config, request?)` takes validated application env and an injectable fetch for offline tests. `available()` exposes public metadata only. `infer(input)` validates text/tool definitions and resolves exactly one eligible provider. Priority when unspecified: eligible Cloudflare Workers AI, then NVIDIA; a failed request never retries, changes providers, or spends again automatically. An explicitly selected provider never falls back. `tools` is merely function schema transmission: raw model calls are validated, **never executed**. PR B owns authenticated context, tenancy, permission, quotas, durable usage, and tool execution; do not wire `infer` to a public/client-provided API or expose arbitrary model prompts before those controls exist.

## Provider configuration and readiness

Master flags `AI_FEATURES_ENABLED=true` and `AI_ORCHESTRATOR_ENABLED=true` are both required. All defaults are false. Enable at least one independently configured provider:

- NVIDIA: `AI_NVIDIA_ENABLED=true`, `AI_NVIDIA_COMMERCIAL_APPROVED=true`, existing server-only `NVIDIA_API_KEY`, exact reviewed `AI_NVIDIA_MODEL`.
- Cloudflare Workers AI: `AI_CLOUDFLARE_ENABLED=true`, existing server-only `CLOUDFLARE_ACCOUNT_ID` (32-hex account identifier), `CLOUDFLARE_API_TOKEN`, exact reviewed `AI_CLOUDFLARE_MODEL` starting `@cf/`.
- `AI_NVIDIA_TOOLS_VERIFIED` and `AI_CLOUDFLARE_TOOLS_VERIFIED` stay **false** until tool-call compatibility for the configured model has been independently verified against the provider's current catalog and tested. This is not a promise of universal tool support. Providers use fixed first-party Chat Completions endpoints, non-streaming only. Model IDs are runtime configuration, not stale hardcoded model picks. An enabled provider lacking credentials, model or required entitlement fails application preflight.

Retain root-protected web/worker env; never use NEXT_PUBLIC values for secrets. Commercial rights and quotas must be checked before enabling paid requests, independently of the menu-import entitlement. This PR performs no live inference and incurs no API cost. Cloudflare R2 settings are unrelated to Workers AI inference.

## Contract and failure behavior

Request: at most 48 messages, 8 defined tools, 8 tool calls, 4,096 output tokens and 120 KB normalized input; bounded individual strings. Only `text` and model-verified `tools` capabilities are currently defined. No image/vision, arbitrary URL, embeddings, image generation, streaming or JSON-mode promise yet. Each HTTP call has a 30s timeout, cancellation, no redirects, 256 KB maximum response, status classification and sanitized errors. Only JSON completion content/allowlisted tool names, unique call IDs and object argument JSON are accepted; provider output is untrusted. Missing provider usage stays null, never inferred as zero. The hub never logs prompt, credentials, upstream response bodies or raw remote errors. PR B must durably meter actual attempts with reservation/settlement before enabling network calls to users.

### Downstream consumer requirements

1. Resolve current authenticated user and organization/outlet on server; enforce domain role and entitlement in every tool service and recheck after approval.
2. Reserve per-tenant/user budgets and persist attempt identity and usage before provider call; dedupe uncertain outcomes (no blind retry).
3. Supply only registered tool definitions; validate their arguments again against service-specific Zod schemas before execution. Never provide arbitrary SQL, shell, filesystem, generic fetch, navigation URL or finance mutation tools to the model.
4. Return bounded, redacted tool results and record audit. AI-generated menu content is private draft, merchant reviewed; never fabricate allergens/ingredients/prices or autonomously publish.
5. Keep inference outside critical ordering and POS transaction paths. Degraded AI must leave regular operation functional.
6. Streaming can be added later as a separate model-capability-tested contract.

## Live Cloudflare tool-call compatibility

A production operator tested the configured Cloudflare model with synthetic prompts and a
read-only tool schema (26 October 2026). The chat endpoint returned HTTP 200 in both cases:
`tool_choice: "auto"` returned a final text answer without calling any tool, while
`tool_choice: "required"` returned a structured `menu_summary` function call.
This shows **protocol compatibility**, not independent approval of commercial usage,
privacy, production spend, authorization, or full Ember activation.

Ember's read-only orchestrator **requires** grounded evidence on the first inference
round, so the provider hub now sets `tool_choice: "required"` when tools capability
is requested. Its second round remains text-only. The Cloudflare wire adapter
exposes registered names such as `menu.summary` as `menu_summary` for provider
compatibility and reverses that mapping before the existing allowlisted, scoped
domain dispatcher. Cross-namespace collisions and unexpected aliases fail closed,
before any side effect. NVIDIA's existing wire names are not changed.
Messages replaying normalized assistant tool calls in the second round receive
the same wire mapping.

Offline provider tests cover both rounds and rejection cases. They are not a
substitute for an authenticated real-outlet canary, a live end-to-end model
exchange using the exact four MenuMinute tools, provider spend controls,
privacy/retention approval or a separate decision to enable
`AI_CLOUDFLARE_TOOLS_VERIFIED` and `AI_ASSISTANT_READ_ONLY_ENABLED`.
Keep `AI_ASSISTANT_ACTIONS_ENABLED=false` initially and preserve the
existing release/deployment gates.

## Offline verification

`pnpm exec vitest run tests/intelligence-provider-hub.test.ts`, `pnpm typecheck`, `pnpm lint`, `pnpm build`. Tests inject `fetch`; no credentials or paid API calls are used. Final ARM64 CI and independent review are still required before merge. There is no migration or live activation in PR A. Rollback is reverting these new modules/config flags; existing importer is unaffected.

Provider references (verify again at enablement):

- NVIDIA: https://docs.api.nvidia.com/nim/reference/llm-apis
- Cloudflare: https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/
