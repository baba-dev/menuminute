-- Smart import hardening. Forward-only; 0009, 0010 and 0027 are unchanged.
--  1. The retained-source budget counts only imports still in use, so cancelled, failed, applied and
--     expired imports no longer lock an outlet out permanently. Private bytes are still never deleted.
--  2. A cancelled import is no longer renewable: the worker stops before the next billable page.
--  3. AI credits charged at submission are recorded, and credits for pages that were never sent to the
--     provider are returned when the import finishes, fails or is cancelled.
--  4. Applying to an existing menu appends the reviewed categories to its draft instead of replacing it.

ALTER TABLE menu_imports ADD COLUMN credits_charged integer NOT NULL DEFAULT 0
  CHECK (credits_charged BETWEEN 0 AND 12);

-- 1. Budget by live imports.
CREATE OR REPLACE FUNCTION app_private.import_source_reserve(p_outlet text,p_import text,p_source text,p_page integer,p_sha text,p_size integer)
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
 -- The hourly limit still counts every reservation, so churning cancelled sessions cannot bypass it.
 IF (SELECT count(*) FROM menu_import_sources WHERE outlet_id=p_outlet AND created_at>=now()-interval '1 hour')>=30 THEN RAISE EXCEPTION 'Hourly import source limit exceeded' USING ERRCODE='22023'; END IF;
 IF (SELECT count(*) FROM menu_import_sources s JOIN menu_imports m ON m.id=s.import_id
     WHERE s.outlet_id=p_outlet AND m.status NOT IN ('cancelled','failed','applied','expired'))>=30 THEN RAISE EXCEPTION 'Retained import storage budget exhausted' USING ERRCODE='54000'; END IF;
 IF (SELECT count(*) FROM menu_import_sources WHERE import_id=i.id)>=12 OR
  (SELECT coalesce(sum(request_bytes),0) FROM menu_import_sources WHERE import_id=i.id)+p_size>31457280 THEN RAISE EXCEPTION 'Import source limit exceeded' USING ERRCODE='22023'; END IF;
 key:=format('imports/%s/%s/%s.webp',i.organization_id,i.id,p_source);
 INSERT INTO menu_import_sources(id,import_id,organization_id,outlet_id,page_index,request_sha256,request_bytes,storage_key)
 VALUES(p_source,i.id,i.organization_id,i.outlet_id,p_page,p_sha,p_size,key);
 RETURN jsonb_build_object('id',p_source,'status','reserved','storageKey',key);
END $$;

