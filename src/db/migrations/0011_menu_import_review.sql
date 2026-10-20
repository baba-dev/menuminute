-- PR D: independent human review and draft-only application. Never modify prior migrations.
CREATE TABLE menu_import_reviews (
 import_id text PRIMARY KEY,
 organization_id text NOT NULL,
 outlet_id text NOT NULL,
 base_candidate_revision integer NOT NULL CHECK(base_candidate_revision>0),
 review_revision integer NOT NULL CHECK(review_revision>0),
 document jsonb NOT NULL CHECK(jsonb_typeof(document)='object' AND octet_length(document::text)<=600000),
 confirmed_ids jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(confirmed_ids)='array'),
 state text NOT NULL CHECK(state IN ('editing','confirmed','applied')),
 applied_menu_id text,
 applied_menu_revision integer,
 updated_by text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT review_scope FOREIGN KEY(import_id,organization_id,outlet_id) REFERENCES menu_imports(id,organization_id,outlet_id) ON DELETE RESTRICT,
 CONSTRAINT review_applied_consistency CHECK((state='applied')=(applied_menu_id IS NOT NULL AND applied_menu_revision IS NOT NULL))
);
ALTER TABLE menu_import_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY import_review_editor_read ON menu_import_reviews FOR SELECT TO menuminute_app
 USING(app_private.can_outlet(outlet_id,'menu.write'));
GRANT SELECT ON menu_import_reviews TO menuminute_app;

CREATE FUNCTION app_private.import_review_save(
 p_outlet text,p_import text,p_expected integer,p_candidate integer,p_doc jsonb,p_confirmed jsonb,p_finalize boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE i menu_imports%ROWTYPE; r menu_import_reviews%ROWTYPE; cand menu_import_candidates%ROWTYPE; actual_ids text[]; confirmed_ids text[]; doc_ids text[];
BEGIN
 IF NOT app_private.can_outlet(p_outlet,'menu.write') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';END IF;
 SELECT * INTO i FROM menu_imports WHERE id=p_import AND outlet_id=p_outlet FOR UPDATE;
 IF NOT FOUND OR NOT app_private.can_outlet(p_outlet,'menu.write') THEN RAISE EXCEPTION 'Import unavailable' USING ERRCODE='42501';END IF;
 IF i.revision<>p_expected THEN RAISE EXCEPTION 'Stale import revision' USING ERRCODE='40001';END IF;
 IF i.status NOT IN ('needs_review','ready') THEN RAISE EXCEPTION 'Import is not reviewable' USING ERRCODE='22023';END IF;
 SELECT * INTO cand FROM menu_import_candidates WHERE import_id=i.id ORDER BY revision DESC LIMIT 1;
 IF NOT FOUND OR cand.revision<>p_candidate OR cand.document->>'importId'<>i.id THEN RAISE EXCEPTION 'Candidate revision changed' USING ERRCODE='40001';END IF;
 IF jsonb_typeof(p_doc)<>'object' OR p_doc->>'currency'<>i.currency OR jsonb_typeof(p_doc->'categories')<>'array' OR octet_length(p_doc::text)>500000 THEN RAISE EXCEPTION 'Invalid reviewed document' USING ERRCODE='22023';END IF;
 IF jsonb_typeof(p_confirmed)<>'array' OR jsonb_array_length(p_confirmed)>120000 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_confirmed) x WHERE jsonb_typeof(x.value)<>'string') THEN RAISE EXCEPTION 'Invalid confirmations' USING ERRCODE='22023';END IF;
 SELECT array_agg(id ORDER BY id) INTO actual_ids FROM (
 SELECT c->>'id' AS id FROM jsonb_array_elements(cand.document->'categories') c
 UNION ALL SELECT d->>'id' FROM jsonb_array_elements(cand.document->'categories') c CROSS JOIN LATERAL jsonb_array_elements(c->'items') d
 UNION ALL SELECT v->>'id' FROM jsonb_array_elements(cand.document->'categories') c CROSS JOIN LATERAL jsonb_array_elements(c->'items') d CROSS JOIN LATERAL jsonb_array_elements(d->'variants') v
 ) ids;
 SELECT array_agg(id ORDER BY id) INTO doc_ids FROM (
 SELECT c->>'id' AS id FROM jsonb_array_elements(p_doc->'categories') c
 UNION ALL SELECT d->>'id' FROM jsonb_array_elements(p_doc->'categories') c CROSS JOIN LATERAL jsonb_array_elements(c->'items') d
 UNION ALL SELECT v->>'id' FROM jsonb_array_elements(p_doc->'categories') c CROSS JOIN LATERAL jsonb_array_elements(c->'items') d CROSS JOIN LATERAL jsonb_array_elements(d->'variants') v
 ) ids;
 SELECT array_agg(value ORDER BY value) INTO confirmed_ids FROM jsonb_array_elements_text(p_confirmed) v(value);
 IF actual_ids IS DISTINCT FROM doc_ids OR
  (SELECT count(*) FROM unnest(actual_ids) a)<>(SELECT count(DISTINCT a) FROM unnest(actual_ids) a) OR
  EXISTS(SELECT 1 FROM jsonb_array_elements(p_doc->'categories') c CROSS JOIN LATERAL jsonb_array_elements(c->'items') d WHERE jsonb_array_length(coalesce(d->'dietary','[]'::jsonb))<>0 OR d->>'mediaId' IS NOT NULL OR (d->>'archived')::boolean OR (d->>'soldOut')::boolean) OR
  EXISTS(SELECT 1 FROM jsonb_array_elements(p_doc->'categories') c WHERE (c->>'archived')::boolean) OR
  EXISTS(SELECT 1 FROM unnest(confirmed_ids) x WHERE NOT (x=ANY(actual_ids))) OR
  (SELECT count(*) FROM unnest(confirmed_ids) x)<>(SELECT count(DISTINCT x) FROM unnest(confirmed_ids) x)
 THEN RAISE EXCEPTION 'Candidate structure or confirmation mismatch' USING ERRCODE='22023';END IF;
 IF p_finalize AND (confirmed_ids IS DISTINCT FROM actual_ids OR
  EXISTS(SELECT 1 FROM jsonb_array_elements(p_doc->'categories') c WHERE btrim(coalesce(c->>'name',''))='') OR
  EXISTS(SELECT 1 FROM jsonb_array_elements(p_doc->'categories') c CROSS JOIN LATERAL jsonb_array_elements(c->'items') d WHERE btrim(coalesce(d->>'name',''))=''))
 THEN RAISE EXCEPTION 'Every field needs human confirmation' USING ERRCODE='22023';END IF;
 UPDATE menu_imports SET revision=revision+1,status=CASE WHEN p_finalize THEN 'ready' ELSE 'needs_review' END,updated_at=now() WHERE id=i.id RETURNING * INTO i;
 INSERT INTO menu_import_reviews(import_id,organization_id,outlet_id,base_candidate_revision,review_revision,document,confirmed_ids,state,updated_by)
 VALUES(i.id,i.organization_id,i.outlet_id,p_candidate,i.revision,p_doc,p_confirmed,CASE WHEN p_finalize THEN 'confirmed' ELSE 'editing' END,current_setting('app.actor_id',true))
 ON CONFLICT(import_id) DO UPDATE SET base_candidate_revision=excluded.base_candidate_revision,review_revision=excluded.review_revision,document=excluded.document,confirmed_ids=excluded.confirmed_ids,state=excluded.state,updated_by=excluded.updated_by,updated_at=now();
 INSERT INTO domain_audit(id,organization_id,actor_id,action,details) VALUES(gen_random_uuid()::text,i.organization_id,current_setting('app.actor_id',true),'menu_import.review_saved',jsonb_build_object('importId',i.id,'revision',i.revision,'confirmed',p_finalize));
 RETURN jsonb_build_object('id',i.id,'revision',i.revision,'status',i.status);
