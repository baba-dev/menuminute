-- Production F-H: reviewed menu localization and guarded finance completion.
-- Expand-only: all new capabilities remain unavailable until explicitly configured and gated.

CREATE TABLE menu_translations (
 organization_id text NOT NULL,
 menu_id text NOT NULL REFERENCES menus(id),
 locale text NOT NULL CHECK(locale ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 source_revision integer NOT NULL,
 document jsonb NOT NULL CHECK(jsonb_typeof(document)='object' AND octet_length(document::text)<=300000),
 reviewed_by text NOT NULL REFERENCES users(id),
 reviewed_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(menu_id,locale),
 FOREIGN KEY(organization_id,menu_id) REFERENCES menus(organization_id,id),
 FOREIGN KEY(menu_id,source_revision) REFERENCES menu_releases(menu_id,revision)
);
CREATE TABLE menu_translation_revisions (
 organization_id text NOT NULL,
 menu_id text NOT NULL,
 locale text NOT NULL,
 revision integer NOT NULL CHECK(revision>0),
 source_revision integer NOT NULL,
 document jsonb NOT NULL CHECK(jsonb_typeof(document)='object' AND octet_length(document::text)<=300000),
 reviewed_by text NOT NULL REFERENCES users(id),
 reviewed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(menu_id,locale,revision),
 FOREIGN KEY(organization_id,menu_id) REFERENCES menus(organization_id,id),
 FOREIGN KEY(menu_id,source_revision) REFERENCES menu_releases(menu_id,revision)
);
CREATE INDEX menu_translation_source ON menu_translations(menu_id,source_revision,locale);
ALTER TABLE menu_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_translation_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON menu_translations,menu_translation_revisions FROM PUBLIC,menuminute_app,menuminute_worker;

CREATE FUNCTION app_private.menu_translation_list(p_menu text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE m menus%ROWTYPE;
BEGIN
 IF NOT app_private.menu_access(p_menu,'menu.read') THEN
  RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
 END IF;
 SELECT * INTO m FROM menus WHERE id=p_menu;
 IF NOT FOUND THEN RAISE EXCEPTION 'Menu unavailable' USING ERRCODE='22023'; END IF;
 RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object(
  'locale',t.locale,'revision',t.revision,'sourceRevision',t.source_revision,
  'reviewedAt',t.reviewed_at,'reviewedBy',t.reviewed_by,
  'stale',m.published_revision IS NULL OR t.source_revision<>m.published_revision,
  'document',t.document) ORDER BY t.locale)
 FROM menu_translations t WHERE t.menu_id=p_menu),'[]'::jsonb);
END $$;

