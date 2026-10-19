-- PR B: append-only NVIDIA import queue, read-only candidate and provider usage accounting.
CREATE TABLE menu_import_ai_usage (
 event_id text PRIMARY KEY REFERENCES outbox_events(id) ON DELETE RESTRICT,
 import_id text NOT NULL,
 organization_id text NOT NULL,
 outlet_id text NOT NULL,
 model text NOT NULL,
 state text NOT NULL DEFAULT 'started' CHECK(state IN ('started','completed','failed','unknown')),
 requests integer NOT NULL DEFAULT 0 CHECK(requests BETWEEN 0 AND 12),
 input_tokens integer CHECK(input_tokens BETWEEN 0 AND 10000000),
 output_tokens integer CHECK(output_tokens BETWEEN 0 AND 10000000),
 error_code text CHECK(error_code IS NULL OR error_code IN ('engine_unavailable','source_unavailable','provider_unavailable','invalid_provider_response','processing_failed','ambiguous_delivery')),
 created_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz,
 CONSTRAINT import_usage_parent FOREIGN KEY(import_id,organization_id,outlet_id) REFERENCES menu_imports(id,organization_id,outlet_id),
 CONSTRAINT import_usage_one_call UNIQUE(import_id)
);
ALTER TABLE menu_import_ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY import_usage_editor_read ON menu_import_ai_usage FOR SELECT TO menuminute_app
 USING(app_private.can_outlet(outlet_id,'menu.write'));
GRANT SELECT ON menu_import_ai_usage TO menuminute_app;

