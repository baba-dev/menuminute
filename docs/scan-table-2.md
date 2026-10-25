# The Scan Table 2.0 — capture and review redevelopment

## Scope and release constraints

This work replaces the old marketing-like menu import welcome page with a focused, upload-first Scan Table and a responsive Review Desk. The components are isolated under `/dashboard/menu/import` and share the existing dashboard shell. Artwork is referenced directly from the checked/verified Recipe Atelier manifest at `public/brand/menu-studio/recipe-atelier/`; no duplicate or new images are committed.

### A. Ink & Ember experience

- Scoped `scan-table.css` uses existing paper/ink/ember styling, desktop/mobile media, and theme switches.
- Compact header, full-width canvas, step state rail and warm status treatment.
- No competing workspace header, private session IDs as primary labels, or auto-generated confidence estimates.

### B. Capture

- Camera, gallery or drag-and-drop can initiate the flow; session creation occurs when valid images are selected, not on render.
- The existing `POST /api/menu-imports` remains the authority and retains its browser-generated idempotency command.
- Selected images remain local until the editor explicitly uploads them.
- Existing JPEG/PNG/WebP, 5 MiB per image, 12 sources and 30 MiB aggregate server rules apply. Pending objects are not persisted in browser storage.
- Persisted source IDs and immutable source page indices are not changed by the UI. No pretend reordering or source deletion.

### C. Extraction and recovery

- Rail states reflect real `collecting/queued/processing/needs_review/ready/applied/failed/cancelled/expired` server states.
- Provider availability remains fail-closed. Explicit consent and production commercial-license gating are retained.
- Status polling reads persisted server state; no fictional progress, new billable retries or fake completion.
- Return to drafts refreshes outlet-scoped server history. Pending local uploads require explicit abandonment confirmation.

### D. Review and draft handoff

- The private original-source viewer and editable review are side by side on wide viewports.
- Small screens switch between document and fields without losing controlled inputs.
- 100–200% image zoom, source-page picker and linked evidence keep existing evidence IDs unchanged.
- All/Needs review/Verified filters present the existing per-record confirmations; fields remain editable in canonical order and review saves preserve optimistic revision checks.
- Browser reload and navigation guards protect dirty edits.
- `/apply` still writes only a private draft. Human confirmation and Menu Studio publication stay separate.

### E. Validation and operational release gates

- Update Playwright capture/review coverage for the new welcome, file-first workflow, source zoom and issue filters.
- Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and supported PostgreSQL/Redis-backed end-to-end suites in CI.
- Verify mobile widths 320/360/390 and desktop 768/1024/1440, both themes, reduced motion, and 200% zoom.
- Security review: authenticated source GET, cross-outlet isolation, revisional write conflicts, source retention and provider opt-in.
- No migration, dependency, deployment helper, environment or worker changes are needed for this UI feature.
- Mainline merge does **not** establish successful production activation. Preserve required four-lane gates, ARM64 artifact provenance, backup and ERP coexistence checks.

## Existing constraints intentionally not changed

- Static image sources only. PDF, perspective correction and persisted source replacement/reordering need separate validated server processing.
- Failed provider attempts cannot be retried through the UI unless worker idempotency and accounting explicitly support it.
- Import history is bounded to 25 sessions by the service. Old sessions are not silently deleted.
- Import candidates are untrusted until each required record has been verified and the review finalized.
- Published menus and their release history are never changed by this import workflow.
