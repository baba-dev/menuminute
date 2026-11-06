-- Atomic Community Edition one-owner gate. Forward-only and additive.
-- Hosted SaaS users, existing users, and fixture accounts retain NULL.
-- The Better Auth user.create.before hook sets this server-owned value to 1
-- only for Community Edition signup. PostgreSQL, not a pre-insert SELECT,
-- arbitrates concurrent first signups through this uniqueness invariant.
ALTER TABLE users ADD COLUMN community_edition_slot integer;
ALTER TABLE users ADD CONSTRAINT users_community_edition_slot_valid
  CHECK (community_edition_slot IS NULL OR community_edition_slot = 1);
CREATE UNIQUE INDEX users_community_edition_single_owner_idx
  ON users (community_edition_slot) WHERE community_edition_slot IS NOT NULL;