-- 3. Credit bookkeeping. Recorded by the submitting editor in the same transaction as the spend.
CREATE FUNCTION app_private.import_record_credits(p_outlet text,p_import text,p_credits integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF NOT app_private.can_outlet(p_outlet,'menu.write') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 IF p_credits NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'Invalid credit count' USING ERRCODE='22023'; END IF;
 UPDATE menu_imports SET credits_charged=p_credits
  WHERE id=p_import AND outlet_id=p_outlet AND status='queued' AND credits_charged=0;
 IF NOT FOUND THEN RAISE EXCEPTION 'Import unavailable' USING ERRCODE='42501'; END IF;
END $$;
REVOKE ALL ON FUNCTION app_private.import_record_credits(text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.import_record_credits(text,text,integer) TO menuminute_app;

-- Internal only (no grants): returns credits charged beyond the pages actually sent. Runs at most once
-- per import because it zeroes the record. Never takes the allowance below zero.
CREATE FUNCTION app_private.import_release_credits(p_import text,p_sent integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE i menu_imports%ROWTYPE; unused integer; m date:=(date_trunc('month',now() AT TIME ZONE 'UTC'))::date;
BEGIN
 SELECT * INTO i FROM menu_imports WHERE id=p_import FOR UPDATE;
 IF NOT FOUND OR i.credits_charged=0 THEN RETURN; END IF;
 unused:=greatest(0,i.credits_charged-greatest(0,p_sent));
 UPDATE menu_imports SET credits_charged=0 WHERE id=i.id;
 IF unused=0 THEN RETURN; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('ai-credit:'||i.organization_id,0));
 UPDATE app_private.ai_credit_usage SET used=greatest(0,used-unused),updated_at=clock_timestamp()
  WHERE organization_id=i.organization_id AND month=m;
 INSERT INTO domain_audit(id,organization_id,actor_id,action,details)
 VALUES(gen_random_uuid()::text,i.organization_id,NULL,'menu_import.credits_released',
  jsonb_build_object('importId',i.id,'credits',unused));
END $$;
REVOKE ALL ON FUNCTION app_private.import_release_credits(text,integer) FROM PUBLIC;

-- 2/3. Renewable only while processing; cancelled imports release unused credits.
CREATE OR REPLACE FUNCTION app_private.import_engine_begin(
  p_event text,p_org text,p_model text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE e outbox_events%ROWTYPE; i menu_imports%ROWTYPE;
 u menu_import_ai_usage%ROWTYPE; sources jsonb; fence text;
BEGIN
 SELECT * INTO e FROM outbox_events
 WHERE id=p_event AND organization_id=p_org
  AND type='menu_import.process' AND schema_version=1 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invalid import event' USING ERRCODE='42501'; END IF;
 IF e.status IN ('completed','failed') THEN RETURN jsonb_build_object('done',true); END IF;
 SELECT * INTO i FROM menu_imports
 WHERE id=e.payload->>'importId' AND organization_id=p_org
   AND outlet_id=e.outlet_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invalid import scope' USING ERRCODE='42501'; END IF;
 SELECT * INTO u FROM menu_import_ai_usage WHERE event_id=e.id FOR UPDATE;
 IF FOUND AND u.state='started' THEN
  -- A duplicate/stalled BullMQ delivery NEVER starts a second provider call.
  IF u.heartbeat_at IS NOT NULL
    AND u.heartbeat_at >= clock_timestamp()-interval '120 seconds' THEN
   RETURN jsonb_build_object('done',true,'active',true);
  END IF;
  -- Genuinely lost execution: future calls may have been billed and may still
  -- be completing. Do not reissue a provider request without user intervention.
  UPDATE menu_import_ai_usage SET state='unknown',error_code='ambiguous_delivery',
   finished_at=clock_timestamp() WHERE event_id=e.id AND state='started';
  IF i.status='processing' THEN
   UPDATE menu_imports SET status='failed',revision=revision+1,updated_at=now()
   WHERE id=i.id;
  END IF;
  UPDATE outbox_events SET status='completed',completed_at=now(),
   lease_token=NULL,lease_until=NULL,last_error='ambiguous_delivery' WHERE id=e.id;
  INSERT INTO domain_audit(id,organization_id,actor_id,action,details)
   VALUES(gen_random_uuid()::text,i.organization_id,NULL,'menu_import.engine_unknown',
     jsonb_build_object('importId',i.id,'eventId',e.id));
  RETURN jsonb_build_object('done',true,'ambiguous',true);
 END IF;
 IF i.status='cancelled' THEN
  UPDATE outbox_events SET status='completed',completed_at=now(),
    lease_token=NULL,lease_until=NULL,last_error=NULL WHERE id=e.id;
  -- Cancelled before any page was sent: return every credit charged for it.
  PERFORM app_private.import_release_credits(i.id,0);
  RETURN jsonb_build_object('done',true);
 END IF;
 IF i.status<>'queued' OR u.event_id IS NOT NULL OR p_model !~ '^[A-Za-z0-9._/-]{1,100}$' THEN
  RAISE EXCEPTION 'Invalid import state' USING ERRCODE='42501';
 END IF;
 SELECT jsonb_agg(jsonb_build_object('id',s.id,'pageIndex',s.page_index,
   'key',s.storage_key,'sha',s.stored_sha256) ORDER BY s.page_index) INTO sources
 FROM menu_import_sources s WHERE s.import_id=i.id AND s.status='ready';
 IF sources IS NULL OR EXISTS(SELECT 1 FROM menu_import_sources
   WHERE import_id=i.id AND status<>'ready') THEN
  RAISE EXCEPTION 'Missing import sources' USING ERRCODE='42501';
 END IF;
 fence:=gen_random_uuid()::text;
 INSERT INTO menu_import_ai_usage(
   event_id,import_id,organization_id,outlet_id,model,execution_token,heartbeat_at)
 VALUES(e.id,i.id,i.organization_id,i.outlet_id,p_model,fence,clock_timestamp());
 UPDATE menu_imports SET status='processing',revision=revision+1,updated_at=now()
 WHERE id=i.id;
 UPDATE outbox_events SET next_attempt_at=now()+interval '120 seconds'
 WHERE id=e.id;
 RETURN jsonb_build_object('importId',i.id,'currency',i.currency,
   'sources',sources,'executionToken',fence);
END $$;
CREATE OR REPLACE FUNCTION app_private.import_engine_heartbeat(
  p_event text,p_org text,p_token text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE e outbox_events%ROWTYPE; alive boolean; st text;
BEGIN
 SELECT * INTO e FROM outbox_events WHERE id=p_event AND organization_id=p_org
   AND type='menu_import.process' AND schema_version=1 FOR UPDATE;
 IF NOT FOUND OR e.status IN ('completed','failed') THEN RETURN false; END IF;
 -- A cancelled (or otherwise no longer processing) import must not send further billable pages.
 SELECT status INTO st FROM menu_imports WHERE id=e.payload->>'importId' AND organization_id=p_org;
 IF st IS DISTINCT FROM 'processing' THEN RETURN false; END IF;
 UPDATE menu_import_ai_usage SET heartbeat_at=clock_timestamp()
 WHERE event_id=p_event AND organization_id=p_org
   AND execution_token=p_token AND state='started'
   AND heartbeat_at >= clock_timestamp()-interval '120 seconds'
 RETURNING true INTO alive;
 IF NOT coalesce(alive,false) THEN RETURN false; END IF;
 UPDATE outbox_events SET next_attempt_at=now()+interval '120 seconds'
 WHERE id=p_event AND status IN ('pending','dispatched');
 RETURN true;
END $$;

-- 3. Finish returns credits for pages never sent.
CREATE OR REPLACE FUNCTION app_private.import_engine_finish(
 p_event text,p_org text,p_result jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE e outbox_events%ROWTYPE; i menu_imports%ROWTYPE;
 u menu_import_ai_usage%ROWTYPE; ok boolean; doc jsonb;
 code text; request_count integer;
BEGIN
 SELECT * INTO e FROM outbox_events WHERE id=p_event AND organization_id=p_org
   AND type='menu_import.process' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invalid import event' USING ERRCODE='42501'; END IF;
 IF e.status='completed' THEN RETURN jsonb_build_object('done',true); END IF;
 SELECT * INTO i FROM menu_imports WHERE id=e.payload->>'importId'
  AND organization_id=p_org AND outlet_id=e.outlet_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invalid import scope' USING ERRCODE='42501'; END IF;
 SELECT * INTO u FROM menu_import_ai_usage WHERE event_id=e.id FOR UPDATE;
 IF NOT FOUND OR u.state<>'started' OR i.status NOT IN ('processing','cancelled')
   OR u.execution_token IS NULL
   OR u.execution_token IS DISTINCT FROM p_result->>'executionToken'
   OR u.heartbeat_at IS NULL
   OR u.heartbeat_at < clock_timestamp()-interval '120 seconds'
 THEN RAISE EXCEPTION 'Lost import execution lease' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_result)<>'object'
   OR jsonb_typeof(p_result->'usage')<>'object'
 THEN RAISE EXCEPTION 'Invalid engine receipt' USING ERRCODE='22023'; END IF;
 request_count:=(p_result->'usage'->>'requests')::integer;
 IF request_count NOT BETWEEN 0 AND 12
 THEN RAISE EXCEPTION 'Invalid request count' USING ERRCODE='22023'; END IF;
 ok:=coalesce((p_result->>'ok')::boolean,false) AND i.status='processing';
 doc:=p_result->'candidate';
 IF ok AND (jsonb_typeof(doc)<>'object' OR doc->>'importId'<>i.id
  OR doc->>'currency'<>i.currency OR (doc->>'schemaVersion')::integer<>1)
 THEN RAISE EXCEPTION 'Invalid candidate scope' USING ERRCODE='22023'; END IF;
 code:=CASE WHEN i.status='cancelled' THEN 'processing_failed'
   WHEN ok THEN NULL ELSE coalesce(p_result->>'error','processing_failed') END;
 IF code IS NOT NULL AND code NOT IN ('engine_unavailable','source_unavailable',
  'provider_unavailable','invalid_provider_response','processing_failed')
 THEN code:='processing_failed'; END IF;
 UPDATE menu_import_ai_usage SET
  state=CASE WHEN ok THEN 'completed' ELSE 'failed' END,
  requests=request_count,
  input_tokens=(p_result->'usage'->>'inputTokens')::integer,
  output_tokens=(p_result->'usage'->>'outputTokens')::integer,
  error_code=code,finished_at=now()
 WHERE event_id=e.id;
 PERFORM app_private.import_release_credits(i.id,request_count);
 IF ok THEN
  INSERT INTO menu_import_candidates(import_id,organization_id,outlet_id,
   revision,schema_version,document)
  VALUES(i.id,i.organization_id,i.outlet_id,i.revision+1,1,doc);
 END IF;
 IF i.status<>'cancelled' THEN
  UPDATE menu_imports SET status=CASE WHEN ok THEN 'needs_review' ELSE 'failed' END,
   revision=revision+1,updated_at=now() WHERE id=i.id;
 END IF;
 UPDATE outbox_events SET status='completed',completed_at=now(),
  lease_token=NULL,lease_until=NULL,last_error=code WHERE id=e.id;
 INSERT INTO domain_audit(id,organization_id,actor_id,action,details)
 VALUES(gen_random_uuid()::text,i.organization_id,NULL,'menu_import.engine_finished',
  jsonb_build_object('importId',i.id,'eventId',e.id,'success',ok,'error',code));
 RETURN jsonb_build_object('done',true,'success',ok);
END $$;

-- 4. Append-only application to an existing menu draft.
CREATE OR REPLACE FUNCTION app_private.import_apply(p_outlet text,p_import text,p_expected integer,p_menu text,p_menu_expected integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE outlet restaurants%ROWTYPE; i menu_imports%ROWTYPE; review menu_import_reviews%ROWTYPE; m menus%ROWTYPE; v integer; actor text:=current_setting('app.actor_id',true);
BEGIN
 IF NOT app_private.can_outlet(p_outlet,'menu.write') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';END IF;
 SELECT * INTO outlet FROM restaurants WHERE id=p_outlet;
 PERFORM 1 FROM organizations WHERE id=outlet.organization_id FOR UPDATE;
 IF NOT app_private.can_outlet(p_outlet,'menu.write') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';END IF;
 SELECT * INTO i FROM menu_imports WHERE id=p_import AND organization_id=outlet.organization_id AND outlet_id=p_outlet FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Import unavailable' USING ERRCODE='42501';END IF;
 SELECT * INTO review FROM menu_import_reviews WHERE import_id=i.id FOR UPDATE;
 IF i.status='applied' AND review.state='applied' AND review.applied_menu_id=p_menu AND i.revision=p_expected+1
 THEN RETURN jsonb_build_object('id',i.id,'menuId',p_menu,'menuRevision',review.applied_menu_revision,'revision',i.revision,'duplicate',true);END IF;
 IF i.revision<>p_expected THEN RAISE EXCEPTION 'Stale import revision' USING ERRCODE='40001';END IF;
 IF i.status<>'ready' OR review.state<>'confirmed' OR review.review_revision<>i.revision OR review.document->>'currency'<>outlet.currency THEN RAISE EXCEPTION 'Review must be confirmed before application' USING ERRCODE='22023';END IF;
 IF review.confirmed_ids IS NULL OR jsonb_array_length(review.confirmed_ids)=0 THEN RAISE EXCEPTION 'No confirmed fields' USING ERRCODE='22023';END IF;
 IF i.target_menu_id IS NOT NULL AND p_menu<>i.target_menu_id THEN RAISE EXCEPTION 'Target changed' USING ERRCODE='42501';END IF;
 IF i.target_menu_id IS NULL THEN
  IF p_menu_expected<>0 OR p_menu !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR EXISTS(SELECT 1 FROM menus WHERE id=p_menu) THEN RAISE EXCEPTION 'New menu identity conflict' USING ERRCODE='40001';END IF;
  INSERT INTO menus(id,organization_id,outlet_id,document) VALUES(p_menu,i.organization_id,i.outlet_id,review.document);
  INSERT INTO menu_assignments(organization_id,menu_id,outlet_id) VALUES(i.organization_id,p_menu,p_outlet);
  v:=1;
 ELSE
  SELECT * INTO m FROM menus WHERE id=p_menu AND organization_id=i.organization_id FOR UPDATE;
  IF NOT FOUND OR m.archived OR m.revision<>p_menu_expected OR NOT app_private.menu_access(p_menu,'menu.write') OR
   (m.document->>'currency')<>i.currency THEN RAISE EXCEPTION 'Menu is unavailable or its revision changed' USING ERRCODE='40001';END IF;
  -- Published revisions remain immutable. Only the editable draft changes, and it is APPENDED to:
  -- existing categories, dishes, photos and dietary data stay exactly as they were.
  UPDATE menus SET document=jsonb_set(m.document,'{categories}',
    coalesce(m.document->'categories','[]'::jsonb)||coalesce(review.document->'categories','[]'::jsonb)),
   revision=revision+1,updated_at=now() WHERE id=m.id RETURNING revision INTO v;
 END IF;
 UPDATE menu_imports SET status='applied',revision=revision+1,updated_at=now() WHERE id=i.id RETURNING * INTO i;
 UPDATE menu_import_reviews SET state='applied',review_revision=i.revision,applied_menu_id=p_menu,applied_menu_revision=v,updated_by=actor,updated_at=now() WHERE import_id=i.id;
 INSERT INTO domain_audit(id,organization_id,actor_id,action,details) VALUES(gen_random_uuid()::text,i.organization_id,actor,'menu_import.draft_applied',jsonb_build_object('importId',i.id,'menuId',p_menu,'menuRevision',v,'published',false));
 PERFORM app_private.record_org_change(i.organization_id,'menu.import_apply',p_outlet);
 RETURN jsonb_build_object('id',i.id,'status','applied','revision',i.revision,'menuId',p_menu,'menuRevision',v,'duplicate',false);
END $$;
