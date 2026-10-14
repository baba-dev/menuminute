# MenuMinute — AI and media policy

Target behavior, not implemented integrations. The current AI service returns scaffold results; the media resolver currently uses an uploaded URL or local category SVG.

## Owner assistance

| Capability                      | Proposed provider path                                                          | Publication rule                                      |
| ------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Photo/PDF menu import           | Gemini vision-capable model, selected at integration time                       | Editable draft; highlight uncertain dish names/prices |
| Description assistance          | Gemini; optional appropriately licensed text provider                           | Preserve factual ingredients; owner approves          |
| Menu translation                | Gemini, configured language catalog                                             | Review per-language draft and retain source           |
| Stock image suggestions         | Pexels search after owner action or bounded import job                          | Owner approves matching cuisine/dish                  |
| Optional generated illustration | Eligible Cloudflare Workers AI model; other licensed provider only after review | Explicit opt-in, illustrative label, owner approves   |

Do not hard-code an outdated model name into the product contract. Track provider/model used and job state. Failures preserve manual editing; no AI, stock search or image generation runs on menu page requests or order submission.

NVIDIA API trial access is excluded from production by default. Enable only an integration whose production rights and account entitlement have been verified. R2 is object storage, not inference. Free allowances are quotas, not unlimited infrastructure or an obligation to spend.

## Image selection and delivery

1. Prefer the restaurant's uploaded photograph.
2. Offer already-approved, appropriately licensed imagery from a curated reusable library.
3. Offer licensed Pexels suggestions with photographer/source attribution in the selection flow and wherever provider terms require.
4. Offer an optional generated illustration only with an eligible provider and explicit approval.
5. Use the local category SVG whenever no approved image exists.

This is a selection priority, not a serial network chain during rendering. Publish a persisted approved asset reference; otherwise render SVG immediately. No Google Images scraping, unlicensed hotlinking, or silent publication of an inaccurate stock dish.

Store source type, original photo/provider ID and URL, creator, attribution, rights evidence/reference, approval actor/time, crop/focal point, storage key, dimensions and byte size. A reusable library contains only assets with suitable reuse rights; it must not become a mirror of a stock provider's catalog.

Stock and generated assets are illustrative, not evidence of the restaurant's actual serving. Owners can replace or remove a suggestion. Changing a prompt must not overwrite an approved photo automatically.

## Cost and job control

- Per-restaurant request and storage limits, provider quota accounting, bounded retries, caching and deduplication.
- Background jobs persisted in SQLite, bounded concurrency and timeouts; no Redis requirement for V1.
- Disabled provider or exhausted quota returns a useful manual path and local fallback.
- No automatic paid fallback/overage. Meter storage, inference and egress-related operations before committing to free-tier marketing.
- Strip unnecessary personal information from import prompts. Define retention/deletion for original uploads and job outputs before launch.

## Media security and performance

Validate file signatures and supported formats, byte/dimension limits, decode failures and access scope. Re-encode untrusted raster uploads, strip metadata, generate responsive derivatives and write consistent MIME/extension metadata. Treat downloaded URLs as untrusted: allowlisted sources, timeout/size limits, redirects revalidated and private-network destinations denied.

Keep private originals and public approved derivatives separate. Use tenant-scoped keys and deletion bookkeeping. Reserve image dimensions, lazy-load below the fold and serve compressed responsive sizes. Publish/version media references independently of release directories. Deleting an asset must not break another restaurant's approved reference.

## Integration acceptance

With no API keys, an owner can create and publish a complete menu and guests can browse/order within their entitlement. With quota exhausted, no new billing or inference occurs. Import errors are reviewable; AI never silently changes price, dietary or allergen facts. Repeated import jobs do not duplicate items. Images render through local fallbacks when provider access fails.

## Primary references

Checked 14 October 2026. Recheck account-specific terms and quotas when enabling a provider.

- [Pexels API documentation](https://www.pexels.com/api/documentation/)
- [Pexels attribution guidance](https://help.pexels.com/hc/en-us/articles/900005851903-How-should-I-give-credit-Can-I-use-your-logo)
- [NVIDIA API trial terms](https://assets.ngc.nvidia.com/products/api-catalog/legal/NVIDIA%20API%20Trial%20Terms%20of%20Service.pdf)