CREATE FUNCTION app_private.menu_translation_command(
 p_outlet text,p_menu text,p_locale text,p_source integer,p_expected integer,p_document jsonb,p_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE r restaurants%ROWTYPE;m menus%ROWTYPE;rel menu_releases%ROWTYPE;
 current_translation menu_translations%ROWTYPE;prior domain_commands%ROWTYPE;
 actor text:=NULLIF(current_setting('app.actor_id',true),'');cmd jsonb;result jsonb;next_revision integer;
BEGIN
 IF actor IS NULL OR NOT app_private.can_outlet(p_outlet,'menu.write') THEN
  RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
 END IF;
 SELECT * INTO r FROM restaurants WHERE id=p_outlet;
 SELECT * INTO m FROM menus WHERE id=p_menu AND organization_id=r.organization_id FOR SHARE;
 IF NOT FOUND OR NOT app_private.menu_access(p_menu,'menu.write') OR
    NOT EXISTS(SELECT 1 FROM menu_assignments WHERE menu_id=p_menu AND outlet_id=p_outlet) THEN
  RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
 END IF;
 IF p_locale !~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$' OR length(p_locale)>35 OR
    p_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR
    jsonb_typeof(p_document)<>'object' OR octet_length(p_document::text)>300000 THEN
  RAISE EXCEPTION 'Invalid translation' USING ERRCODE='22023';
 END IF;
 SELECT * INTO rel FROM menu_releases WHERE menu_id=p_menu AND revision=p_source;
 IF NOT FOUND OR m.published_revision IS DISTINCT FROM p_source THEN
  RAISE EXCEPTION 'Published source changed' USING ERRCODE='40001';
 END IF;
 -- SQL repeats the structural boundary: a translation has every and only the IDs
 -- in the immutable source release. It can never smuggle prices or new catalog entities.
 IF (SELECT array_agg(value->>'id' ORDER BY value->>'id') FROM jsonb_array_elements(rel.document->'categories'))
    IS DISTINCT FROM
    (SELECT array_agg(value->>'id' ORDER BY value->>'id') FROM jsonb_array_elements(p_document->'categories')) OR
    (SELECT array_agg(i->>'id' ORDER BY i->>'id') FROM jsonb_array_elements(rel.document->'categories') c,
      jsonb_array_elements(c->'items') i)
    IS DISTINCT FROM
    (SELECT array_agg(i->>'id' ORDER BY i->>'id') FROM jsonb_array_elements(p_document->'categories') c,
      jsonb_array_elements(c->'items') i) OR
    (SELECT array_agg(v->>'id' ORDER BY v->>'id') FROM jsonb_array_elements(rel.document->'categories') c,
      jsonb_array_elements(c->'items') i,jsonb_array_elements(i->'variants') v)
    IS DISTINCT FROM
    (SELECT array_agg(v->>'id' ORDER BY v->>'id') FROM jsonb_array_elements(p_document->'categories') c,
      jsonb_array_elements(c->'items') i,jsonb_array_elements(i->'variants') v) OR
    (SELECT array_agg(g->>'id' ORDER BY g->>'id') FROM jsonb_array_elements(rel.document->'categories') c,
      jsonb_array_elements(c->'items') i,jsonb_array_elements(i->'addOnGroups') g)
    IS DISTINCT FROM
    (SELECT array_agg(g->>'id' ORDER BY g->>'id') FROM jsonb_array_elements(p_document->'categories') c,
      jsonb_array_elements(c->'items') i,jsonb_array_elements(i->'addOnGroups') g) OR
    (SELECT array_agg(o->>'id' ORDER BY o->>'id') FROM jsonb_array_elements(rel.document->'categories') c,
      jsonb_array_elements(c->'items') i,jsonb_array_elements(i->'addOnGroups') g,jsonb_array_elements(g->'options') o)
    IS DISTINCT FROM
    (SELECT array_agg(o->>'id' ORDER BY o->>'id') FROM jsonb_array_elements(p_document->'categories') c,
      jsonb_array_elements(c->'items') i,jsonb_array_elements(i->'addOnGroups') g,jsonb_array_elements(g->'options') o)
 THEN RAISE EXCEPTION 'Translation structure changed' USING ERRCODE='22023'; END IF;
 cmd:=jsonb_build_object('action','menu.translation.review','outletId',p_outlet,'menuId',p_menu,
  'locale',p_locale,'sourceRevision',p_source,'expectedRevision',p_expected,'document',p_document);
 SELECT * INTO prior FROM domain_commands
 WHERE organization_id=r.organization_id AND actor_id=actor AND request_key=p_key;
 IF FOUND THEN
  IF prior.command<>cmd THEN RAISE EXCEPTION 'Key conflict' USING ERRCODE='40001'; END IF;
  RETURN prior.result||jsonb_build_object('duplicate',true);
 END IF;
 SELECT * INTO current_translation FROM menu_translations
 WHERE menu_id=p_menu AND locale=p_locale FOR UPDATE;
 IF COALESCE(current_translation.revision,0)<>p_expected THEN
  RAISE EXCEPTION 'Translation changed' USING ERRCODE='40001';
 END IF;
 next_revision:=p_expected+1;
 INSERT INTO menu_translation_revisions(
  organization_id,menu_id,locale,revision,source_revision,document,reviewed_by
 ) VALUES(r.organization_id,p_menu,p_locale,next_revision,p_source,p_document,actor);
 INSERT INTO menu_translations(
  organization_id,menu_id,locale,revision,source_revision,document,reviewed_by
 ) VALUES(r.organization_id,p_menu,p_locale,next_revision,p_source,p_document,actor)
 ON CONFLICT(menu_id,locale) DO UPDATE SET revision=excluded.revision,
  source_revision=excluded.source_revision,document=excluded.document,reviewed_by=excluded.reviewed_by,
  reviewed_at=now(),updated_at=now();
 result:=jsonb_build_object('locale',p_locale,'revision',next_revision,'sourceRevision',p_source,
  'reviewedAt',now(),'stale',false,'document',p_document);
 INSERT INTO domain_commands(id,organization_id,actor_id,request_key,command,result)
 VALUES(gen_random_uuid()::text,r.organization_id,actor,p_key,cmd,result);
 INSERT INTO domain_audit(id,organization_id,actor_id,action,details)
 VALUES(gen_random_uuid()::text,r.organization_id,actor,'menu.translation.reviewed',
  jsonb_build_object('outletId',p_outlet,'menuId',p_menu,'locale',p_locale,
   'sourceRevision',p_source,'translationRevision',next_revision));
 RETURN result;
END $$;

CREATE FUNCTION app_private.public_menu_locales(p_token text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT COALESCE(jsonb_agg(x.locale ORDER BY x.locale),'[]'::jsonb)
 FROM (SELECT DISTINCT t.locale FROM qr_codes q
 JOIN restaurants r ON r.id=q.restaurant_id JOIN organizations org ON org.id=r.organization_id
 JOIN menu_assignments a ON a.outlet_id=r.id JOIN menus m ON m.id=a.menu_id
 JOIN menu_translations t ON t.menu_id=m.id AND t.source_revision=m.published_revision
 WHERE q.destination_token=p_token AND q.is_active AND r.is_active AND r.is_published
  AND org.is_active AND NOT m.archived) x
$$;
CREATE FUNCTION app_private.public_menu_translations(p_token text,p_locale text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT CASE WHEN p_locale IS NULL THEN '[]'::jsonb ELSE COALESCE(jsonb_agg(jsonb_build_object(
  'menuId',m.id,'sourceRevision',t.source_revision,'document',t.document) ORDER BY m.id),'[]'::jsonb) END
 FROM qr_codes q JOIN restaurants r ON r.id=q.restaurant_id
 JOIN organizations org ON org.id=r.organization_id JOIN menu_assignments a ON a.outlet_id=r.id
 JOIN menus m ON m.id=a.menu_id JOIN menu_translations t ON t.menu_id=m.id
  AND t.source_revision=m.published_revision AND t.locale=p_locale
 WHERE q.destination_token=p_token AND q.is_active AND r.is_active AND r.is_published
  AND org.is_active AND NOT m.archived
$$;
REVOKE ALL ON FUNCTION app_private.menu_translation_list(text),
 app_private.menu_translation_command(text,text,text,integer,integer,jsonb,text),
 app_private.public_menu_locales(text),app_private.public_menu_translations(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.menu_translation_list(text),
 app_private.menu_translation_command(text,text,text,integer,integer,jsonb,text),
 app_private.public_menu_locales(text),app_private.public_menu_translations(text,text) TO menuminute_app;

-- Commercial finance remains double-gated: operator data plus runtime provider configuration.
ALTER TABLE pos_finance_gates
 ADD COLUMN provider_enabled boolean NOT NULL DEFAULT false,
 ADD COLUMN document_delivery_enabled boolean NOT NULL DEFAULT false,
 ADD COLUMN jurisdiction_policy text NOT NULL DEFAULT 'non_registered_receipt_v1'
 CHECK(jurisdiction_policy IN ('non_registered_receipt_v1','registered_external_adapter_required_v1'));
ALTER TABLE pos_tenders DROP CONSTRAINT pos_tenders_method_check;
ALTER TABLE pos_tenders DROP CONSTRAINT pos_tenders_evidence_check;
ALTER TABLE pos_tenders ALTER COLUMN shift_id DROP NOT NULL;
ALTER TABLE pos_tenders ADD CONSTRAINT pos_tenders_method_check
 CHECK(method IN ('cash','card_external','upi_external','bank_external','stripe_checkout'));
ALTER TABLE pos_tenders ADD CONSTRAINT pos_tenders_evidence_check
 CHECK(evidence IN ('staff_recorded','provider_confirmed'));
ALTER TABLE pos_tenders ADD CONSTRAINT pos_tenders_provider_shape CHECK(
  (method='stripe_checkout' AND shift_id IS NULL AND evidence='provider_confirmed' AND reference IS NOT NULL)
  OR (method<>'stripe_checkout' AND shift_id IS NOT NULL AND evidence='staff_recorded')
 );
CREATE UNIQUE INDEX pos_provider_tender_reference ON pos_tenders(outlet_id,reference)
 WHERE method='stripe_checkout';
DROP INDEX pos_one_full_credit;
CREATE INDEX pos_credit_document_source ON pos_documents(outlet_id,source_document_id,issued_at);

CREATE TABLE pos_provider_attempts (
 id text PRIMARY KEY,organization_id text NOT NULL,outlet_id text NOT NULL,sale_id text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('checkout','refund')),
 state text NOT NULL CHECK(state IN ('preparing','pending','succeeded','failed','uncertain')),
 amount_minor bigint NOT NULL CHECK(amount_minor>0 AND amount_minor<=2147483647),
 currency text NOT NULL CHECK(length(currency)=3),request_key uuid NOT NULL,request_hash text NOT NULL,
 actor_id text NOT NULL REFERENCES users(id),external_id text,external_payment_id text,
 checkout_url text,expires_at timestamptz,credit_id text,error_code text,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,outlet_id) REFERENCES restaurants(organization_id,id),
 FOREIGN KEY(outlet_id,sale_id) REFERENCES pos_bills(outlet_id,sale_id),
 UNIQUE(outlet_id,request_key),UNIQUE(external_id)
);
CREATE INDEX pos_provider_attempt_scope ON pos_provider_attempts(outlet_id,sale_id,created_at DESC);
CREATE TABLE pos_provider_events (
 event_id text PRIMARY KEY,attempt_id text NOT NULL REFERENCES pos_provider_attempts(id),
 event_type text NOT NULL,received_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE pos_credit_groups (
 id text PRIMARY KEY,organization_id text NOT NULL,outlet_id text NOT NULL,sale_id text NOT NULL,
 state text NOT NULL CHECK(state IN ('staff_recorded','provider_pending','provider_confirmed','failed','uncertain')),
 amount_minor bigint NOT NULL CHECK(amount_minor>0 AND amount_minor<=2147483647),
 base_minor bigint NOT NULL CHECK(base_minor>=0),tax_minor bigint NOT NULL CHECK(tax_minor>=0),
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 5 AND 200),
 actor_id text NOT NULL REFERENCES users(id),provider_attempt_id text REFERENCES pos_provider_attempts(id),
 document_id text,created_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz,
 FOREIGN KEY(organization_id,outlet_id) REFERENCES restaurants(organization_id,id),
 FOREIGN KEY(outlet_id,sale_id) REFERENCES pos_bills(outlet_id,sale_id),
 UNIQUE(outlet_id,id)
);
CREATE TABLE pos_credit_lines (
 credit_id text NOT NULL REFERENCES pos_credit_groups(id),outlet_id text NOT NULL,sale_id text NOT NULL,
 line_id text NOT NULL,quantity integer NOT NULL CHECK(quantity>0),
 base_minor bigint NOT NULL CHECK(base_minor>=0),tax_minor bigint NOT NULL CHECK(tax_minor>=0),
 total_minor bigint NOT NULL CHECK(total_minor>0),
 PRIMARY KEY(credit_id,line_id),
 FOREIGN KEY(outlet_id,credit_id) REFERENCES pos_credit_groups(outlet_id,id),
 FOREIGN KEY(outlet_id,sale_id) REFERENCES pos_bills(outlet_id,sale_id)
);
CREATE TABLE pos_document_deliveries (
 id text PRIMARY KEY,organization_id text NOT NULL,outlet_id text NOT NULL,document_id text NOT NULL,
 request_key uuid NOT NULL,
 recipient_hash text NOT NULL CHECK(recipient_hash ~ '^[0-9a-f]{64}$'),
 state text NOT NULL CHECK(state IN ('pending','sending','sent','uncertain','failed')),
 attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count BETWEEN 0 AND 10),
 requested_by text NOT NULL REFERENCES users(id),last_error text,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),sent_at timestamptz,
 FOREIGN KEY(outlet_id,document_id) REFERENCES pos_documents(outlet_id,id),
 FOREIGN KEY(organization_id,outlet_id) REFERENCES restaurants(organization_id,id),
 UNIQUE(outlet_id,id),UNIQUE(outlet_id,request_key)
);
ALTER TABLE pos_provider_attempts ADD CONSTRAINT pos_provider_credit_fk
 FOREIGN KEY(outlet_id,credit_id) REFERENCES pos_credit_groups(outlet_id,id);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['pos_provider_attempts','pos_provider_events','pos_credit_groups','pos_credit_lines','pos_document_deliveries'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,menuminute_app,menuminute_worker',t);
 END LOOP;
END $$;
CREATE TRIGGER pos_provider_attempt_immutable_identity BEFORE DELETE ON pos_provider_attempts
 FOR EACH ROW EXECUTE FUNCTION app_private.pos_immutable_row();
CREATE TRIGGER pos_provider_event_immutable BEFORE UPDATE OR DELETE ON pos_provider_events
 FOR EACH ROW EXECUTE FUNCTION app_private.pos_immutable_row();
CREATE TRIGGER pos_credit_group_immutable BEFORE DELETE ON pos_credit_groups
 FOR EACH ROW EXECUTE FUNCTION app_private.pos_immutable_row();
CREATE TRIGGER pos_credit_line_immutable BEFORE UPDATE OR DELETE ON pos_credit_lines
 FOR EACH ROW EXECUTE FUNCTION app_private.pos_immutable_row();

-- Registered/fiscal documents stay fail-closed until a separately reviewed jurisdiction adapter exists.
CREATE FUNCTION app_private.pos_jurisdiction_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE policy text;
BEGIN
 IF NEW.kind='invoice' THEN
  SELECT jurisdiction_policy INTO policy FROM pos_finance_gates WHERE outlet_id=NEW.outlet_id;
  IF policy IS DISTINCT FROM 'registered_external_adapter_required_v1' THEN
   RAISE EXCEPTION 'Registered jurisdiction adapter required' USING ERRCODE='42501';
  END IF;
  -- The marker explicitly means an external statutory adapter must issue the invoice.
  -- MenuMinute cannot issue a generic invoice under this policy.
  RAISE EXCEPTION 'Registered jurisdiction adapter is not installed' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER pos_jurisdiction_before_document BEFORE INSERT ON pos_documents
 FOR EACH ROW EXECUTE FUNCTION app_private.pos_jurisdiction_guard();

CREATE OR REPLACE FUNCTION app_private.pos_finance_context(p_outlet text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE g pos_finance_gates%ROWTYPE;p pos_tax_profiles%ROWTYPE;
BEGIN
 IF NOT app_private.pos_access(p_outlet,'read') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO g FROM pos_finance_gates WHERE outlet_id=p_outlet;
 SELECT * INTO p FROM pos_tax_profiles WHERE outlet_id=p_outlet;
 RETURN jsonb_build_object('paymentsEnabled',COALESCE(g.payments_enabled,false),
 'documentsEnabled',COALESCE(g.documents_enabled,false),'fiscalApproved',COALESCE(g.fiscal_approved,false),
 'providerEnabled',COALESCE(g.provider_enabled,false),
 'documentDeliveryEnabled',COALESCE(g.document_delivery_enabled,false),
 'jurisdictionPolicy',COALESCE(g.jurisdiction_policy,'non_registered_receipt_v1'),
 'taxProfile',CASE WHEN p.outlet_id IS NULL THEN NULL ELSE jsonb_build_object('mode',p.mode,'inclusive',p.inclusive,
 'taxLabel',p.tax_label,'revision',p.revision,'classes',COALESCE(
 (SELECT jsonb_agg(jsonb_build_object('dishId',c.dish_id,'classification',c.classification,
 'rateBps',c.rate_bps) ORDER BY c.dish_id) FROM pos_tax_classes c WHERE c.outlet_id=p_outlet),'[]'::jsonb)) END,
 'canManage',app_private.pos_access(p_outlet,'configure'),'canCollect',app_private.pos_access(p_outlet,'collect'),
 'canRefund',app_private.pos_access(p_outlet,'refund'),'canIssue',app_private.pos_access(p_outlet,'document'));
END $$;

ALTER TABLE pos_finance_commands DROP CONSTRAINT pos_finance_commands_action_check;
ALTER TABLE pos_finance_commands ADD CONSTRAINT pos_finance_commands_action_check
 CHECK(action IN ('profile','freeze','open_shift','cash_move','tender','close_shift','issue','refund','partial_refund'));
ALTER TABLE pos_refunds ALTER COLUMN shift_id DROP NOT NULL;
ALTER TABLE pos_refunds ADD COLUMN evidence text NOT NULL DEFAULT 'staff_recorded'
 CHECK(evidence IN ('staff_recorded','provider_confirmed'));
ALTER TABLE pos_credit_groups DROP CONSTRAINT pos_credit_groups_state_check;
ALTER TABLE pos_credit_groups ADD CONSTRAINT pos_credit_groups_state_check
 CHECK(state IN ('prepared','staff_recorded','provider_pending','provider_confirmed','failed','uncertain'));
ALTER TABLE pos_credit_groups ADD CONSTRAINT pos_credit_document_fk
 FOREIGN KEY(outlet_id,document_id) REFERENCES pos_documents(outlet_id,id);

CREATE FUNCTION app_private.pos_provider_checkout_prepare(
 p_outlet text,p_key uuid,p_hash text,p_sale text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE r restaurants%ROWTYPE;g pos_finance_gates%ROWTYPE;s pos_sales%ROWTYPE;b pos_bills%ROWTYPE;
 a pos_provider_attempts%ROWTYPE;actor text:=NULLIF(current_setting('app.actor_id',true),'');
 paid bigint;due bigint;attempt_id text;
BEGIN
 IF actor IS NULL OR NOT app_private.pos_access(p_outlet,'collect') THEN
  RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
 END IF;
 SELECT * INTO r FROM restaurants WHERE id=p_outlet;
 SELECT * INTO g FROM pos_finance_gates WHERE outlet_id=p_outlet;
 IF NOT COALESCE(g.payments_enabled,false) OR NOT COALESCE(g.provider_enabled,false) OR
  NOT EXISTS(SELECT 1 FROM pos_outlet_settings WHERE outlet_id=p_outlet AND enabled) THEN
  RAISE EXCEPTION 'Provider release gate is closed' USING ERRCODE='42501';
 END IF;
 IF p_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Invalid request hash' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('provider:'||p_outlet||':'||p_key::text,0));
 SELECT * INTO a FROM pos_provider_attempts WHERE outlet_id=p_outlet AND request_key=p_key;
 IF FOUND THEN
  IF a.request_hash<>p_hash OR a.sale_id<>p_sale OR a.kind<>'checkout' OR a.actor_id<>actor THEN
   RAISE EXCEPTION 'Key conflict' USING ERRCODE='40001';
  END IF;
  RETURN jsonb_build_object('attemptId',a.id,'saleId',a.sale_id,'amountMinor',a.amount_minor::text,
   'currency',a.currency,'state',a.state,'checkoutUrl',a.checkout_url,
   'externalId',a.external_id,'expiresAt',a.expires_at,'duplicate',true);
 END IF;
 SELECT * INTO s FROM pos_sales WHERE outlet_id=p_outlet AND id=p_sale FOR UPDATE;
 SELECT * INTO b FROM pos_bills WHERE outlet_id=p_outlet AND sale_id=p_sale;
 IF s.id IS NULL OR b.sale_id IS NULL OR NOT EXISTS(SELECT 1 FROM orders WHERE id=s.order_id
   AND restaurant_id=p_outlet AND status IN ('accepted','preparing','ready','served','collected')) THEN
  RAISE EXCEPTION 'Accepted frozen sale required' USING ERRCODE='22023';
 END IF;
 SELECT COALESCE(sum(amount_minor),0) INTO paid FROM pos_tenders WHERE outlet_id=p_outlet AND sale_id=p_sale;
 due:=b.total_minor-paid;
 IF due<=0 THEN RAISE EXCEPTION 'Sale has no outstanding balance' USING ERRCODE='40001'; END IF;
 IF EXISTS(SELECT 1 FROM pos_provider_attempts WHERE outlet_id=p_outlet AND sale_id=p_sale
  AND kind='checkout' AND state IN ('preparing','pending','uncertain')) THEN
  RAISE EXCEPTION 'Another provider attempt needs reconciliation' USING ERRCODE='40001';
 END IF;
 attempt_id:='pay-'||gen_random_uuid()::text;
 INSERT INTO pos_provider_attempts(id,organization_id,outlet_id,sale_id,kind,state,amount_minor,currency,
  request_key,request_hash,actor_id)
 VALUES(attempt_id,r.organization_id,p_outlet,p_sale,'checkout','preparing',due,b.currency,p_key,p_hash,actor);
 INSERT INTO domain_audit(id,organization_id,actor_id,action,details)
 VALUES(gen_random_uuid()::text,r.organization_id,actor,'pos.provider.checkout.prepared',
  jsonb_build_object('outletId',p_outlet,'saleId',p_sale,'attemptId',attempt_id,'amountMinor',due::text));
 RETURN jsonb_build_object('attemptId',attempt_id,'saleId',p_sale,'orderId',s.order_id,
  'amountMinor',due::text,'currency',b.currency,'state','preparing');
END $$;

CREATE FUNCTION app_private.pos_provider_attempt_result(
 p_outlet text,p_attempt text,p_state text,p_external text,p_payment text,p_url text,p_expires timestamptz
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE a pos_provider_attempts%ROWTYPE;actor text:=NULLIF(current_setting('app.actor_id',true),'');
BEGIN
 IF actor IS NULL OR NOT app_private.pos_access(p_outlet,CASE WHEN p_state IN ('pending','uncertain','failed') THEN 'collect' ELSE '' END) THEN
  RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
 END IF;
 SELECT * INTO a FROM pos_provider_attempts WHERE outlet_id=p_outlet AND id=p_attempt FOR UPDATE;
 IF NOT FOUND OR a.actor_id<>actor OR a.kind<>'checkout' THEN RAISE EXCEPTION 'Attempt unavailable' USING ERRCODE='42501'; END IF;
 IF a.state IN ('succeeded','failed') THEN
  RETURN jsonb_build_object('attemptId',a.id,'state',a.state,'checkoutUrl',a.checkout_url,'duplicate',true);
 END IF;
 IF p_state='pending' THEN
  IF p_external !~ '^cs_(test|live)_[A-Za-z0-9]+$' OR p_url !~ '^https://checkout\.stripe\.com/' THEN
   RAISE EXCEPTION 'Invalid provider response' USING ERRCODE='22023';
  END IF;
  IF a.external_id IS NOT NULL AND a.external_id<>p_external THEN
   RAISE EXCEPTION 'Provider identity conflict' USING ERRCODE='40001';
  END IF;
  UPDATE pos_provider_attempts SET state='pending',external_id=p_external,
   external_payment_id=COALESCE(p_payment,external_payment_id),checkout_url=p_url,
   expires_at=p_expires,error_code=NULL,updated_at=now() WHERE id=a.id;
 ELSE
  UPDATE pos_provider_attempts SET state=p_state,error_code=CASE p_state WHEN 'uncertain' THEN 'provider_uncertain'
   ELSE 'provider_rejected' END,updated_at=now() WHERE id=a.id;
 END IF;
 RETURN jsonb_build_object('attemptId',a.id,'state',p_state,'checkoutUrl',p_url,'externalId',p_external,'expiresAt',p_expires);
END $$;

CREATE FUNCTION app_private.pos_finalize_credit(p_credit text,p_evidence text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE c pos_credit_groups%ROWTYPE;s pos_sales%ROWTYPE;b pos_bills%ROWTYPE;original pos_documents%ROWTYPE;
 r restaurants%ROWTYPE;year integer;serial integer;document_no text;document_id text;result jsonb;
 total_refunded bigint;
BEGIN
 SELECT * INTO c FROM pos_credit_groups WHERE id=p_credit FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Credit unavailable' USING ERRCODE='22023'; END IF;
 IF c.document_id IS NOT NULL THEN
  RETURN jsonb_build_object('creditId',c.id,'documentId',c.document_id,'state',c.state,'duplicate',true);
 END IF;
 IF p_evidence NOT IN ('staff_recorded','provider_confirmed') THEN
  RAISE EXCEPTION 'Invalid credit evidence' USING ERRCODE='22023';
 END IF;
 SELECT * INTO s FROM pos_sales WHERE id=c.sale_id AND outlet_id=c.outlet_id;
 SELECT * INTO b FROM pos_bills WHERE sale_id=c.sale_id AND outlet_id=c.outlet_id;
 SELECT * INTO original FROM pos_documents WHERE sale_id=c.sale_id AND outlet_id=c.outlet_id
  AND kind IN ('receipt','invoice');
 SELECT * INTO r FROM restaurants WHERE id=c.outlet_id;
 IF s.id IS NULL OR b.sale_id IS NULL OR original.id IS NULL THEN
  RAISE EXCEPTION 'Issued source document required' USING ERRCODE='22023';
 END IF;
 year:=extract(year FROM clock_timestamp() AT TIME ZONE r.timezone)::integer;
 INSERT INTO pos_document_sequences(outlet_id,fiscal_year,kind,last_number)
 VALUES(c.outlet_id,year,'credit_note',1) ON CONFLICT(outlet_id,fiscal_year,kind) DO UPDATE
 SET last_number=pos_document_sequences.last_number+1 RETURNING last_number INTO serial;
 document_no:='CREDIT-'||year::text||'-'||lpad(serial::text,6,'0');
 document_id:='doc-'||gen_random_uuid()::text;
 INSERT INTO pos_documents(id,organization_id,outlet_id,sale_id,kind,fiscal_year,serial,
  document_number,source_document_id,snapshot,issued_by)
 VALUES(document_id,c.organization_id,c.outlet_id,c.sale_id,'credit_note',year,serial,document_no,
  original.id,jsonb_build_object('reverses',original.document_number,'reason',c.reason,
  'creditLines',COALESCE((SELECT jsonb_agg(jsonb_build_object('lineId',line_id,'quantity',quantity,
    'baseMinor',base_minor::text,'taxMinor',tax_minor::text,'totalMinor',total_minor::text)
    ORDER BY line_id) FROM pos_credit_lines WHERE credit_id=c.id),'[]'::jsonb),
  'baseMinor',c.base_minor::text,'taxMinor',c.tax_minor::text,'totalMinor',c.amount_minor::text,
  'currency',b.currency,'evidence',p_evidence,
  'legalStatus','merchant_credit_document_review_required'),c.actor_id);
 UPDATE pos_credit_groups SET state=CASE p_evidence WHEN 'provider_confirmed' THEN 'provider_confirmed'
  ELSE 'staff_recorded' END,document_id=document_id,completed_at=now() WHERE id=c.id;
 SELECT COALESCE(sum(amount_minor),0) INTO total_refunded FROM pos_refunds
  WHERE outlet_id=c.outlet_id AND sale_id=c.sale_id;
 IF total_refunded=b.total_minor THEN
  UPDATE orders SET payment_status='voided',version=version+1,updated_at=clock_timestamp()
  WHERE id=s.order_id AND restaurant_id=c.outlet_id AND payment_status='paid';
 END IF;
 result:=jsonb_build_object('creditId',c.id,'documentId',document_id,'documentNumber',document_no,
  'kind','credit_note','refundedMinor',c.amount_minor::text,
  'state',CASE p_evidence WHEN 'provider_confirmed' THEN 'provider_confirmed' ELSE 'staff_recorded' END);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION app_private.pos_finalize_credit(text,text) FROM PUBLIC,menuminute_app,menuminute_worker;

CREATE FUNCTION app_private.pos_partial_refund_prepare(
 p_outlet text,p_key text,p_hash text,p_data jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE r restaurants%ROWTYPE;g pos_finance_gates%ROWTYPE;s pos_sales%ROWTYPE;b pos_bills%ROWTYPE;
 original pos_documents%ROWTYPE;shift pos_shifts%ROWTYPE;prior pos_finance_commands%ROWTYPE;
 actor text:=NULLIF(current_setting('app.actor_id',true),'');cmd jsonb;result jsonb;
 credit_id text;attempt_id text;entry jsonb;source_line jsonb;line_id text;q integer;original_q integer;
 prior_q integer;base_amount bigint;tax_amount bigint;total_amount bigint;
 sum_base bigint:=0;sum_tax bigint:=0;sum_total bigint:=0;remaining bigint;available bigint;
 tender pos_tenders%ROWTYPE;payment_id text;mode text;refund_id text;
BEGIN
 IF actor IS NULL OR NOT app_private.pos_access(p_outlet,'refund') THEN
  RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
 END IF;
 SELECT * INTO r FROM restaurants WHERE id=p_outlet;
 SELECT * INTO g FROM pos_finance_gates WHERE outlet_id=p_outlet;
 IF NOT COALESCE(g.documents_enabled,false) OR NOT COALESCE(g.payments_enabled,false) THEN
  RAISE EXCEPTION 'Finance release gate is closed' USING ERRCODE='42501';
 END IF;
 IF p_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR
  p_hash !~ '^[0-9a-f]{64}$' OR jsonb_typeof(p_data)<>'object' OR
  jsonb_typeof(p_data->'lines')<>'array' OR jsonb_array_length(p_data->'lines') NOT BETWEEN 1 AND 100 OR
  length(btrim(COALESCE(p_data->>'reason',''))) NOT BETWEEN 5 AND 200 OR
  p_data->>'mode' NOT IN ('staff_attested','stripe') THEN
  RAISE EXCEPTION 'Invalid partial refund' USING ERRCODE='22023';
 END IF;
 cmd:=jsonb_build_object('action','partial_refund','outletId',p_outlet,'data',p_data);
 PERFORM pg_advisory_xact_lock(hashtextextended('finance:'||p_outlet||':'||p_key,0));
 SELECT * INTO prior FROM pos_finance_commands WHERE outlet_id=p_outlet AND request_key=p_key;
 IF FOUND THEN
  IF prior.actor_id<>actor OR prior.request_hash<>p_hash OR prior.action<>'partial_refund' THEN
   RAISE EXCEPTION 'Key conflict' USING ERRCODE='40001';
  END IF;
  RETURN prior.result||jsonb_build_object('duplicate',true);
 END IF;
 SELECT * INTO s FROM pos_sales WHERE id=p_data->>'saleId' AND outlet_id=p_outlet FOR UPDATE;
 SELECT * INTO b FROM pos_bills WHERE sale_id=s.id AND outlet_id=p_outlet;
 SELECT * INTO original FROM pos_documents WHERE outlet_id=p_outlet AND sale_id=s.id
  AND kind IN ('receipt','invoice');
 IF s.id IS NULL OR b.sale_id IS NULL OR original.id IS NULL THEN
  RAISE EXCEPTION 'Issued frozen sale required' USING ERRCODE='22023';
 END IF;
 IF (SELECT count(DISTINCT value->>'lineId') FROM jsonb_array_elements(p_data->'lines'))<>
    jsonb_array_length(p_data->'lines') THEN
  RAISE EXCEPTION 'Duplicate refund line' USING ERRCODE='22023';
 END IF;
 mode:=p_data->>'mode';credit_id:='credit-'||gen_random_uuid()::text;
 INSERT INTO pos_credit_groups(id,organization_id,outlet_id,sale_id,state,amount_minor,base_minor,
  tax_minor,reason,actor_id)
 VALUES(credit_id,r.organization_id,p_outlet,s.id,'prepared',1,0,0,btrim(p_data->>'reason'),actor);
 FOR entry IN SELECT value FROM jsonb_array_elements(p_data->'lines') LOOP
  line_id:=entry->>'lineId';q:=(entry->>'quantity')::integer;
  SELECT value INTO source_line FROM jsonb_array_elements(b.line_snapshot) WHERE value->>'id'=line_id;
  IF source_line IS NULL OR q<=0 THEN RAISE EXCEPTION 'Unknown refund line' USING ERRCODE='22023'; END IF;
  original_q:=(source_line->>'quantity')::integer;
  SELECT COALESCE(sum(l.quantity),0) INTO prior_q FROM pos_credit_lines l
   JOIN pos_credit_groups c ON c.id=l.credit_id
   WHERE l.outlet_id=p_outlet AND l.sale_id=s.id AND l.line_id=line_id AND c.state<>'failed';
  IF prior_q+q>original_q THEN RAISE EXCEPTION 'Refund quantity exceeds original line' USING ERRCODE='40001'; END IF;
  base_amount:=floor((source_line->>'baseMinor')::numeric*(prior_q+q)/original_q+0.5)::bigint-
   floor((source_line->>'baseMinor')::numeric*prior_q/original_q+0.5)::bigint;
  tax_amount:=floor((source_line->>'taxMinor')::numeric*(prior_q+q)/original_q+0.5)::bigint-
   floor((source_line->>'taxMinor')::numeric*prior_q/original_q+0.5)::bigint;
  total_amount:=floor((source_line->>'totalMinor')::numeric*(prior_q+q)/original_q+0.5)::bigint-
   floor((source_line->>'totalMinor')::numeric*prior_q/original_q+0.5)::bigint;
  IF total_amount<=0 OR base_amount+tax_amount<>total_amount THEN
   RAISE EXCEPTION 'Credit allocation cannot be reconciled' USING ERRCODE='22023';
  END IF;
  INSERT INTO pos_credit_lines(credit_id,outlet_id,sale_id,line_id,quantity,base_minor,tax_minor,total_minor)
  VALUES(credit_id,p_outlet,s.id,line_id,q,base_amount,tax_amount,total_amount);
  sum_base:=sum_base+base_amount;sum_tax:=sum_tax+tax_amount;sum_total:=sum_total+total_amount;
 END LOOP;
 IF sum_total<=0 OR sum_total>COALESCE((SELECT sum(t.amount_minor) FROM pos_tenders t WHERE t.sale_id=s.id),0)-
  COALESCE((SELECT sum(f.amount_minor) FROM pos_refunds f WHERE f.sale_id=s.id),0) THEN
  RAISE EXCEPTION 'Refund exceeds captured balance' USING ERRCODE='40001';
 END IF;
 UPDATE pos_credit_groups SET amount_minor=sum_total,base_minor=sum_base,tax_minor=sum_tax WHERE id=credit_id;
 IF mode='staff_attested' THEN
  SELECT * INTO shift FROM pos_shifts WHERE id=p_data->>'shiftId' AND outlet_id=p_outlet FOR UPDATE;
  IF shift.id IS NULL OR shift.state<>'open' OR shift.currency<>b.currency OR
    (EXISTS(SELECT 1 FROM pos_tenders WHERE sale_id=s.id AND method='stripe_checkout') OR
     EXISTS(SELECT 1 FROM pos_tenders WHERE sale_id=s.id AND method<>'cash') AND
       p_data->>'externalRefundAttested' IS DISTINCT FROM 'true') THEN
   RAISE EXCEPTION 'Open shift and valid external reversal attestation required' USING ERRCODE='22023';
  END IF;
  remaining:=sum_total;
  FOR tender IN SELECT * FROM pos_tenders WHERE outlet_id=p_outlet AND sale_id=s.id ORDER BY created_at,id LOOP
   SELECT tender.amount_minor-COALESCE(sum(amount_minor),0) INTO available
   FROM pos_refunds WHERE tender_id=tender.id;
   available:=LEAST(available,remaining);
   IF available>0 THEN
    refund_id:='refund-'||gen_random_uuid()::text;
    INSERT INTO pos_refunds(id,organization_id,outlet_id,sale_id,tender_id,shift_id,amount_minor,
     reason,actor_id,evidence)
    VALUES(refund_id,r.organization_id,p_outlet,s.id,tender.id,shift.id,available,
     btrim(p_data->>'reason'),actor,'staff_recorded');
    remaining:=remaining-available;
   END IF;
   EXIT WHEN remaining=0;
  END LOOP;
  IF remaining<>0 THEN RAISE EXCEPTION 'Refund allocation conflict' USING ERRCODE='40001'; END IF;
  result:=app_private.pos_finalize_credit(credit_id,'staff_recorded');
 ELSE
  IF NOT COALESCE(g.provider_enabled,false) THEN RAISE EXCEPTION 'Provider gate closed' USING ERRCODE='42501'; END IF;
  SELECT external_payment_id INTO payment_id FROM pos_provider_attempts
   WHERE outlet_id=p_outlet AND sale_id=s.id AND kind='checkout' AND state='succeeded'
   ORDER BY updated_at DESC,created_at DESC LIMIT 1;
  IF payment_id IS NULL THEN RAISE EXCEPTION 'Provider-confirmed collection required' USING ERRCODE='22023'; END IF;
  attempt_id:='refund-pay-'||gen_random_uuid()::text;
  INSERT INTO pos_provider_attempts(id,organization_id,outlet_id,sale_id,kind,state,amount_minor,currency,
   request_key,request_hash,actor_id,external_payment_id,credit_id)
  VALUES(attempt_id,r.organization_id,p_outlet,s.id,'refund','preparing',sum_total,b.currency,
   p_key::uuid,p_hash,actor,payment_id,credit_id);
  UPDATE pos_credit_groups SET state='provider_pending',provider_attempt_id=attempt_id WHERE id=credit_id;
  result:=jsonb_build_object('creditId',credit_id,'attemptId',attempt_id,'saleId',s.id,
   'amountMinor',sum_total::text,'currency',b.currency,'externalPaymentId',payment_id,'state','preparing');
 END IF;
 INSERT INTO pos_finance_commands(organization_id,outlet_id,request_key,request_hash,action,result,actor_id)
 VALUES(r.organization_id,p_outlet,p_key,p_hash,'partial_refund',result,actor);
 INSERT INTO domain_audit(id,organization_id,actor_id,action,details)
 VALUES(gen_random_uuid()::text,r.organization_id,actor,'pos.finance.partial_refund',
  jsonb_build_object('outletId',p_outlet,'saleId',s.id,'creditId',credit_id,'amountMinor',sum_total::text,'mode',mode));
 RETURN result;
END $$;

CREATE FUNCTION app_private.pos_provider_attempt_external_result(
 p_outlet text,p_attempt text,p_state text,p_external text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE a pos_provider_attempts%ROWTYPE;actor text:=NULLIF(current_setting('app.actor_id',true),'');
BEGIN
 SELECT * INTO a FROM pos_provider_attempts WHERE outlet_id=p_outlet AND id=p_attempt FOR UPDATE;
 IF NOT FOUND OR actor IS NULL OR a.actor_id<>actor OR a.kind<>'refund' OR
  NOT app_private.pos_access(p_outlet,'refund') THEN RAISE EXCEPTION 'Attempt unavailable' USING ERRCODE='42501'; END IF;
 IF p_state NOT IN ('pending','succeeded','failed','uncertain') OR
  (p_state IN ('pending','succeeded') AND p_external !~ '^re_[A-Za-z0-9]+$') THEN
  RAISE EXCEPTION 'Invalid provider result' USING ERRCODE='22023';
 END IF;
 IF a.external_id IS NOT NULL AND a.external_id<>p_external THEN
  RAISE EXCEPTION 'Provider identity conflict' USING ERRCODE='40001';
 END IF;
 UPDATE pos_provider_attempts SET external_id=COALESCE(p_external,external_id),state=CASE WHEN p_state='succeeded' THEN 'pending'
  ELSE p_state END,error_code=CASE WHEN p_state='failed' THEN 'provider_rejected' ELSE NULL END,
  updated_at=now() WHERE id=a.id;
 RETURN jsonb_build_object('attemptId',a.id,'externalId',p_external,'state',
  CASE WHEN p_state='succeeded' THEN 'pending_confirmation' ELSE p_state END);
END $$;

CREATE FUNCTION app_private.pos_provider_event(
 p_event text,p_type text,p_attempt text,p_external text,p_payment text,
 p_amount bigint,p_currency text,p_state text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE a pos_provider_attempts%ROWTYPE;b pos_bills%ROWTYPE;s pos_sales%ROWTYPE;t pos_tenders%ROWTYPE;
 c pos_credit_groups%ROWTYPE;existing pos_provider_events%ROWTYPE;paid bigint;available bigint;result jsonb;
BEGIN
 IF length(p_event) NOT BETWEEN 3 AND 255 OR p_type NOT IN ('checkout.completed','checkout.failed','refund.updated')
  OR p_state NOT IN ('pending','succeeded','failed') OR p_amount<=0 OR length(p_currency)<>3 THEN
  RAISE EXCEPTION 'Invalid provider event' USING ERRCODE='22023';
 END IF;
 SELECT * INTO existing FROM pos_provider_events WHERE event_id=p_event;
 IF FOUND THEN RETURN jsonb_build_object('accepted',true,'duplicate',true,'attemptId',existing.attempt_id); END IF;
 SELECT * INTO a FROM pos_provider_attempts WHERE id=p_attempt FOR UPDATE;
 IF NOT FOUND OR a.amount_minor<>p_amount OR lower(a.currency)<>lower(p_currency) OR
  (a.external_id IS NOT NULL AND a.external_id<>p_external) OR
  (a.external_payment_id IS NOT NULL AND p_payment IS NOT NULL AND a.external_payment_id<>p_payment) THEN
  RAISE EXCEPTION 'Provider event does not match attempt' USING ERRCODE='22023';
 END IF;
 IF (a.kind='checkout' AND p_type NOT LIKE 'checkout.%') OR
    (a.kind='refund' AND p_type<>'refund.updated') THEN
  RAISE EXCEPTION 'Provider event kind mismatch' USING ERRCODE='22023';
 END IF;
 INSERT INTO pos_provider_events(event_id,attempt_id,event_type) VALUES(p_event,a.id,p_type)
 ON CONFLICT(event_id) DO NOTHING;
 IF NOT FOUND THEN
  SELECT * INTO existing FROM pos_provider_events WHERE event_id=p_event;
  RETURN jsonb_build_object('accepted',true,'duplicate',true,'attemptId',existing.attempt_id);
 END IF;
 UPDATE pos_provider_attempts SET external_id=COALESCE(external_id,p_external),
  external_payment_id=COALESCE(external_payment_id,p_payment),state=p_state,
  error_code=CASE WHEN p_state='failed' THEN 'provider_failed' ELSE NULL END,updated_at=now()
  WHERE id=a.id;
 IF p_state='pending' THEN RETURN jsonb_build_object('accepted',true,'attemptId',a.id,'state','pending'); END IF;
 IF p_state='failed' THEN
  IF a.kind='refund' THEN UPDATE pos_credit_groups SET state='failed',completed_at=now()
   WHERE id=a.credit_id AND state IN ('prepared','provider_pending','uncertain'); END IF;
  RETURN jsonb_build_object('accepted',true,'attemptId',a.id,'state','failed');
 END IF;
 SELECT * INTO b FROM pos_bills WHERE outlet_id=a.outlet_id AND sale_id=a.sale_id;
 SELECT * INTO s FROM pos_sales WHERE outlet_id=a.outlet_id AND id=a.sale_id;
 IF a.kind='checkout' THEN
  IF p_payment IS NULL OR p_external !~ '^cs_(test|live)_[A-Za-z0-9]+$' THEN
   RAISE EXCEPTION 'Confirmed checkout identity required' USING ERRCODE='22023';
  END IF;
  SELECT * INTO t FROM pos_tenders WHERE outlet_id=a.outlet_id AND reference=p_payment;
  IF NOT FOUND THEN
   INSERT INTO pos_tenders(id,organization_id,outlet_id,sale_id,shift_id,method,amount_minor,
    tendered_minor,change_minor,reference,evidence,actor_id)
   VALUES('tender-'||gen_random_uuid()::text,a.organization_id,a.outlet_id,a.sale_id,NULL,
    'stripe_checkout',a.amount_minor,a.amount_minor,0,p_payment,'provider_confirmed',a.actor_id);
  ELSIF t.sale_id<>a.sale_id OR t.amount_minor<>a.amount_minor THEN
   RAISE EXCEPTION 'Provider settlement conflict' USING ERRCODE='40001';
  END IF;
  SELECT COALESCE(sum(amount_minor),0) INTO paid FROM pos_tenders
   WHERE outlet_id=a.outlet_id AND sale_id=a.sale_id;
  IF paid>b.total_minor THEN RAISE EXCEPTION 'Provider settlement exceeds bill' USING ERRCODE='40001'; END IF;
  IF paid=b.total_minor THEN
   UPDATE orders SET payment_status='paid',version=version+1,updated_at=clock_timestamp()
   WHERE id=s.order_id AND restaurant_id=a.outlet_id AND payment_status='unpaid';
  END IF;
  result:=jsonb_build_object('accepted',true,'attemptId',a.id,'state','succeeded',
   'saleId',a.sale_id,'paymentStatus',CASE WHEN paid=b.total_minor THEN 'paid' ELSE 'partial' END);
 ELSE
  IF p_payment IS NULL OR p_external !~ '^re_[A-Za-z0-9]+$' OR a.credit_id IS NULL THEN
   RAISE EXCEPTION 'Confirmed refund identity required' USING ERRCODE='22023';
  END IF;
  SELECT * INTO c FROM pos_credit_groups WHERE id=a.credit_id FOR UPDATE;
  SELECT * INTO t FROM pos_tenders WHERE outlet_id=a.outlet_id AND sale_id=a.sale_id
   AND method='stripe_checkout' AND reference=p_payment;
  IF t.id IS NULL OR c.id IS NULL THEN RAISE EXCEPTION 'Captured provider tender required' USING ERRCODE='22023'; END IF;
  SELECT t.amount_minor-COALESCE(sum(amount_minor),0) INTO available FROM pos_refunds WHERE tender_id=t.id;
  IF available<a.amount_minor THEN RAISE EXCEPTION 'Provider refund exceeds capture' USING ERRCODE='40001'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pos_refunds WHERE outlet_id=a.outlet_id AND sale_id=a.sale_id
    AND tender_id=t.id AND evidence='provider_confirmed' AND amount_minor=a.amount_minor AND reason=c.reason) THEN
   INSERT INTO pos_refunds(id,organization_id,outlet_id,sale_id,tender_id,shift_id,amount_minor,
    reason,actor_id,evidence)
   VALUES('refund-'||gen_random_uuid()::text,a.organization_id,a.outlet_id,a.sale_id,t.id,NULL,
    a.amount_minor,c.reason,a.actor_id,'provider_confirmed');
  END IF;
  result:=app_private.pos_finalize_credit(c.id,'provider_confirmed')||
   jsonb_build_object('accepted',true,'attemptId',a.id,'state','succeeded');
 END IF;
 INSERT INTO domain_audit(id,organization_id,actor_id,action,details)
 VALUES(gen_random_uuid()::text,a.organization_id,a.actor_id,'pos.provider.'||a.kind||'.succeeded',
  jsonb_build_object('outletId',a.outlet_id,'saleId',a.sale_id,'attemptId',a.id,'amountMinor',a.amount_minor::text));
 INSERT INTO outbox_events(id,organization_id,outlet_id,type,schema_version,aggregate_version,payload)
 VALUES(gen_random_uuid()::text,a.organization_id,a.outlet_id,'pos.provider.'||a.kind||'.succeeded',1,1,
  jsonb_build_object('outletId',a.outlet_id,'saleId',a.sale_id,'attemptId',a.id));
 RETURN result;
END $$;

REVOKE ALL ON FUNCTION app_private.pos_provider_checkout_prepare(text,uuid,text,text),
 app_private.pos_provider_attempt_result(text,text,text,text,text,text,timestamptz),
 app_private.pos_partial_refund_prepare(text,text,text,jsonb),
 app_private.pos_provider_attempt_external_result(text,text,text,text),
 app_private.pos_provider_event(text,text,text,text,text,bigint,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.pos_provider_checkout_prepare(text,uuid,text,text),
 app_private.pos_provider_attempt_result(text,text,text,text,text,text,timestamptz),
 app_private.pos_partial_refund_prepare(text,text,text,jsonb),
 app_private.pos_provider_attempt_external_result(text,text,text,text),
 app_private.pos_provider_event(text,text,text,text,text,bigint,text,text) TO menuminute_app;

CREATE FUNCTION app_private.pos_document_delivery_prepare(
 p_outlet text,p_document text,p_key uuid,p_recipient_hash text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE d pos_documents%ROWTYPE;g pos_finance_gates%ROWTYPE;r restaurants%ROWTYPE;
 prior pos_document_deliveries%ROWTYPE;delivery_id text;actor text:=NULLIF(current_setting('app.actor_id',true),'');
BEGIN
 IF actor IS NULL OR NOT app_private.pos_access(p_outlet,'document') OR
  p_recipient_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO g FROM pos_finance_gates WHERE outlet_id=p_outlet;
 IF NOT COALESCE(g.documents_enabled,false) OR NOT COALESCE(g.document_delivery_enabled,false) THEN
  RAISE EXCEPTION 'Document delivery gate is closed' USING ERRCODE='42501';
 END IF;
 SELECT * INTO prior FROM pos_document_deliveries WHERE outlet_id=p_outlet AND request_key=p_key;
 IF FOUND THEN
  IF prior.document_id<>p_document OR prior.recipient_hash<>p_recipient_hash OR prior.requested_by<>actor THEN
   RAISE EXCEPTION 'Key conflict' USING ERRCODE='40001';
  END IF;
  RETURN jsonb_build_object('deliveryId',prior.id,'state',prior.state,'duplicate',true);
 END IF;
 SELECT * INTO d FROM pos_documents WHERE outlet_id=p_outlet AND id=p_document;
 SELECT * INTO r FROM restaurants WHERE id=p_outlet;
 IF NOT FOUND OR d.id IS NULL THEN RAISE EXCEPTION 'Document unavailable' USING ERRCODE='22023'; END IF;
 delivery_id:='delivery-'||gen_random_uuid()::text;
 INSERT INTO pos_document_deliveries(id,organization_id,outlet_id,document_id,request_key,recipient_hash,state,requested_by)
 VALUES(delivery_id,r.organization_id,p_outlet,p_document,p_key,p_recipient_hash,'pending',actor);
 RETURN jsonb_build_object('deliveryId',delivery_id,'state','pending','documentNumber',d.document_number,
  'kind',d.kind,'snapshot',d.snapshot);
END $$;
CREATE FUNCTION app_private.pos_document_delivery_result(
 p_outlet text,p_delivery text,p_state text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE d pos_document_deliveries%ROWTYPE;actor text:=NULLIF(current_setting('app.actor_id',true),'');
BEGIN
 IF p_state NOT IN ('sent','uncertain','failed') THEN RAISE EXCEPTION 'Invalid delivery state' USING ERRCODE='22023'; END IF;
 SELECT * INTO d FROM pos_document_deliveries WHERE outlet_id=p_outlet AND id=p_delivery FOR UPDATE;
 IF NOT FOUND OR actor IS NULL OR d.requested_by<>actor OR NOT app_private.pos_access(p_outlet,'document') THEN
  RAISE EXCEPTION 'Delivery unavailable' USING ERRCODE='42501';
 END IF;
 IF d.state='sent' THEN RETURN jsonb_build_object('deliveryId',d.id,'state','sent','duplicate',true); END IF;
 UPDATE pos_document_deliveries SET state=p_state,attempt_count=attempt_count+1,
  last_error=CASE WHEN p_state='sent' THEN NULL WHEN p_state='uncertain' THEN 'delivery_uncertain' ELSE 'delivery_failed' END,
  sent_at=CASE WHEN p_state='sent' THEN now() ELSE sent_at END,updated_at=now() WHERE id=d.id;
 INSERT INTO domain_audit(id,organization_id,actor_id,action,details)
 VALUES(gen_random_uuid()::text,d.organization_id,actor,'pos.document.delivery.'||p_state,
  jsonb_build_object('outletId',p_outlet,'documentId',d.document_id,'deliveryId',d.id));
 RETURN jsonb_build_object('deliveryId',d.id,'state',p_state);
END $$;
REVOKE ALL ON FUNCTION app_private.pos_document_delivery_prepare(text,text,uuid,text),
 app_private.pos_document_delivery_result(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.pos_document_delivery_prepare(text,text,uuid,text),
 app_private.pos_document_delivery_result(text,text,text) TO menuminute_app;

-- Surface provider and delivery state in the operational views. These remain bounded to
-- the same 500 most-recent bills as the pre-existing reconciliation endpoint.
CREATE OR REPLACE FUNCTION app_private.pos_sale_detail(p_outlet text,p_sale text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE s pos_sales%ROWTYPE;b pos_bills%ROWTYPE;
BEGIN
 IF NOT app_private.pos_access(p_outlet,'ledger') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM pos_sales WHERE outlet_id=p_outlet AND id=p_sale;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sale unavailable' USING ERRCODE='22023'; END IF;
 SELECT * INTO b FROM pos_bills WHERE sale_id=s.id AND outlet_id=p_outlet;
 RETURN jsonb_build_object('saleId',s.id,'orderId',s.order_id,'currency',s.currency,
  'subtotalMinor',s.subtotal_minor::text,
  'bill',CASE WHEN b.sale_id IS NULL THEN NULL ELSE jsonb_build_object('totalMinor',b.total_minor::text,
   'subtotalMinor',b.subtotal_minor::text,'taxMinor',b.tax_minor::text,'taxableBaseMinor',b.taxable_base_minor::text,
   'seller',b.seller_snapshot,'customer',b.customer_snapshot,'lines',b.line_snapshot,'taxMode',b.tax_mode,
   'taxProfileRevision',b.tax_profile_revision) END,
  'tenders',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',t.id,'method',t.method,'amountMinor',t.amount_minor::text,
   'changeMinor',t.change_minor::text,'reference',t.reference,'evidence',t.evidence,'shiftId',t.shift_id,'createdAt',t.created_at)
   ORDER BY t.created_at,t.id) FROM pos_tenders t WHERE t.outlet_id=p_outlet AND t.sale_id=s.id),'[]'::jsonb),
  'refunds',COALESCE((SELECT jsonb_agg(jsonb_build_object('tenderId',f.tender_id,'amountMinor',f.amount_minor::text,
   'reason',f.reason,'evidence',f.evidence,'createdAt',f.created_at) ORDER BY f.created_at,f.id)
   FROM pos_refunds f WHERE f.outlet_id=p_outlet AND f.sale_id=s.id),'[]'::jsonb),
  'documents',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',d.id,'number',d.document_number,'kind',d.kind,
   'sourceDocumentId',d.source_document_id,'issuedAt',d.issued_at)
   ORDER BY d.issued_at,d.serial) FROM pos_documents d WHERE d.outlet_id=p_outlet AND d.sale_id=s.id),'[]'::jsonb),
  'providerAttempts',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a.id,'kind',a.kind,'state',a.state,
   'amountMinor',a.amount_minor::text,'createdAt',a.created_at,'updatedAt',a.updated_at)
   ORDER BY a.created_at,a.id) FROM pos_provider_attempts a
   WHERE a.outlet_id=p_outlet AND a.sale_id=s.id),'[]'::jsonb),
  'credits',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',c.id,'state',c.state,
   'amountMinor',c.amount_minor::text,'documentId',c.document_id,'createdAt',c.created_at)
   ORDER BY c.created_at,c.id) FROM pos_credit_groups c
   WHERE c.outlet_id=p_outlet AND c.sale_id=s.id),'[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION app_private.pos_reconciliation(p_outlet text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF NOT app_private.pos_access(p_outlet,'close') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('checkedAt',now(),'outletId',p_outlet,'scanLimit',500,
 'scannedCount',(SELECT count(*) FROM (SELECT sale_id FROM pos_bills WHERE outlet_id=p_outlet
    ORDER BY created_at DESC,sale_id DESC LIMIT 500) recent_count),
 'partial',EXISTS(SELECT 1 FROM pos_bills WHERE outlet_id=p_outlet
    ORDER BY created_at DESC,sale_id DESC OFFSET 500 LIMIT 1),
 'anomalies',COALESCE((WITH recent AS (
 SELECT sale_id FROM pos_bills WHERE outlet_id=p_outlet ORDER BY created_at DESC,sale_id DESC LIMIT 500
 ) SELECT jsonb_agg(jsonb_build_object('saleId',x.sale_id,'reason',x.reason) ORDER BY x.sale_id,x.reason)
 FROM (
 SELECT b.sale_id,'tender_exceeds_bill'::text reason FROM pos_bills b JOIN recent r USING(sale_id)
 WHERE b.outlet_id=p_outlet AND COALESCE((SELECT sum(t.amount_minor) FROM pos_tenders t
  WHERE t.outlet_id=p_outlet AND t.sale_id=b.sale_id),0)>b.total_minor
 UNION ALL SELECT b.sale_id,'refund_exceeds_collection' FROM pos_bills b JOIN recent r USING(sale_id)
 WHERE b.outlet_id=p_outlet AND COALESCE((SELECT sum(f.amount_minor) FROM pos_refunds f
  WHERE f.outlet_id=p_outlet AND f.sale_id=b.sale_id),0)>COALESCE((SELECT sum(t.amount_minor)
  FROM pos_tenders t WHERE t.outlet_id=p_outlet AND t.sale_id=b.sale_id),0)
 UNION ALL SELECT b.sale_id,'bill_line_total_mismatch' FROM pos_bills b JOIN recent r USING(sale_id)
 WHERE b.outlet_id=p_outlet AND COALESCE((SELECT sum((l.value->>'totalMinor')::bigint)
  FROM jsonb_array_elements(b.line_snapshot) l(value)),0)<>b.total_minor
 UNION ALL SELECT b.sale_id,'settlement_order_mismatch' FROM pos_bills b JOIN recent r USING(sale_id)
 JOIN pos_sales s ON s.id=b.sale_id AND s.outlet_id=p_outlet JOIN orders o ON o.id=s.order_id
 WHERE b.outlet_id=p_outlet AND o.payment_status='paid' AND COALESCE((SELECT sum(t.amount_minor)
  FROM pos_tenders t WHERE t.outlet_id=p_outlet AND t.sale_id=b.sale_id),0)<>b.total_minor
 UNION ALL SELECT a.sale_id,'provider_attempt_needs_reconciliation' FROM pos_provider_attempts a
 JOIN recent r USING(sale_id) WHERE a.outlet_id=p_outlet AND a.state IN ('preparing','uncertain')
 UNION ALL SELECT a.sale_id,'provider_capture_missing_tender' FROM pos_provider_attempts a
 JOIN recent r USING(sale_id) WHERE a.outlet_id=p_outlet AND a.kind='checkout' AND a.state='succeeded'
 AND NOT EXISTS(SELECT 1 FROM pos_tenders t WHERE t.outlet_id=p_outlet AND t.sale_id=a.sale_id
  AND t.method='stripe_checkout' AND t.reference=a.external_payment_id)
 UNION ALL SELECT c.sale_id,'credit_document_missing' FROM pos_credit_groups c JOIN recent r USING(sale_id)
 WHERE c.outlet_id=p_outlet AND c.state IN ('staff_recorded','provider_confirmed') AND c.document_id IS NULL
 UNION ALL SELECT d.sale_id,'document_delivery_needs_reconciliation' FROM pos_document_deliveries x
 JOIN pos_documents d ON d.id=x.document_id AND d.outlet_id=x.outlet_id JOIN recent r USING(sale_id)
 WHERE x.outlet_id=p_outlet AND (x.state IN ('uncertain','failed') OR
  (x.state='pending' AND x.updated_at<now()-interval '5 minutes'))
 ) x),'[]'::jsonb));
END $$;
