-- PR 3: fenced, renewable AI import processing. Forward-only migration.
-- A healthy 12-page provider call must not be classified as a crash after 60s.
-- The immutable migration 0010 remains unchanged. An uncertain/crashed provider
-- request is deliberately NOT retried to avoid surprise extra billable requests.
ALTER TABLE menu_import_ai_usage
  ADD COLUMN execution_token text,
  ADD COLUMN heartbeat_at timestamptz;
ALTER TABLE menu_import_ai_usage
  ADD CONSTRAINT import_usage_fence_format
  CHECK (execution_token IS NULL OR execution_token ~
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
CREATE INDEX menu_import_ai_usage_running_heartbeat
  ON menu_import_ai_usage (heartbeat_at) WHERE state='started';

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
  RETURN jsonb_build_object('done',true);
 END IF;
 IF i.status<>'queued' OR FOUND OR p_model !~ '^[A-Za-z0-9._/-]{1,100}$' THEN
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
REVOKE ALL ON FUNCTION app_private.import_engine_begin(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.import_engine_begin(text,text,text)
 TO menuminute_worker;

CREATE FUNCTION app_private.import_engine_heartbeat(
  p_event text,p_org text,p_token text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE e outbox_events%ROWTYPE; alive boolean;
BEGIN
 SELECT * INTO e FROM outbox_events WHERE id=p_event AND organization_id=p_org
   AND type='menu_import.process' AND schema_version=1 FOR UPDATE;
 IF NOT FOUND OR e.status IN ('completed','failed') THEN RETURN false; END IF;
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
REVOKE ALL ON FUNCTION app_private.import_engine_heartbeat(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.import_engine_heartbeat(text,text,text)
 TO menuminute_worker;

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
REVOKE ALL ON FUNCTION app_private.import_engine_finish(text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.import_engine_finish(text,text,jsonb)
 TO menuminute_worker;
