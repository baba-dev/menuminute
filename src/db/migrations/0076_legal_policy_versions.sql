-- Owner-approved Terms v2026-11-02. Preserve historic v2026-10-24 consent and
-- allow the prior and new app releases to coexist safely during cutover.
-- This changes only the accepted version constraint; no acceptance is rewritten.
ALTER TABLE users DROP CONSTRAINT users_terms_version_check;
ALTER TABLE users ADD CONSTRAINT users_terms_version_check
  CHECK (terms_version IS NULL OR terms_version IN ('2026-10-24', '2026-11-02'));
