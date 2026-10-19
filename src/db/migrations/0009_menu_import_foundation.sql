-- PR A: private photo-to-menu import foundation. No AI/provider calls or publication.
CREATE TABLE menu_imports (
 id text PRIMARY KEY,
 organization_id text NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
 outlet_id text NOT NULL,
 created_by text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 request_key text NOT NULL,
 target_menu_id text,
 currency text NOT NULL,
 status text NOT NULL DEFAULT 'collecting',
 revision integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT import_scope UNIQUE(id,organization_id,outlet_id),
 CONSTRAINT import_request_unique UNIQUE(organization_id,outlet_id,created_by,request_key),
 CONSTRAINT import_outlet_scope FOREIGN KEY(organization_id,outlet_id) REFERENCES restaurants(organization_id,id),
 CONSTRAINT import_target_menu FOREIGN KEY(organization_id,target_menu_id) REFERENCES menus(organization_id,id),
 CONSTRAINT import_status_valid CHECK(status IN ('collecting','queued','processing','needs_review','ready','applied','cancelled','failed','expired')),
 CONSTRAINT import_revision_valid CHECK(revision>0),
 CONSTRAINT import_id_valid CHECK(id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
 CONSTRAINT import_key_valid CHECK(request_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
);
CREATE INDEX import_outlet_recent ON menu_imports(outlet_id,created_at DESC);

CREATE TABLE menu_import_sources (
 id text PRIMARY KEY,
 import_id text NOT NULL,
 organization_id text NOT NULL,
 outlet_id text NOT NULL,
 page_index integer NOT NULL,
 status text NOT NULL DEFAULT 'reserved',
 request_sha256 text NOT NULL,
 request_bytes integer NOT NULL,
 stored_sha256 text,
 stored_bytes integer,
 width integer,
 height integer,
 storage_key text NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT import_source_parent FOREIGN KEY(import_id,organization_id,outlet_id) REFERENCES menu_imports(id,organization_id,outlet_id) ON DELETE RESTRICT,
 CONSTRAINT import_source_page UNIQUE(import_id,page_index),
 CONSTRAINT import_source_state CHECK(status IN ('reserved','ready','failed')),
 CONSTRAINT import_source_id CHECK(id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
 CONSTRAINT import_source_request CHECK(request_bytes BETWEEN 1 AND 5242880 AND request_sha256 ~ '^[0-9a-f]{64}$'),
 CONSTRAINT import_source_output CHECK((status='ready' AND stored_sha256 IS NOT NULL AND stored_sha256 ~ '^[0-9a-f]{64}$' AND stored_bytes IS NOT NULL AND width IS NOT NULL AND height IS NOT NULL AND stored_bytes BETWEEN 1 AND 5242880 AND width BETWEEN 1 AND 10000 AND height BETWEEN 1 AND 10000 AND width::bigint*height<=10000000) OR (status<>'ready' AND stored_sha256 IS NULL AND stored_bytes IS NULL AND width IS NULL AND height IS NULL)),
 CONSTRAINT import_source_page_limit CHECK(page_index BETWEEN 0 AND 11)
);
CREATE INDEX import_source_parent_index ON menu_import_sources(import_id,page_index);

-- Schema-v1 AI candidates are isolated from the authoritative versioned MenuDocument.
-- No application or worker write privilege is granted in PR A.
CREATE TABLE menu_import_candidates (
 import_id text NOT NULL,
 organization_id text NOT NULL,
 outlet_id text NOT NULL,
 revision integer NOT NULL,
 schema_version integer NOT NULL DEFAULT 1,
 document jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(import_id,revision),
 CONSTRAINT candidate_parent FOREIGN KEY(import_id,organization_id,outlet_id) REFERENCES menu_imports(id,organization_id,outlet_id) ON DELETE RESTRICT,
 CONSTRAINT candidate_revision CHECK(revision>0 AND schema_version=1 AND jsonb_typeof(document)='object' AND octet_length(document::text)<=600000)
);

ALTER TABLE menu_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_import_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_import_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY import_editor_read ON menu_imports FOR SELECT TO menuminute_app
 USING(app_private.can_outlet(outlet_id,'menu.write'));
CREATE POLICY import_source_editor_read ON menu_import_sources FOR SELECT TO menuminute_app
 USING(app_private.can_outlet(outlet_id,'menu.write'));
CREATE POLICY import_candidate_editor_read ON menu_import_candidates FOR SELECT TO menuminute_app
 USING(app_private.can_outlet(outlet_id,'menu.write'));
GRANT SELECT ON menu_imports,menu_import_sources,menu_import_candidates TO menuminute_app;

CREATE FUNCTION app_private.import_create(p_outlet text,p_id text,p_key text,p_target text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE r restaurants%ROWTYPE; previous menu_imports%ROWTYPE; actor text:=current_setting('app.actor_id',true);
BEGIN
 IF NOT app_private.can_outlet(p_outlet,'menu.write') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM restaurants WHERE id=p_outlet;
 PERFORM 1 FROM organizations WHERE id=r.organization_id FOR UPDATE;
 IF actor IS NULL OR NOT app_private.can_outlet(p_outlet,'menu.write') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO previous FROM menu_imports WHERE organization_id=r.organization_id AND outlet_id=p_outlet AND created_by=actor AND request_key=p_key;
 IF FOUND THEN
  IF previous.id<>p_id OR previous.target_menu_id IS DISTINCT FROM p_target THEN RAISE EXCEPTION 'Import key conflict' USING ERRCODE='40001'; END IF;
  RETURN jsonb_build_object('id',previous.id,'status',previous.status,'revision',previous.revision,'duplicate',true);
 END IF;
 IF p_target IS NOT NULL AND NOT EXISTS(SELECT 1 FROM menus m WHERE m.id=p_target AND m.organization_id=r.organization_id AND NOT m.archived AND app_private.menu_access(m.id,'menu.write')) THEN
  RAISE EXCEPTION 'Target menu unavailable' USING ERRCODE='42501';
 END IF;
 IF (SELECT count(*) FROM menu_imports WHERE outlet_id=p_outlet AND status IN ('collecting','queued','processing','needs_review','ready'))>=5 THEN
  RAISE EXCEPTION 'Too many active imports' USING ERRCODE='22023';
 END IF;
 INSERT INTO menu_imports(id,organization_id,outlet_id,created_by,request_key,target_menu_id,currency)
 VALUES(p_id,r.organization_id,p_outlet,actor,p_key,p_target,r.currency);
 INSERT INTO domain_audit(id,organization_id,actor_id,action,details)
 VALUES(gen_random_uuid()::text,r.organization_id,actor,'menu_import.created',jsonb_build_object('importId',p_id,'outletId',p_outlet,'targetMenuId',p_target));
 RETURN jsonb_build_object('id',p_id,'status','collecting','revision',1,'duplicate',false);
END $$;
REVOKE ALL ON FUNCTION app_private.import_create(text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.import_create(text,text,text,text) TO menuminute_app;

CREATE FUNCTION app_private.import_source_reserve(p_outlet text,p_import text,p_source text,p_page integer,p_sha text,p_size integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE i menu_imports%ROWTYPE; previous menu_import_sources%ROWTYPE; key text;
BEGIN
 IF NOT app_private.can_outlet(p_outlet,'menu.write') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO i FROM menu_imports WHERE id=p_import AND outlet_id=p_outlet FOR UPDATE;
 IF NOT FOUND OR i.status<>'collecting' OR NOT app_private.can_outlet(p_outlet,'menu.write') THEN RAISE EXCEPTION 'Import not collecting' USING ERRCODE='42501'; END IF;
 SELECT * INTO previous FROM menu_import_sources WHERE id=p_source;
 IF FOUND THEN
  IF previous.import_id<>i.id OR previous.page_index<>p_page OR previous.request_sha256<>p_sha OR previous.request_bytes<>p_size THEN RAISE EXCEPTION 'Source key conflict' USING ERRCODE='40001'; END IF;
  RETURN jsonb_build_object('id',previous.id,'status',previous.status,'storageKey',previous.storage_key);
 END IF;
 IF p_page NOT BETWEEN 0 AND 11 OR p_size NOT BETWEEN 1 AND 5242880 OR p_sha !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Invalid source' USING ERRCODE='22023'; END IF;
 PERFORM 1 FROM organizations WHERE id=i.organization_id FOR UPDATE;
 IF NOT app_private.can_outlet(p_outlet,'menu.write') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 IF (SELECT count(*) FROM menu_import_sources WHERE outlet_id=p_outlet AND created_at>=now()-interval '1 hour')>=30 THEN RAISE EXCEPTION 'Hourly import source limit exceeded' USING ERRCODE='22023'; END IF;
 IF (SELECT count(*) FROM menu_import_sources WHERE outlet_id=p_outlet)>=30 THEN RAISE EXCEPTION 'Retained import storage budget exhausted' USING ERRCODE='54000'; END IF;
 IF (SELECT count(*) FROM menu_import_sources WHERE import_id=i.id)>=12 OR
  (SELECT coalesce(sum(request_bytes),0) FROM menu_import_sources WHERE import_id=i.id)+p_size>31457280 THEN RAISE EXCEPTION 'Import source limit exceeded' USING ERRCODE='22023'; END IF;
 key:=format('imports/%s/%s/%s.webp',i.organization_id,i.id,p_source);
 INSERT INTO menu_import_sources(id,import_id,organization_id,outlet_id,page_index,request_sha256,request_bytes,storage_key)
 VALUES(p_source,i.id,i.organization_id,i.outlet_id,p_page,p_sha,p_size,key);
 RETURN jsonb_build_object('id',p_source,'status','reserved','storageKey',key);
END $$;
REVOKE ALL ON FUNCTION app_private.import_source_reserve(text,text,text,integer,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.import_source_reserve(text,text,text,integer,text,integer) TO menuminute_app;

CREATE FUNCTION app_private.import_source_complete(p_outlet text,p_import text,p_source text,p_sha text,p_size integer,p_width integer,p_height integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE i menu_imports%ROWTYPE; s menu_import_sources%ROWTYPE; actor text:=current_setting('app.actor_id',true);
BEGIN
 IF NOT app_private.can_outlet(p_outlet,'menu.write') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO i FROM menu_imports WHERE id=p_import AND outlet_id=p_outlet FOR UPDATE;
 IF NOT FOUND OR i.status<>'collecting' OR NOT app_private.can_outlet(p_outlet,'menu.write') THEN RAISE EXCEPTION 'Import not collecting' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM menu_import_sources WHERE id=p_source AND import_id=i.id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Source unavailable' USING ERRCODE='22023'; END IF;
 IF s.status='ready' THEN
  IF s.stored_sha256<>p_sha OR s.stored_bytes<>p_size OR s.width<>p_width OR s.height<>p_height THEN RAISE EXCEPTION 'Source completion conflict' USING ERRCODE='40001'; END IF;
  RETURN jsonb_build_object('id',s.id,'status','ready','duplicate',true);
 END IF;
 IF s.status<>'reserved' OR p_sha !~ '^[0-9a-f]{64}$' OR p_size NOT BETWEEN 1 AND 5242880 OR p_width NOT BETWEEN 1 AND 10000 OR p_height NOT BETWEEN 1 AND 10000 OR p_width::bigint*p_height>10000000 THEN RAISE EXCEPTION 'Invalid processed source' USING ERRCODE='22023'; END IF;
 UPDATE menu_import_sources SET status='ready',stored_sha256=p_sha,stored_bytes=p_size,width=p_width,height=p_height,updated_at=now() WHERE id=s.id;
 UPDATE menu_imports SET revision=revision+1,updated_at=now() WHERE id=i.id;
 INSERT INTO domain_audit(id,organization_id,actor_id,action,details)
 VALUES(gen_random_uuid()::text,i.organization_id,actor,'menu_import.source_ready',jsonb_build_object('importId',i.id,'sourceId',s.id,'pageIndex',s.page_index));
 RETURN jsonb_build_object('id',s.id,'status','ready','duplicate',false);
END $$;
REVOKE ALL ON FUNCTION app_private.import_source_complete(text,text,text,text,integer,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.import_source_complete(text,text,text,text,integer,integer,integer) TO menuminute_app;

CREATE FUNCTION app_private.import_cancel(p_outlet text,p_import text,p_expected integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE i menu_imports%ROWTYPE; actor text:=current_setting('app.actor_id',true);
BEGIN
 IF NOT app_private.can_outlet(p_outlet,'menu.write') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO i FROM menu_imports WHERE id=p_import AND outlet_id=p_outlet FOR UPDATE;
 IF NOT FOUND OR NOT app_private.can_outlet(p_outlet,'menu.write') THEN RAISE EXCEPTION 'Import unavailable' USING ERRCODE='42501'; END IF;
 IF i.status='cancelled' THEN RETURN jsonb_build_object('id',i.id,'status',i.status,'revision',i.revision,'duplicate',true); END IF;
 IF i.revision<>p_expected THEN RAISE EXCEPTION 'Stale import revision' USING ERRCODE='40001'; END IF;
 IF i.status IN ('applied','expired','failed') THEN RAISE EXCEPTION 'Import cannot be cancelled' USING ERRCODE='22023'; END IF;
 UPDATE menu_imports SET status='cancelled',revision=revision+1,updated_at=now() WHERE id=i.id RETURNING * INTO i;
 INSERT INTO domain_audit(id,organization_id,actor_id,action,details)
 VALUES(gen_random_uuid()::text,i.organization_id,actor,'menu_import.cancelled',jsonb_build_object('importId',i.id,'outletId',p_outlet));
 RETURN jsonb_build_object('id',i.id,'status',i.status,'revision',i.revision,'duplicate',false);
END $$;
REVOKE ALL ON FUNCTION app_private.import_cancel(text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.import_cancel(text,text,integer) TO menuminute_app;
