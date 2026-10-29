# Dish AI Autofill — production behavior and operator runbook

## Runtime contract
- Private, authenticated, outlet-scoped menu editor only. A dish must already be saved to the selected menu before AI is charged.
- Cloudflare's explicitly supported Llama JSON-schema models use `response_format.type=json_schema`. Other configured Cloudflare models and the configured NVIDIA NIM use `json_object`, which may be unsupported by a particular model: explicit provider errors are not retried without constraints.
- The model's text is not trusted. Strict Zod validation follows deterministic recovery of safe typos (numbers with `kcal` / `g`, casing, known milk/tree-nut aliases, optional sections). Unknown dietary claims, allergen values, verification flags, malformed or excessive output fail closed.
- The model is **not** the authority for cross-contact. Actual cross-contact must be entered by the merchant. Merchant-verified safety and nutrition stay untouched when filling only missing fields. Replace-existing mode deliberately clears prior verification.
- Provider credentials stay server-side. No outbound URL comes from a client. No automatic second model call or provider fallback is made.
- Rate ceilings: 16 attempted provider calls/user/hour, 8 successfully produced draft profiles/user/hour, 80 attempts/outlet/hour, 1000 attempts/global/hour. Redis records all billed attempts; a failed response frees its success slot but cannot exceed the attempt ceiling. One-time request keys prevent replay.
- Generated content never publishes automatically. Commerce fields (price, image, status, variants, modifiers, schedules) are not model-controlled.

## NVIDIA configuration
`AI_NVIDIA_ENABLED=false` is currently the known server setting. This is **why NVIDIA does not appear as an enabled option**. The new UI displays its disabled reason, but code cannot change server secrets or approve commercial licensing.

Only after verifying provider rights and model compatibility, configure in the existing restricted `/etc/menuminute/web.env`:

```dotenv
AI_FEATURES_ENABLED=true
AI_ORCHESTRATOR_ENABLED=true
AI_NVIDIA_ENABLED=true
AI_NVIDIA_COMMERCIAL_APPROVED=true
NVIDIA_API_KEY=<secret retained on server>
AI_NVIDIA_MODEL=<approved NIM model ID>
```

Do **not** activate the commercial approval flag without an actual reviewed entitlement. NVIDIA menu import uses an independent gate (`NVIDIA_IMPORT_MODEL` plus `NVIDIA_API_KEY`), so a working import does not prove the dish-editor provider is enabled.

Restart only after configuration validation, and confirm `menuminute-web` is healthy. Never paste provider tokens into GitHub issues, logs, or client pages.

## Verification
1. Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, ARM64 production build and browser CI before merge.
2. Sign in as a merchant writer, verify the authenticated GET `/api/catalog/dish-autofill?menuId=...` lists Cloudflare as configured and NVIDIA with a disabled reason. Cross-outlet access must be denied.
3. Attempt autofill on an unsaved dish ID: must reject before reaching the provider.
4. Generate a full profile with the configured Cloudflare model. Verify all sections and review/edit/apply to **private draft**, not the published public menu.
5. Trigger harmless formatting differences: expect deterministic normalization; try unknown allergens or fabricated verification: expect a safe rejection with field names, not raw model output.
6. Confirm a failed generation does not consume one of 8 success slots, but does consume one of 16 provider-attempt slots.
7. Test failure/regeneration with an existing proposal: prior suggestion must remain reviewable but cannot apply while regeneration is pending.
8. Confirm Ember tool-calling continues to work; new structured-output options are never sent with tool calls.
9. For NVIDIA, use an approved, configured model and conduct a live provider smoke test before claiming operational readiness. Configuration presence alone is not a live network/entitlement check.

## Monitoring and known limitations
- The route emits safe fields such as provider and invalid field names; never log prompts, API keys or raw generated output.
- A request killed after an atomic quota reservation may hold one success slot until the one-hour TTL. Attempts remain accounted because provider usage may have occurred.
- The client requests a model's **configured availability** only, not an authenticated remote-health guarantee. Provider API outages and entitlement rejection remain possible.
- Newly added unsaved dishes and unsaved companion dishes are not part of the authenticated server menu snapshot. Save them before autofill to retain the authorization boundary.
- Nutrition and allergen suggestions remain unverified, and users must confirm them against the restaurant's actual recipe before publishing.
