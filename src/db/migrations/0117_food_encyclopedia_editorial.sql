-- 0117 Food Encyclopedia editorial foundation. Additive / app+worker direct access denied.
-- IMPORTANT: #366 reserves 0115/0116; reconcile migration journal after that PR BEFORE merge.
-- Public data remains empty until a separately approved human editorial review.
CREATE TABLE food_entries (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  kind text NOT NULL CHECK (kind IN ('dishes','ingredients','cuisines','terms','compare')),
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug)<=90),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','in_review','approved','published','archived')),
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  draft_revision_id text,
  review_revision_id text,
  approved_revision_id text,
  published_revision_id text,
  published_at timestamptz,
  search_text text NOT NULL DEFAULT '',
  created_by text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_by text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT food_entries_kind_slug_key UNIQUE(kind,slug),
  CONSTRAINT food_entries_published_pointer_check
    CHECK ((published_revision_id IS NULL) = (published_at IS NULL))
);
CREATE INDEX food_entries_published_at_idx ON food_entries(published_at DESC,id)
  WHERE published_revision_id IS NOT NULL;
CREATE INDEX food_entries_search_idx ON food_entries
  USING gin(to_tsvector('simple',search_text));

CREATE TABLE food_revisions (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  entry_id text NOT NULL REFERENCES food_entries(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK (version > 0),
  content jsonb NOT NULL CHECK (jsonb_typeof(content)='object'),
  digest text NOT NULL CHECK (digest ~ '^[0-9a-f]{64}$'),
  author_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  approved boolean NOT NULL DEFAULT false,
  reviewed_by text REFERENCES users(id) ON DELETE RESTRICT,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT food_revisions_entry_version_key UNIQUE(entry_id,version),
  CONSTRAINT food_revisions_entry_id_key UNIQUE(entry_id,id),
  CONSTRAINT food_revisions_approval_check CHECK
    ((approved=false AND reviewed_by IS NULL AND reviewed_at IS NULL) OR
     (approved=true AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND reviewed_by<>author_id))
);
ALTER TABLE food_entries
  ADD CONSTRAINT food_entries_draft_revision_fk
    FOREIGN KEY(id,draft_revision_id) REFERENCES food_revisions(entry_id,id),
  ADD CONSTRAINT food_entries_review_revision_fk
    FOREIGN KEY(id,review_revision_id) REFERENCES food_revisions(entry_id,id),
  ADD CONSTRAINT food_entries_approved_revision_fk
    FOREIGN KEY(id,approved_revision_id) REFERENCES food_revisions(entry_id,id),
  ADD CONSTRAINT food_entries_published_revision_fk
    FOREIGN KEY(id,published_revision_id) REFERENCES food_revisions(entry_id,id);

CREATE TABLE food_sources (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  url text NOT NULL UNIQUE CHECK (length(url) BETWEEN 10 AND 1000 AND url ~ '^https://'),
  title text NOT NULL DEFAULT '' CHECK (length(title)<=240),
  publisher text NOT NULL DEFAULT '' CHECK (length(publisher)<=140),
  retrieved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE food_entry_sources (
  revision_id text NOT NULL REFERENCES food_revisions(id) ON DELETE RESTRICT,
  source_id text NOT NULL REFERENCES food_sources(id) ON DELETE RESTRICT,
  section_id text NOT NULL DEFAULT '' CHECK (length(section_id)<=90),
  PRIMARY KEY(revision_id,source_id,section_id)
);
CREATE TABLE food_aliases (
  entry_id text NOT NULL REFERENCES food_entries(id) ON DELETE CASCADE,
  alias text NOT NULL CHECK(length(alias) BETWEEN 2 AND 90),
  normalized text NOT NULL CHECK(length(normalized) BETWEEN 2 AND 90),
  PRIMARY KEY(entry_id,normalized)
);
CREATE INDEX food_aliases_normalized_idx ON food_aliases(normalized);
CREATE TABLE food_relations (
  entry_id text NOT NULL REFERENCES food_entries(id) ON DELETE CASCADE,
  related_entry_id text NOT NULL REFERENCES food_entries(id) ON DELETE CASCADE,
  relation text NOT NULL DEFAULT 'related' CHECK (relation IN ('related','ingredient','cuisine','comparison')),
  PRIMARY KEY(entry_id,related_entry_id,relation),
  CONSTRAINT food_relations_not_self CHECK(entry_id<>related_entry_id)
);
CREATE TABLE food_media (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  entry_id text NOT NULL REFERENCES food_entries(id) ON DELETE CASCADE,
  path text NOT NULL CHECK (path ~ '^/assets/food/dishes/[a-zA-Z0-9/_-]+[.](png|webp|avif)$'),
  alt_text text NOT NULL CHECK (length(alt_text) BETWEEN 15 AND 200),
  license text NOT NULL DEFAULT 'pending' CHECK (length(license)<=100),
  attribution text NOT NULL DEFAULT '' CHECK (length(attribution)<=240),
  rights_approved boolean NOT NULL DEFAULT false,
  verified_by text REFERENCES users(id) ON DELETE RESTRICT,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT food_media_rights_check CHECK(
    (rights_approved=false AND verified_by IS NULL AND verified_at IS NULL) OR
    (rights_approved=true AND verified_by IS NOT NULL AND verified_at IS NOT NULL)
  )
);
CREATE TABLE food_editorial_events (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  entry_id text NOT NULL REFERENCES food_entries(id) ON DELETE RESTRICT,
  revision_id text REFERENCES food_revisions(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('create','save','submit','approve','publish','unpublish','restore','import')),
  actor_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX food_editorial_events_entry_idx ON food_editorial_events(entry_id,created_at DESC);
CREATE TABLE food_redirects (
  kind text NOT NULL CHECK (kind IN ('dishes','ingredients','cuisines','terms','compare')),
  old_slug text NOT NULL CHECK (old_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  entry_id text NOT NULL REFERENCES food_entries(id) ON DELETE RESTRICT,
  PRIMARY KEY(kind,old_slug)
);

-- Migration role is the only direct-reader/writer. Definer gateway functions (appended in
-- the next commit) whitelist public projection and demand live operator+step-up for edits.
DO $block$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY[
    'food_entries','food_revisions','food_sources','food_entry_sources',
    'food_aliases','food_relations','food_media','food_editorial_events','food_redirects'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,menuminute_app,menuminute_worker',t);
    EXECUTE format('CREATE POLICY food_owner_only ON %I FOR ALL TO menuminute_owner USING (true) WITH CHECK (true)',t);
  END LOOP;
END $block$;