END $$;
REVOKE ALL ON FUNCTION app_private.import_review_save(text,text,integer,integer,jsonb,jsonb,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.import_review_save(text,text,integer,integer,jsonb,jsonb,boolean) TO menuminute_app;

CREATE FUNCTION app_private.import_apply(p_outlet text,p_import text,p_expected integer,p_menu text,p_menu_expected integer)
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
  -- Published revisions remain immutable. Only the editable draft changes.
  UPDATE menus SET document=review.document,revision=revision+1,updated_at=now() WHERE id=m.id RETURNING revision INTO v;
 END IF;
 UPDATE menu_imports SET status='applied',revision=revision+1,updated_at=now() WHERE id=i.id RETURNING * INTO i;
 UPDATE menu_import_reviews SET state='applied',review_revision=i.revision,applied_menu_id=p_menu,applied_menu_revision=v,updated_by=actor,updated_at=now() WHERE import_id=i.id;
 INSERT INTO domain_audit(id,organization_id,actor_id,action,details) VALUES(gen_random_uuid()::text,i.organization_id,actor,'menu_import.draft_applied',jsonb_build_object('importId',i.id,'menuId',p_menu,'menuRevision',v,'published',false));
 PERFORM app_private.record_org_change(i.organization_id,'menu.import_apply',p_outlet);
 RETURN jsonb_build_object('id',i.id,'status','applied','revision',i.revision,'menuId',p_menu,'menuRevision',v,'duplicate',false);
END $$;
REVOKE ALL ON FUNCTION app_private.import_apply(text,text,integer,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.import_apply(text,text,integer,text,integer) TO menuminute_app;