CREATE FUNCTION app_private.import_enqueue(p_outlet text,p_import text,p_revision integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE i menu_imports%ROWTYPE; eid text:=gen_random_uuid()::text; n integer;
BEGIN
 IF NOT app_private.can_outlet(p_outlet,'menu.write') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO i FROM menu_imports WHERE id=p_import AND outlet_id=p_outlet FOR UPDATE;
 IF NOT FOUND OR NOT app_private.can_outlet(p_outlet,'menu.write') THEN RAISE EXCEPTION 'Import unavailable' USING ERRCODE='42501'; END IF;
 IF i.revision<>p_revision THEN RAISE EXCEPTION 'Stale revision' USING ERRCODE='40001'; END IF;
 IF i.status<>'collecting' OR EXISTS(SELECT 1 FROM menu_import_ai_usage WHERE import_id=i.id) THEN RAISE EXCEPTION 'Import already submitted' USING ERRCODE='22023'; END IF;
 SELECT count(*) INTO n FROM menu_import_sources WHERE import_id=i.id AND status='ready';
 IF n<1 OR EXISTS(SELECT 1 FROM menu_import_sources WHERE import_id=i.id AND status<>'ready') THEN RAISE EXCEPTION 'Finish every source upload before processing' USING ERRCODE='22023'; END IF;
 PERFORM 1 FROM organizations WHERE id=i.organization_id FOR UPDATE;
 IF (SELECT count(*) FROM menu_import_ai_usage WHERE organization_id=i.organization_id AND created_at>=now()-interval '1 day')>=20 THEN RAISE EXCEPTION 'Daily import engine limit' USING ERRCODE='54000'; END IF;
 UPDATE menu_imports SET status='queued',revision=revision+1,updated_at=now() WHERE id=i.id RETURNING * INTO i;
 INSERT INTO outbox_events(id,organization_id,outlet_id,type,schema_version,aggregate_version,payload,max_attempts)
 VALUES(eid,i.organization_id,p_outlet,'menu_import.process',1,i.revision,jsonb_build_object('importId',i.id),3);
 INSERT INTO domain_audit(id,organization_id,actor_id,action,details) VALUES(gen_random_uuid()::text,i.organization_id,current_setting('app.actor_id',true),'menu_import.queued',jsonb_build_object('importId',i.id,'eventId',eid));
 RETURN jsonb_build_object('id',i.id,'status',i.status,'revision',i.revision);
END $$;
REVOKE ALL ON FUNCTION app_private.import_enqueue(text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.import_enqueue(text,text,integer) TO menuminute_app;

CREATE FUNCTION app_private.import_engine_begin(p_event text,p_org text,p_model text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE e outbox_events%ROWTYPE; i menu_imports%ROWTYPE; sources jsonb;
BEGIN
 SELECT * INTO e FROM outbox_events WHERE id=p_event AND organization_id=p_org AND type='menu_import.process' AND schema_version=1 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invalid import event' USING ERRCODE='42501'; END IF;
 IF e.status='completed' THEN RETURN jsonb_build_object('done',true); END IF;
 SELECT * INTO i FROM menu_imports WHERE id=e.payload->>'importId' AND organization_id=p_org AND outlet_id=e.outlet_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invalid import scope' USING ERRCODE='42501'; END IF;
 IF i.status='cancelled' THEN
  UPDATE outbox_events SET status='completed',completed_at=now(),lease_token=NULL,lease_until=NULL,last_error=NULL WHERE id=e.id;
  RETURN jsonb_build_object('done',true);
 END IF;
 -- Retry after a worker crash cannot safely replay a potentially billable request.
 IF i.status='processing' AND EXISTS(SELECT 1 FROM menu_import_ai_usage WHERE event_id=e.id AND state='started') THEN
  UPDATE menu_import_ai_usage SET state='unknown',error_code='ambiguous_delivery',finished_at=now() WHERE event_id=e.id;
  UPDATE menu_imports SET status='failed',revision=revision+1,updated_at=now() WHERE id=i.id;
  UPDATE outbox_events SET status='completed',completed_at=now(),lease_token=NULL,lease_until=NULL,last_error='ambiguous_delivery' WHERE id=e.id;
  RETURN jsonb_build_object('done',true);
 END IF;
 IF i.status<>'queued' OR p_model !~ '^[A-Za-z0-9._/-]{1,100}$' THEN RAISE EXCEPTION 'Invalid import state' USING ERRCODE='42501'; END IF;
 SELECT jsonb_agg(jsonb_build_object('id',s.id,'pageIndex',s.page_index,'key',s.storage_key,'sha',s.stored_sha256) ORDER BY s.page_index) INTO sources
 FROM menu_import_sources s WHERE s.import_id=i.id AND s.status='ready';
 IF sources IS NULL OR EXISTS(SELECT 1 FROM menu_import_sources WHERE import_id=i.id AND status<>'ready') THEN RAISE EXCEPTION 'Missing import sources' USING ERRCODE='42501'; END IF;
 INSERT INTO menu_import_ai_usage(event_id,import_id,organization_id,outlet_id,model) VALUES(e.id,i.id,i.organization_id,i.outlet_id,p_model);
 UPDATE menu_imports SET status='processing',revision=revision+1,updated_at=now() WHERE id=i.id;
 RETURN jsonb_build_object('importId',i.id,'currency',i.currency,'sources',sources);
END $$;
REVOKE ALL ON FUNCTION app_private.import_engine_begin(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.import_engine_begin(text,text,text) TO menuminute_worker;

CREATE FUNCTION app_private.import_engine_finish(p_event text,p_org text,p_result jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE e outbox_events%ROWTYPE; i menu_imports%ROWTYPE; u menu_import_ai_usage%ROWTYPE; ok boolean; doc jsonb; code text; request_count integer;
BEGIN
 SELECT * INTO e FROM outbox_events WHERE id=p_event AND organization_id=p_org AND type='menu_import.process' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invalid import event' USING ERRCODE='42501'; END IF;
 IF e.status='completed' THEN RETURN jsonb_build_object('done',true); END IF;
 SELECT * INTO i FROM menu_imports WHERE id=e.payload->>'importId' AND organization_id=p_org AND outlet_id=e.outlet_id FOR UPDATE;
 SELECT * INTO u FROM menu_import_ai_usage WHERE event_id=e.id FOR UPDATE;
 IF NOT FOUND OR u.state<>'started' OR i.status NOT IN ('processing','cancelled') THEN RAISE EXCEPTION 'Invalid engine state' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_result)<>'object' OR jsonb_typeof(p_result->'usage')<>'object' THEN RAISE EXCEPTION 'Invalid engine receipt' USING ERRCODE='22023'; END IF;
 request_count:=(p_result->'usage'->>'requests')::integer;
 IF request_count NOT BETWEEN 0 AND 12 THEN RAISE EXCEPTION 'Invalid request count' USING ERRCODE='22023'; END IF;
 ok:=coalesce((p_result->>'ok')::boolean,false) AND i.status='processing';
 doc:=p_result->'candidate';
 IF ok AND (jsonb_typeof(doc)<>'object' OR doc->>'importId'<>i.id OR doc->>'currency'<>i.currency OR (doc->>'schemaVersion')::integer<>1) THEN RAISE EXCEPTION 'Invalid candidate scope' USING ERRCODE='22023'; END IF;
 code:=CASE WHEN i.status='cancelled' THEN 'processing_failed' WHEN ok THEN NULL ELSE coalesce(p_result->>'error','processing_failed') END;
 IF code IS NOT NULL AND code NOT IN ('engine_unavailable','source_unavailable','provider_unavailable','invalid_provider_response','processing_failed') THEN code:='processing_failed'; END IF;
 UPDATE menu_import_ai_usage SET state=CASE WHEN ok THEN 'completed' ELSE 'failed' END,requests=request_count,
  input_tokens=(p_result->'usage'->>'inputTokens')::integer,output_tokens=(p_result->'usage'->>'outputTokens')::integer,
  error_code=code,finished_at=now() WHERE event_id=e.id;
 IF ok THEN
  INSERT INTO menu_import_candidates(import_id,organization_id,outlet_id,revision,schema_version,document)
  VALUES(i.id,i.organization_id,i.outlet_id,i.revision+1,1,doc);
 END IF;
 IF i.status<>'cancelled' THEN UPDATE menu_imports SET status=CASE WHEN ok THEN 'needs_review' ELSE 'failed' END,revision=revision+1,updated_at=now() WHERE id=i.id; END IF;
 UPDATE outbox_events SET status='completed',completed_at=now(),lease_token=NULL,lease_until=NULL,last_error=code WHERE id=e.id;
 INSERT INTO domain_audit(id,organization_id,actor_id,action,details) VALUES(gen_random_uuid()::text,i.organization_id,NULL,'menu_import.engine_finished',jsonb_build_object('importId',i.id,'eventId',e.id,'success',ok,'error',code));
 RETURN jsonb_build_object('done',true,'success',ok);
END $$;
REVOKE ALL ON FUNCTION app_private.import_engine_finish(text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.import_engine_finish(text,text,jsonb) TO menuminute_worker;
