-- 0118 Food Encyclopedia editorial foundation. Additive / app+worker direct access denied.
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
    EXECUTE format('CREATE POLICY food_owner_only ON %I FOR ALL TO %I USING (true) WITH CHECK (true)',t,current_user);
  END LOOP;
END $block$;

-- Approved media identity is entry+path, never a generic merchant upload.
CREATE UNIQUE INDEX food_media_entry_path_key ON food_media(entry_id,path);

-- The whitelisted public projection never includes draft notes, editor history,
-- candidate imports, privileged event metadata or unreviewed revisions.
CREATE FUNCTION app_private.food_public_payload(p_entry food_entries,p_revision food_revisions)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $payload$
 SELECT jsonb_strip_nulls(jsonb_build_object(
   'id',p_entry.id,'kind',p_entry.kind,'slug',p_entry.slug,
   'title',p_revision.content->>'title',
   'eyebrow',p_revision.content->>'eyebrow',
   'description',p_revision.content->>'description',
   'tint',p_revision.content->>'tint',
   'imagePath',p_revision.content->>'imagePath',
   'imageAlt',p_revision.content->>'imageAlt',
   'aliases',coalesce(p_revision.content->'aliases','[]'::jsonb),
   'facts',coalesce(p_revision.content->'facts','[]'::jsonb),
   'sections',coalesce(p_revision.content->'sections','[]'::jsonb),
   'relatedSlugs',coalesce(p_revision.content->'relatedSlugs','[]'::jsonb),
   'caution',p_revision.content->>'caution',
   'sourceUrls',coalesce(p_revision.content->'sourceUrls','[]'::jsonb),
   'status','published',
   'reviewedBy',coalesce((SELECT u.name FROM users u WHERE u.id=p_revision.reviewed_by),'MenuMinute Editorial Team'),
   'reviewedAt',to_char(p_revision.reviewed_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
   'publishedAt',to_char(p_entry.published_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
 ));
$payload$;
REVOKE ALL ON FUNCTION app_private.food_public_payload(food_entries,food_revisions)
  FROM PUBLIC,menuminute_app,menuminute_worker;

CREATE FUNCTION app_private.food_public_entry(p_kind text,p_slug text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $entry$
  SELECT app_private.food_public_payload(e,r)
    FROM food_entries e JOIN food_revisions r
      ON r.entry_id=e.id AND r.id=e.published_revision_id
   WHERE e.kind=p_kind AND e.slug=p_slug
     AND e.published_at IS NOT NULL AND r.approved
     AND r.reviewed_at IS NOT NULL AND r.reviewed_by IS NOT NULL
   LIMIT 1;
$entry$;
REVOKE ALL ON FUNCTION app_private.food_public_entry(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.food_public_entry(text,text) TO menuminute_app;

-- Bounded search across reviewed publication only; drafts and archived revisions never leak.
CREATE FUNCTION app_private.food_public_list(p_kind text,p_query text,p_limit integer,p_offset integer)
RETURNS TABLE(entry jsonb) LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $list$
  SELECT app_private.food_public_payload(e,r) AS entry
    FROM food_entries e JOIN food_revisions r
      ON r.entry_id=e.id AND r.id=e.published_revision_id
   WHERE e.published_at IS NOT NULL AND r.approved
     AND r.reviewed_by IS NOT NULL AND r.reviewed_at IS NOT NULL
     AND (p_kind IS NULL OR p_kind='' OR e.kind=p_kind)
     AND (p_query IS NULL OR btrim(p_query)='' OR
       to_tsvector('simple',e.search_text) @@ plainto_tsquery('simple',left(p_query,100))
       OR strpos(lower(e.search_text),lower(left(p_query,100)))>0
     )
   ORDER BY e.published_at DESC,e.id
   LIMIT GREATEST(0,LEAST(coalesce(p_limit,30),100))
   OFFSET GREATEST(0,LEAST(coalesce(p_offset,0),50000));
$list$;
REVOKE ALL ON FUNCTION app_private.food_public_list(text,text,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.food_public_list(text,text,integer,integer) TO menuminute_app;


-- Approved, public-only sitemaps must remain complete as the encyclopedia scales.
CREATE FUNCTION app_private.food_public_sitemap(p_limit integer)
RETURNS TABLE(kind text,slug text,reviewed_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $sitemap$
 SELECT e.kind,e.slug,r.reviewed_at FROM food_entries e
 JOIN food_revisions r ON r.entry_id=e.id AND r.id=e.published_revision_id
 WHERE e.published_revision_id IS NOT NULL AND e.published_at IS NOT NULL
 AND r.approved AND r.reviewed_by IS NOT NULL AND r.reviewed_at IS NOT NULL
 ORDER BY e.published_at DESC,e.id
 LIMIT GREATEST(0,LEAST(coalesce(p_limit,45000),45000));
$sitemap$;
REVOKE ALL ON FUNCTION app_private.food_public_sitemap(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.food_public_sitemap(integer) TO menuminute_app;

CREATE FUNCTION app_private.food_public_redirect(p_kind text,p_slug text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $redirect$
  SELECT e.slug FROM food_redirects d JOIN food_entries e ON e.id=d.entry_id
    WHERE d.kind=p_kind AND d.old_slug=p_slug AND e.published_revision_id IS NOT NULL
    LIMIT 1;
$redirect$;
REVOKE ALL ON FUNCTION app_private.food_public_redirect(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.food_public_redirect(text,text) TO menuminute_app;

CREATE FUNCTION app_private.food_editorial_list(p_query text,p_status text,p_limit integer)
RETURNS TABLE(item jsonb) LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $list$
BEGIN
  IF NOT app_private.is_super_admin(NULLIF(current_setting('app.actor_id',true),''))
  THEN RAISE EXCEPTION 'Unauthorized editorial access' USING ERRCODE='42501'; END IF;
  RETURN QUERY
    SELECT jsonb_build_object(
      'id',e.id,'kind',e.kind,'slug',e.slug,
      'title',coalesce(r.content->>'title',e.slug),'status',e.status,
      'version',e.version,'createdAt',e.created_at,'updatedAt',e.updated_at,
      'hasPublishedVersion',e.published_revision_id IS NOT NULL,'publishedAt',e.published_at
    )
    FROM food_entries e
      LEFT JOIN food_revisions r ON r.id=coalesce(e.draft_revision_id,e.published_revision_id)
    WHERE (p_status IS NULL OR p_status='' OR e.status=p_status)
      AND (p_query IS NULL OR btrim(p_query)='' OR e.slug ILIKE '%'||left(p_query,100)||'%'
           OR r.content->>'title' ILIKE '%'||left(p_query,100)||'%')
    ORDER BY e.updated_at DESC,e.id
    LIMIT GREATEST(1,LEAST(coalesce(p_limit,80),100));
END;
$list$;
REVOKE ALL ON FUNCTION app_private.food_editorial_list(text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.food_editorial_list(text,text,integer) TO menuminute_app;

CREATE FUNCTION app_private.food_editorial_detail(p_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $detail$
DECLARE e food_entries%ROWTYPE;
BEGIN
 IF NOT app_private.is_super_admin(NULLIF(current_setting('app.actor_id',true),''))
 THEN RAISE EXCEPTION 'Unauthorized editorial access' USING ERRCODE='42501'; END IF;
 SELECT * INTO e FROM food_entries WHERE id=p_id;
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN jsonb_build_object(
   'id',e.id,'kind',e.kind,'slug',e.slug,
   'title',coalesce((SELECT content->>'title' FROM food_revisions WHERE id=e.draft_revision_id),e.slug),
   'status',e.status,'version',e.version,
   'createdAt',e.created_at,'updatedAt',e.updated_at,
   'hasPublishedVersion',e.published_revision_id IS NOT NULL,'publishedAt',e.published_at,
   'draftRevisionId',e.draft_revision_id,'reviewRevisionId',e.review_revision_id,
   'approvedRevisionId',e.approved_revision_id,'publishedRevisionId',e.published_revision_id,
   'draft',(SELECT r.content FROM food_revisions r WHERE r.id=e.draft_revision_id),
   'versions',coalesce((SELECT jsonb_agg(jsonb_build_object(
       'id',r.id,'version',r.version,'authorId',r.author_id,'reviewedBy',r.reviewed_by,
       'reviewedAt',r.reviewed_at,'createdAt',r.created_at,'approved',r.approved
       ) ORDER BY r.version DESC)
     FROM food_revisions r WHERE r.entry_id=e.id),'[]'::jsonb),
   'events',coalesce((SELECT jsonb_agg(jsonb_build_object(
       'action',v.action,'actorId',v.actor_id,'createdAt',v.created_at,
       'revisionId',v.revision_id
       ) ORDER BY v.created_at DESC)
     FROM (SELECT * FROM food_editorial_events WHERE entry_id=e.id
           ORDER BY created_at DESC LIMIT 30) v),'[]'::jsonb)
 );
END;
$detail$;
REVOKE ALL ON FUNCTION app_private.food_editorial_detail(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.food_editorial_detail(text) TO menuminute_app;

-- One entrypoint for editorial mutations. Each request is recorded once;
-- the same idempotency key returns the same receipt without consuming a second TOTP.
CREATE FUNCTION app_private.food_editorial_command(
 p_action text,p_target text,p_data jsonb,p_key text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $command$
DECLARE
 actor text := nullif(current_setting('app.actor_id',true),'');
 session_id text := nullif(current_setting('app.session_id',true),'');
 existing admin_command_receipts%ROWTYPE;
 e food_entries%ROWTYPE;
 r food_revisions%ROWTYPE;
 rev_id text;
 payload jsonb;
 result jsonb := '{}'::jsonb;
 content_digest text;
 source_count integer;
 s text;
 target_revision text;
 affected integer;
 reason text;
BEGIN
 IF actor IS NULL OR session_id IS NULL OR NOT app_private.is_super_admin(actor)
   OR p_action NOT IN ('create','save','submit','approve','publish','unpublish','restore','media.approve','import')
   OR p_key IS NULL OR p_key !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   OR p_target IS NULL OR length(p_target) NOT BETWEEN 1 AND 100
   OR p_data IS NULL OR jsonb_typeof(p_data)<>'object'
 THEN RAISE EXCEPTION 'Invalid or unauthorized editorial command' USING ERRCODE='42501'; END IF;

 PERFORM pg_advisory_xact_lock(hashtextextended(actor||':'||p_key,0));
 SELECT * INTO existing FROM admin_command_receipts
   WHERE actor_id=actor AND request_key=p_key;
 IF FOUND THEN
   IF existing.action<>'food.'||p_action OR existing.target_id<>p_target OR existing.payload<>p_data
   THEN RAISE EXCEPTION 'Editorial idempotency conflict' USING ERRCODE='23505'; END IF;
   RETURN existing.result;
 END IF;

 IF NOT app_private.require_step_up()
 THEN RAISE EXCEPTION 'Verify a privileged session at /account/security' USING ERRCODE='42501'; END IF;

 IF p_action IN ('create','save','import') THEN
   payload := p_data->'content';
   IF jsonb_typeof(payload)<>'object' OR payload->>'kind' NOT IN ('dishes','ingredients','cuisines','terms','compare')
     OR coalesce(payload->>'slug','') !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
     OR length(payload->>'slug')>90
     OR length(btrim(coalesce(payload->>'title',''))) NOT BETWEEN 3 AND 100
     OR length(btrim(coalesce(payload->>'description',''))) NOT BETWEEN 35 AND 320
     OR jsonb_typeof(payload->'sections')<>'array'
     OR jsonb_array_length(payload->'sections') NOT BETWEEN 2 AND 12
     OR jsonb_typeof(payload->'sourceUrls')<>'array'
     OR jsonb_array_length(payload->'sourceUrls')>20
     OR jsonb_typeof(payload->'facts')<>'array'
     OR jsonb_array_length(payload->'facts') NOT BETWEEN 2 AND 8
     OR length(payload::text)>28000
   THEN RAISE EXCEPTION 'Invalid editorial content fields' USING ERRCODE='22023'; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(payload->'sourceUrls') AS source(url)
             WHERE url !~ '^https://' OR length(url)>1000)
   THEN RAISE EXCEPTION 'Only HTTPS editorial sources are permitted' USING ERRCODE='22023'; END IF;
   IF p_action IN ('create','import') THEN
     IF p_target<>'new' THEN RAISE EXCEPTION 'Creation must target new' USING ERRCODE='22023'; END IF;
     INSERT INTO food_entries(kind,slug,created_by,updated_by)
     VALUES(payload->>'kind',payload->>'slug',actor,actor) RETURNING * INTO e;
   ELSE
     SELECT * INTO e FROM food_entries WHERE id=p_target FOR UPDATE;
     IF NOT FOUND THEN RAISE EXCEPTION 'Unknown food entry' USING ERRCODE='22023'; END IF;
     IF (p_data->>'expectedVersion')::int IS DISTINCT FROM e.version
       OR e.kind<>payload->>'kind' OR e.slug<>payload->>'slug'
     THEN RAISE EXCEPTION 'Concurrent editorial revision or canonical identity change' USING ERRCODE='40001'; END IF;
   END IF;
   content_digest := encode(sha256(convert_to(payload::text,'UTF8')),'hex');
   INSERT INTO food_revisions(entry_id,version,content,digest,author_id)
   VALUES(e.id,e.version+1,payload,content_digest,actor) RETURNING id INTO rev_id;
   UPDATE food_entries SET version=version+1, status='draft',draft_revision_id=rev_id,
     review_revision_id=NULL,approved_revision_id=NULL,updated_by=actor,updated_at=clock_timestamp()
     WHERE id=e.id;
   INSERT INTO food_sources(url)
    SELECT DISTINCT source.url FROM jsonb_array_elements_text(payload->'sourceUrls') source(url)
    ON CONFLICT(url) DO NOTHING;
   INSERT INTO food_entry_sources(revision_id,source_id)
    SELECT rev_id, s.id FROM food_sources s
      JOIN jsonb_array_elements_text(payload->'sourceUrls') source(url) ON source.url=s.url
    ON CONFLICT DO NOTHING;
   IF payload->>'imagePath' IS NOT NULL THEN
     INSERT INTO food_media(entry_id,path,alt_text)
     VALUES(e.id,payload->>'imagePath',payload->>'imageAlt')
     ON CONFLICT(entry_id,path) DO NOTHING;
   END IF;
   result:=jsonb_build_object('id',e.id,'revisionId',rev_id,
     'version',e.version+1,'status','draft','digest',content_digest);
 ELSIF p_action='media.approve' THEN
   SELECT * INTO e FROM food_entries WHERE id=p_target FOR UPDATE;
   IF NOT FOUND OR p_data->>'path' IS NULL
     OR length(coalesce(p_data->>'attribution',''))>240
     OR p_data->>'license' NOT IN ('owned','commissioned','cc0','cc-by','licensed')
   THEN RAISE EXCEPTION 'Invalid media verification' USING ERRCODE='22023'; END IF;
   UPDATE food_media SET rights_approved=true,license=p_data->>'license',
     attribution=coalesce(p_data->>'attribution',''),
     verified_by=actor,verified_at=clock_timestamp()
   WHERE entry_id=e.id AND path=p_data->>'path' AND rights_approved=false;
   GET DIAGNOSTICS affected=ROW_COUNT;
   IF affected<>1 THEN RAISE EXCEPTION 'Media not found or already verified' USING ERRCODE='22023'; END IF;
   result:=jsonb_build_object('id',e.id,'mediaApproved',true);
 ELSE
   SELECT * INTO e FROM food_entries WHERE id=p_target FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Unknown food entry' USING ERRCODE='22023'; END IF;
   IF (p_data->>'expectedVersion')::int IS DISTINCT FROM e.version THEN
     RAISE EXCEPTION 'Concurrent editorial revision' USING ERRCODE='40001'; END IF;
   IF p_action='submit' THEN
     IF e.status<>'draft' OR e.draft_revision_id IS NULL
     THEN RAISE EXCEPTION 'Only current drafts may be submitted' USING ERRCODE='22023'; END IF;
     SELECT * INTO r FROM food_revisions WHERE id=e.draft_revision_id;
     SELECT count(DISTINCT source_id) INTO source_count
       FROM food_entry_sources WHERE revision_id=r.id;
     IF source_count<2 OR length(r.content::text)<950
     THEN RAISE EXCEPTION 'Article needs substantive researched content and two references' USING ERRCODE='22023'; END IF;
     UPDATE food_entries SET status='in_review',review_revision_id=r.id,
        updated_by=actor,updated_at=clock_timestamp() WHERE id=e.id;
     rev_id:=r.id;
     result:=jsonb_build_object('id',e.id,'status','in_review');
   ELSIF p_action='approve' THEN
     IF e.status<>'in_review' OR e.review_revision_id IS NULL
     THEN RAISE EXCEPTION 'A submitted revision is required' USING ERRCODE='22023'; END IF;
     SELECT * INTO r FROM food_revisions WHERE id=e.review_revision_id FOR UPDATE;
     IF r.author_id=actor THEN
       RAISE EXCEPTION 'A separate reviewer must approve authored content' USING ERRCODE='42501'; END IF;
     SELECT count(DISTINCT source_id) INTO source_count
       FROM food_entry_sources WHERE revision_id=r.id;
     IF source_count<2 THEN RAISE EXCEPTION 'Two sources required' USING ERRCODE='22023'; END IF;
     IF r.content->>'imagePath' IS NOT NULL AND NOT EXISTS(
       SELECT 1 FROM food_media m WHERE m.entry_id=e.id AND m.path=r.content->>'imagePath'
         AND m.rights_approved AND m.verified_by IS NOT NULL
     ) THEN RAISE EXCEPTION 'Artwork rights verification required' USING ERRCODE='22023'; END IF;
     UPDATE food_revisions SET approved=true,reviewed_by=actor,reviewed_at=clock_timestamp()
       WHERE id=r.id AND NOT approved;
     IF NOT FOUND THEN RAISE EXCEPTION 'Revision already approved' USING ERRCODE='22023'; END IF;
     UPDATE food_entries SET status='approved',approved_revision_id=r.id,
       updated_by=actor,updated_at=clock_timestamp() WHERE id=e.id;
     rev_id:=r.id;
     result:=jsonb_build_object('id',e.id,'status','approved');
   ELSIF p_action='publish' THEN
     IF e.status<>'approved' OR e.approved_revision_id IS NULL
     THEN RAISE EXCEPTION 'Only an independently approved revision can publish' USING ERRCODE='22023'; END IF;
     SELECT * INTO r FROM food_revisions WHERE id=e.approved_revision_id AND entry_id=e.id;
     IF NOT FOUND OR NOT r.approved OR r.reviewed_by IS NULL
       OR r.reviewed_at IS NULL OR r.reviewed_by=r.author_id
     THEN RAISE EXCEPTION 'Invalid reviewed content' USING ERRCODE='42501'; END IF;
     UPDATE food_entries SET published_revision_id=r.id,published_at=clock_timestamp(),
       status='published',search_text=coalesce(r.content->>'title','')||' '||
         coalesce(r.content->>'description','')||' '||coalesce(r.content->>'slug','')||' '||
         coalesce((SELECT string_agg(value,' ') FROM jsonb_array_elements_text(r.content->'aliases')),''),
       updated_by=actor,updated_at=clock_timestamp() WHERE id=e.id;
     DELETE FROM food_aliases WHERE entry_id=e.id;
     INSERT INTO food_aliases(entry_id,alias,normalized)
     SELECT DISTINCT ON (lower(btrim(alias))) e.id,alias,lower(btrim(alias))
       FROM jsonb_array_elements_text(r.content->'aliases') x(alias)
       WHERE length(btrim(alias)) BETWEEN 2 AND 90
       ORDER BY lower(btrim(alias)),alias;
     DELETE FROM food_relations WHERE entry_id=e.id;
     INSERT INTO food_relations(entry_id,related_entry_id,relation)
       SELECT e.id,target.id,'related'
       FROM food_entries target
       JOIN jsonb_array_elements_text(r.content->'relatedSlugs') related(slug)
         ON target.slug=related.slug AND target.id<>e.id
       WHERE target.published_revision_id IS NOT NULL
       ON CONFLICT DO NOTHING;
     rev_id:=r.id;
     result:=jsonb_build_object('id',e.id,'status','published','revisionId',rev_id);
   ELSIF p_action='unpublish' THEN
     IF e.published_revision_id IS NULL THEN
       RAISE EXCEPTION 'Entry is not published' USING ERRCODE='22023'; END IF;
     rev_id:=e.published_revision_id;
     UPDATE food_entries SET published_revision_id=NULL,published_at=NULL,
       status='archived',search_text='',updated_by=actor,updated_at=clock_timestamp()
       WHERE id=e.id;
     DELETE FROM food_aliases WHERE entry_id=e.id;
     result:=jsonb_build_object('id',e.id,'status','archived');
   ELSIF p_action='restore' THEN
     target_revision:=p_data->>'revisionId';
     SELECT * INTO r FROM food_revisions WHERE id=target_revision AND entry_id=e.id;
     IF NOT FOUND OR NOT r.approved OR r.reviewed_by IS NULL OR r.reviewed_at IS NULL
     THEN RAISE EXCEPTION 'Only a previously approved revision can be restored' USING ERRCODE='22023'; END IF;
     UPDATE food_entries SET published_revision_id=r.id,published_at=clock_timestamp(),
       status='published',search_text=coalesce(r.content->>'title','')||' '||
         coalesce(r.content->>'description','')||' '||coalesce(r.content->>'slug',''),
       updated_by=actor,updated_at=clock_timestamp() WHERE id=e.id;
     rev_id:=r.id;
     result:=jsonb_build_object('id',e.id,'status','published','revisionId',rev_id);
   END IF;
 END IF;

 INSERT INTO food_editorial_events(entry_id,revision_id,action,actor_id,details)
 VALUES(e.id,rev_id,p_action,actor,p_data - 'content');
 INSERT INTO admin_audit_logs(id,actor_id,actor_email,action,target_type,target_id,details)
 VALUES(gen_random_uuid()::text,actor,
        (SELECT u.email FROM users u WHERE u.id=actor),
        'food.'||p_action,'food_entry',e.id,
        jsonb_build_object('revisionId',rev_id,'requestKey',p_key));
 INSERT INTO admin_command_receipts(actor_id,request_key,action,target_id,payload,result)
 VALUES(actor,p_key,'food.'||p_action,p_target,p_data,result);
 RETURN result;
END;
$command$;
REVOKE ALL ON FUNCTION app_private.food_editorial_command(text,text,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.food_editorial_command(text,text,jsonb,text) TO menuminute_app;

-- Idempotent catalogue candidate queue. NOT an article, revision or public page.
CREATE TABLE food_candidates (
  catalogue_id text PRIMARY KEY CHECK (length(catalogue_id) BETWEEN 5 AND 80),
  name text NOT NULL CHECK (length(name) BETWEEN 3 AND 100),
  category_hint text NOT NULL DEFAULT '' CHECK(length(category_hint)<=90),
  suggestion text NOT NULL DEFAULT '' CHECK(length(suggestion)<=320),
  aliases jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(aliases)='array'),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','promoted','dismissed')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE food_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_candidates FORCE ROW LEVEL SECURITY;
REVOKE ALL ON food_candidates FROM PUBLIC,menuminute_app,menuminute_worker;
DO $owner$ BEGIN
 EXECUTE format('CREATE POLICY food_owner_only ON food_candidates FOR ALL TO %I USING(true) WITH CHECK(true)',current_user);
END $owner$;

CREATE FUNCTION app_private.food_editorial_candidates(p_limit integer)
RETURNS TABLE(candidate jsonb) LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $candidates$
BEGIN
 IF NOT app_private.is_super_admin(NULLIF(current_setting('app.actor_id',true),''))
 THEN RAISE EXCEPTION 'Unauthorized catalogue queue' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT jsonb_build_object(
   'id',c.catalogue_id,'name',c.name,'hint',c.category_hint,
   'suggestion',c.suggestion,'aliases',c.aliases,'status',c.status
   ) FROM food_candidates c ORDER BY c.name,c.catalogue_id
   LIMIT GREATEST(1,LEAST(coalesce(p_limit,250),300));
END;
$candidates$;
REVOKE ALL ON FUNCTION app_private.food_editorial_candidates(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.food_editorial_candidates(integer) TO menuminute_app;

CREATE FUNCTION app_private.food_import_candidates(p_candidates jsonb,p_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $import$
DECLARE actor text:=nullif(current_setting('app.actor_id',true),'');
 existing admin_command_receipts%ROWTYPE;
 item jsonb;
 added integer:=0;
 result jsonb;
BEGIN
 IF actor IS NULL OR NOT app_private.is_super_admin(actor)
   OR p_key IS NULL OR p_key !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   OR jsonb_typeof(p_candidates)<>'array' OR jsonb_array_length(p_candidates)>250
 THEN RAISE EXCEPTION 'Invalid candidate import authorization' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(actor||':'||p_key,0));
 SELECT * INTO existing FROM admin_command_receipts WHERE actor_id=actor AND request_key=p_key;
 IF FOUND THEN
   IF existing.action<>'food.candidates.import' OR existing.payload<>jsonb_build_object('candidates',p_candidates)
   THEN RAISE EXCEPTION 'Candidate import key conflict' USING ERRCODE='23505'; END IF;
   RETURN existing.result;
 END IF;
 IF NOT app_private.require_step_up() THEN
   RAISE EXCEPTION 'Verify a recent privileged step-up' USING ERRCODE='42501'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_candidates)
 LOOP
  IF jsonb_typeof(item)<>'object' OR
    length(coalesce(item->>'id','')) NOT BETWEEN 5 AND 80 OR
    length(coalesce(item->>'name','')) NOT BETWEEN 3 AND 100 OR
    length(coalesce(item->>'hint',''))>90 OR
    length(coalesce(item->>'suggestion',''))>320 OR
    jsonb_typeof(item->'aliases')<>'array' OR
    jsonb_array_length(item->'aliases')>20
  THEN RAISE EXCEPTION 'Invalid catalogue candidate' USING ERRCODE='22023'; END IF;
  INSERT INTO food_candidates(catalogue_id,name,category_hint,suggestion,aliases)
   VALUES(item->>'id',item->>'name',coalesce(item->>'hint',''),
     coalesce(item->>'suggestion',''),item->'aliases')
   ON CONFLICT(catalogue_id) DO NOTHING;
  IF FOUND THEN added:=added+1; END IF;
 END LOOP;
 result:=jsonb_build_object('imported',added,'total',jsonb_array_length(p_candidates));
 INSERT INTO admin_audit_logs(id,actor_id,actor_email,action,target_type,target_id,details)
 VALUES(gen_random_uuid()::text,actor,(SELECT email FROM users WHERE id=actor),
    'food.candidates.import','food_catalogue','candidate-batch',result);
 INSERT INTO admin_command_receipts(actor_id,request_key,action,target_id,payload,result)
 VALUES(actor,p_key,'food.candidates.import','candidate-batch',
    jsonb_build_object('candidates',p_candidates),result);
 RETURN result;
END;
$import$;
REVOKE ALL ON FUNCTION app_private.food_import_candidates(jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.food_import_candidates(jsonb,text) TO menuminute_app;
