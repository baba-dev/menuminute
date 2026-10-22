-- POS D/E: gated merchant finance. This migration is additive and never backfills historical paid flags.
-- Operator-only gate: NO application role grants. Financial capture and document issue remain OFF by default.
CREATE TABLE pos_finance_gates (
 outlet_id text PRIMARY KEY, organization_id text NOT NULL,
 payments_enabled boolean NOT NULL DEFAULT false, documents_enabled boolean NOT NULL DEFAULT false,
 fiscal_approved boolean NOT NULL DEFAULT false, approval_note text NOT NULL DEFAULT '',
 approved_at timestamptz, approved_by text,
 FOREIGN KEY(organization_id,outlet_id) REFERENCES restaurants(organization_id,id)
);
CREATE TABLE pos_tax_profiles (
 outlet_id text PRIMARY KEY, organization_id text NOT NULL,
 mode text NOT NULL CHECK(mode IN ('non_registered','classified')),
 inclusive boolean NOT NULL DEFAULT false, revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 tax_label text NOT NULL CHECK(length(btrim(tax_label)) BETWEEN 2 AND 40),
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,outlet_id) REFERENCES restaurants(organization_id,id)
);
CREATE TABLE pos_tax_classes (
 outlet_id text NOT NULL REFERENCES pos_tax_profiles(outlet_id),
 dish_id text NOT NULL, rate_bps integer NOT NULL CHECK(rate_bps BETWEEN 0 AND 10000),
 classification text NOT NULL CHECK(length(btrim(classification)) BETWEEN 1 AND 32),
 PRIMARY KEY(outlet_id,dish_id)
);
CREATE TABLE pos_bills (
 sale_id text PRIMARY KEY, organization_id text NOT NULL, outlet_id text NOT NULL,
 currency text NOT NULL CHECK(length(currency)=3),
 subtotal_minor bigint NOT NULL CHECK(subtotal_minor>=0),
 taxable_base_minor bigint NOT NULL CHECK(taxable_base_minor>=0),
 tax_minor bigint NOT NULL CHECK(tax_minor>=0),
 total_minor bigint NOT NULL CHECK(total_minor>=0 AND total_minor<=2147483647),
 seller_snapshot jsonb NOT NULL, customer_snapshot jsonb NOT NULL, line_snapshot jsonb NOT NULL,
 tax_profile_revision integer NOT NULL, tax_mode text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(outlet_id,sale_id) REFERENCES pos_sales(outlet_id,id),
 FOREIGN KEY(organization_id,outlet_id) REFERENCES restaurants(organization_id,id),
 UNIQUE(outlet_id,sale_id)
);
CREATE TABLE pos_shifts (
 id text PRIMARY KEY, organization_id text NOT NULL,outlet_id text NOT NULL,register_name text NOT NULL DEFAULT 'counter',
 actor_id text NOT NULL REFERENCES users(id),currency text NOT NULL,
 opening_minor bigint NOT NULL CHECK(opening_minor>=0 AND opening_minor<=2147483647),
 counted_minor bigint CHECK(counted_minor>=0),
 expected_minor bigint CHECK(expected_minor>=0),
 state text NOT NULL DEFAULT 'open' CHECK(state IN ('open','closed')),
 opened_at timestamptz NOT NULL DEFAULT now(),closed_at timestamptz,
 FOREIGN KEY(organization_id,outlet_id) REFERENCES restaurants(organization_id,id),
 UNIQUE(outlet_id,id),CHECK((state='open' AND counted_minor IS NULL AND closed_at IS NULL)
 OR (state='closed' AND counted_minor IS NOT NULL AND expected_minor IS NOT NULL AND closed_at IS NOT NULL))
);
CREATE UNIQUE INDEX pos_one_open_register ON pos_shifts(outlet_id,register_name) WHERE state='open';
CREATE INDEX pos_shift_history ON pos_shifts(outlet_id,opened_at DESC);
CREATE TABLE pos_cash_movements (
 id text PRIMARY KEY,organization_id text NOT NULL,outlet_id text NOT NULL,shift_id text NOT NULL,
 direction text NOT NULL CHECK(direction IN ('in','out')),
 amount_minor bigint NOT NULL CHECK(amount_minor>0 AND amount_minor<=2147483647),
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 5 AND 200),
 actor_id text NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(outlet_id,shift_id) REFERENCES pos_shifts(outlet_id,id),
 FOREIGN KEY(organization_id,outlet_id) REFERENCES restaurants(organization_id,id)
);
CREATE TABLE pos_tenders (
 id text PRIMARY KEY,organization_id text NOT NULL,outlet_id text NOT NULL,
 sale_id text NOT NULL,shift_id text NOT NULL,method text NOT NULL
 CHECK(method IN ('cash','card_external','upi_external','bank_external')),
 amount_minor bigint NOT NULL CHECK(amount_minor>0 AND amount_minor<=2147483647),
 tendered_minor bigint NOT NULL CHECK(tendered_minor>=amount_minor),
 change_minor bigint NOT NULL CHECK(change_minor=tendered_minor-amount_minor),
 reference text CHECK(length(reference)<=80),
 evidence text NOT NULL DEFAULT 'staff_recorded' CHECK(evidence='staff_recorded'),
 actor_id text NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(outlet_id,sale_id) REFERENCES pos_bills(outlet_id,sale_id),
 FOREIGN KEY(outlet_id,shift_id) REFERENCES pos_shifts(outlet_id,id),
 FOREIGN KEY(organization_id,outlet_id) REFERENCES restaurants(organization_id,id),
 UNIQUE(outlet_id,id),UNIQUE(outlet_id,sale_id,id),
 CHECK(method='cash' OR (change_minor=0 AND reference IS NOT NULL AND length(btrim(reference)) BETWEEN 3 AND 80))
);
CREATE INDEX pos_tender_sale ON pos_tenders(outlet_id,sale_id,created_at);
CREATE TABLE pos_refunds (
 id text PRIMARY KEY,organization_id text NOT NULL,outlet_id text NOT NULL,
 sale_id text NOT NULL,tender_id text NOT NULL,shift_id text NOT NULL,
 amount_minor bigint NOT NULL CHECK(amount_minor>0 AND amount_minor<=2147483647),
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 5 AND 200),
 actor_id text NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(outlet_id,sale_id) REFERENCES pos_bills(outlet_id,sale_id),
 FOREIGN KEY(outlet_id,sale_id,tender_id) REFERENCES pos_tenders(outlet_id,sale_id,id),
 FOREIGN KEY(outlet_id,shift_id) REFERENCES pos_shifts(outlet_id,id),
 FOREIGN KEY(organization_id,outlet_id) REFERENCES restaurants(organization_id,id),
 UNIQUE(outlet_id,id)
);
CREATE TABLE pos_document_sequences (
 outlet_id text NOT NULL, fiscal_year integer NOT NULL, kind text NOT NULL CHECK(kind IN ('receipt','invoice','credit_note')),
 last_number integer NOT NULL CHECK(last_number>=0),
 PRIMARY KEY(outlet_id,fiscal_year,kind),FOREIGN KEY(outlet_id) REFERENCES restaurants(id)
);
CREATE TABLE pos_documents (
 id text PRIMARY KEY,organization_id text NOT NULL,outlet_id text NOT NULL,
 sale_id text NOT NULL,kind text NOT NULL CHECK(kind IN ('receipt','invoice','credit_note')),
 fiscal_year integer NOT NULL,serial integer NOT NULL CHECK(serial>0),
 document_number text NOT NULL,source_document_id text,
 snapshot jsonb NOT NULL,issued_by text NOT NULL REFERENCES users(id),
 issued_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(outlet_id,sale_id) REFERENCES pos_bills(outlet_id,sale_id),
 FOREIGN KEY(organization_id,outlet_id) REFERENCES restaurants(organization_id,id),
 UNIQUE(outlet_id,fiscal_year,kind,serial),UNIQUE(outlet_id,document_number),
 UNIQUE(outlet_id,id),FOREIGN KEY(outlet_id,source_document_id) REFERENCES pos_documents(outlet_id,id)
);
CREATE UNIQUE INDEX pos_one_original_document ON pos_documents(outlet_id,sale_id)
 WHERE kind IN ('receipt','invoice');
CREATE UNIQUE INDEX pos_one_full_credit ON pos_documents(outlet_id,source_document_id) WHERE kind='credit_note';
CREATE TABLE pos_finance_commands (
 organization_id text NOT NULL,outlet_id text NOT NULL,request_key text NOT NULL,
 request_hash text NOT NULL CHECK(request_hash ~ '^[0-9a-f]{64}$'),
 action text NOT NULL CHECK(action IN ('profile','freeze','open_shift','cash_move','tender','close_shift','issue','refund')),
 result jsonb NOT NULL,actor_id text NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(outlet_id,request_key),
 FOREIGN KEY(organization_id,outlet_id) REFERENCES restaurants(organization_id,id)
);
CREATE INDEX pos_finance_commands_time ON pos_finance_commands(outlet_id,created_at DESC);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['pos_finance_gates','pos_tax_profiles','pos_tax_classes','pos_bills','pos_shifts',
 'pos_cash_movements','pos_tenders','pos_refunds','pos_document_sequences','pos_documents','pos_finance_commands'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,menuminute_app,menuminute_worker',t);
 END LOOP;
END $$;
-- Immutable historic money and issued documents; only shift state is transitioned in restricted command.
CREATE FUNCTION app_private.pos_immutable_row() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN RAISE EXCEPTION 'Posted POS financial records are immutable' USING ERRCODE='42501'; END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['pos_bills','pos_tenders','pos_refunds','pos_cash_movements','pos_documents'] LOOP
 EXECUTE format('CREATE TRIGGER pos_immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION app_private.pos_immutable_row()',t);
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION app_private.pos_access(p_outlet text,p_action text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT EXISTS (
 SELECT 1 FROM restaurants r JOIN organizations o ON o.id=r.organization_id
 JOIN organization_members m ON m.organization_id=o.id
 LEFT JOIN outlet_grants g ON g.organization_id=o.id AND g.outlet_id=r.id AND g.member_id=m.id
 WHERE r.id=p_outlet AND r.is_active AND o.is_active AND m.is_active
 AND m.user_id=NULLIF(current_setting('app.actor_id',true),'')
 AND current_setting('app.outlet_id',true)=p_outlet
 AND CASE
  WHEN p_action IN ('configure','refund','document','close') THEN m.role IN ('owner','admin')
    OR (m.role='member' AND p_action IN ('refund','document','close') AND g.roles && ARRAY['manager']::text[])
  WHEN p_action IN ('sale','read','collect','ledger','shift') THEN m.role IN ('owner','admin')
    OR (m.role='member' AND g.roles && ARRAY['manager','service']::text[])
  ELSE false END)
$$;
CREATE FUNCTION app_private.pos_finance_allowed(p_outlet text,p_action text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT app_private.pos_access(p_outlet,p_action) AND EXISTS(
 SELECT 1 FROM pos_finance_gates f JOIN pos_outlet_settings s ON s.outlet_id=f.outlet_id
 WHERE f.outlet_id=p_outlet AND f.payments_enabled AND s.enabled)
$$;
REVOKE ALL ON FUNCTION app_private.pos_finance_allowed(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.pos_finance_allowed(text,text) TO menuminute_app;

-- Explicit tax classification; there is no fallback rate for missing published dishes.
CREATE FUNCTION app_private.pos_set_tax_profile(p_outlet text,p_key text,p_hash text,p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE r restaurants%ROWTYPE; prior pos_finance_commands%ROWTYPE; p pos_tax_profiles%ROWTYPE;
 item jsonb; v integer; result jsonb;
BEGIN
 IF NOT app_private.pos_access(p_outlet,'configure') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM restaurants WHERE id=p_outlet FOR SHARE;
 PERFORM 1 FROM organizations WHERE id=r.organization_id FOR SHARE;
 IF NOT app_private.pos_access(p_outlet,'configure') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('finance:'||p_outlet||':'||p_key,0));
 SELECT * INTO prior FROM pos_finance_commands WHERE outlet_id=p_outlet AND request_key=p_key;
 IF FOUND THEN
 IF prior.action<>'profile' OR prior.request_hash<>p_hash THEN RAISE EXCEPTION 'Key conflict' USING ERRCODE='40001'; END IF;
 RETURN prior.result||jsonb_build_object('duplicate',true); END IF;
 IF p_data->>'mode' NOT IN ('non_registered','classified')
 OR jsonb_typeof(p_data->'inclusive') IS DISTINCT FROM 'boolean'
 OR length(btrim(COALESCE(p_data->>'taxLabel',''))) NOT BETWEEN 2 AND 40
 OR jsonb_typeof(p_data->'classes') IS DISTINCT FROM 'array'
 OR jsonb_array_length(p_data->'classes')>1000
 OR (p_data->>'mode'='non_registered' AND jsonb_array_length(p_data->'classes')<>0)
 OR (p_data->>'mode'='classified' AND jsonb_array_length(p_data->'classes')=0)
 THEN RAISE EXCEPTION 'Invalid tax profile' USING ERRCODE='22023'; END IF;
 SELECT * INTO p FROM pos_tax_profiles WHERE outlet_id=p_outlet FOR UPDATE;
 IF COALESCE(p.revision,0)<>(p_data->>'expectedRevision')::integer THEN
 RAISE EXCEPTION 'Stale tax profile' USING ERRCODE='40001'; END IF;
 IF p_data->>'mode'='classified' AND
  NOT EXISTS(SELECT 1 FROM pos_seller_profiles x WHERE x.outlet_id=p_outlet
   AND x.tax_regime='requires_review' AND NULLIF(x.tax_registration,'') IS NOT NULL)
 THEN RAISE EXCEPTION 'Registered seller identity requires review' USING ERRCODE='22023'; END IF;
 IF p_data->>'mode'='non_registered' AND
  NOT EXISTS(SELECT 1 FROM pos_seller_profiles x WHERE x.outlet_id=p_outlet AND x.tax_regime='not_registered')
 THEN RAISE EXCEPTION 'Seller declaration mismatch' USING ERRCODE='22023'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_data->'classes') LOOP
 IF length(btrim(COALESCE(item->>'dishId',''))) NOT BETWEEN 1 AND 128
 OR length(btrim(COALESCE(item->>'classification',''))) NOT BETWEEN 1 AND 32
 OR (item->>'rateBps')::integer NOT BETWEEN 0 AND 10000
 THEN RAISE EXCEPTION 'Invalid tax classification' USING ERRCODE='22023'; END IF;
 END LOOP;
 IF (SELECT count(DISTINCT item.value->>'dishId') FROM jsonb_array_elements(p_data->'classes') item(value))
 <>jsonb_array_length(p_data->'classes') THEN RAISE EXCEPTION 'Duplicate tax class' USING ERRCODE='22023'; END IF;
 INSERT INTO pos_tax_profiles(outlet_id,organization_id,mode,inclusive,tax_label,revision)
 VALUES(p_outlet,r.organization_id,p_data->>'mode',(p_data->>'inclusive')::boolean,p_data->>'taxLabel',1)
 ON CONFLICT(outlet_id) DO UPDATE SET mode=excluded.mode,inclusive=excluded.inclusive,
 tax_label=excluded.tax_label,revision=pos_tax_profiles.revision+1,updated_at=now()
 RETURNING revision INTO v;
 DELETE FROM pos_tax_classes WHERE outlet_id=p_outlet;
 INSERT INTO pos_tax_classes(outlet_id,dish_id,rate_bps,classification)
 SELECT p_outlet,item.value->>'dishId',(item.value->>'rateBps')::integer,item.value->>'classification'
 FROM jsonb_array_elements(p_data->'classes') item(value);
 result:=jsonb_build_object('revision',v,'mode',p_data->>'mode');
 INSERT INTO pos_finance_commands(organization_id,outlet_id,request_key,request_hash,action,result,actor_id)
 VALUES(r.organization_id,p_outlet,p_key,p_hash,'profile',result,current_setting('app.actor_id',true));
 INSERT INTO domain_audit(id,organization_id,actor_id,action,details) VALUES
 (gen_random_uuid()::text,r.organization_id,current_setting('app.actor_id',true),'pos.tax_profile',
 jsonb_build_object('outletId',p_outlet,'revision',v,'mode',p_data->>'mode'));
 RETURN result;
END $$;
-- Tax preview has no side effects. Decimal arithmetic and per-line half-up rounding;
-- output amounts are minor-unit strings to avoid JS integer/float serialization.
CREATE FUNCTION app_private.pos_preview(p_outlet text,p_sale text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE s pos_sales%ROWTYPE; profile pos_tax_profiles%ROWTYPE; seller pos_seller_profiles%ROWTYPE;
 entry record; rate integer; base bigint; tax bigint; due bigint;
 v_sub bigint:=0;v_base bigint:=0;v_tax bigint:=0;v_due bigint:=0; snapshot jsonb:='[]'::jsonb;
BEGIN
 IF NOT app_private.pos_access(p_outlet,'read') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM pos_sales WHERE id=p_sale AND outlet_id=p_outlet;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown sale' USING ERRCODE='22023'; END IF;
 SELECT * INTO profile FROM pos_tax_profiles WHERE outlet_id=p_outlet;
 SELECT * INTO seller FROM pos_seller_profiles WHERE outlet_id=p_outlet;
 IF profile.outlet_id IS NULL OR seller.outlet_id IS NULL THEN RAISE EXCEPTION 'Tax and seller setup required' USING ERRCODE='22023'; END IF;
 IF (profile.mode='non_registered' AND seller.tax_regime<>'not_registered')
 OR (profile.mode='classified' AND (seller.tax_regime<>'requires_review' OR seller.tax_registration IS NULL))
 THEN RAISE EXCEPTION 'Seller and tax profile mismatch' USING ERRCODE='22023'; END IF;
 FOR entry IN SELECT l.*,i.dish_id FROM pos_sale_lines l JOIN order_items i ON i.id=l.order_item_id
 WHERE l.sale_id=p_sale AND l.outlet_id=p_outlet ORDER BY l.id LOOP
 IF profile.mode='non_registered' THEN rate:=0;
 ELSE
 SELECT c.rate_bps INTO rate FROM pos_tax_classes c WHERE c.outlet_id=p_outlet AND c.dish_id=entry.dish_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Missing line tax classification' USING ERRCODE='22023'; END IF;
 END IF;
 IF profile.inclusive AND rate>0 THEN
  base:=floor(entry.line_minor::numeric*10000/(10000+rate)+0.5)::bigint;
  tax:=entry.line_minor-base;due:=entry.line_minor;
 ELSE
  base:=entry.line_minor;
  tax:=floor(base::numeric*rate/10000+0.5)::bigint;due:=base+tax;
 END IF;
 v_sub:=v_sub+entry.line_minor;v_base:=v_base+base;v_tax:=v_tax+tax;v_due:=v_due+due;
 snapshot:=snapshot||jsonb_build_array(jsonb_build_object('id',entry.id,'name',entry.name_snapshot,
 'variant',entry.variant_snapshot,'options',entry.options_snapshot,'quantity',entry.quantity,
 'unitMinor',entry.unit_minor::text,'lineMinor',entry.line_minor::text,
 'classification',COALESCE((SELECT c.classification FROM pos_tax_classes c WHERE c.outlet_id=p_outlet AND c.dish_id=entry.dish_id),'NONE'),
 'rateBps',rate,'baseMinor',base::text,'taxMinor',tax::text,'totalMinor',due::text));
 END LOOP;
 IF v_sub<>s.subtotal_minor OR v_due>2147483647 OR jsonb_array_length(snapshot)=0 THEN
 RAISE EXCEPTION 'Sale lines cannot be billed' USING ERRCODE='22023'; END IF;
 RETURN jsonb_build_object('saleId',s.id,'outletId',p_outlet,'currency',s.currency,'subtotalMinor',v_sub::text,
 'taxableBaseMinor',v_base::text,'taxMinor',v_tax::text,'totalMinor',v_due::text,
 'taxProfileRevision',profile.revision,'taxMode',profile.mode,'inclusive',profile.inclusive,
 'taxLabel',profile.tax_label,'seller',jsonb_build_object('legalName',seller.legal_name,
 'registeredAddress',seller.registered_address,'country',seller.country,
 'taxRegistration',seller.tax_registration,'taxRegime',seller.tax_regime),
 'lines',snapshot);
END $$;
CREATE FUNCTION app_private.pos_finance_replay(p_outlet text,p_key text,p_hash text,p_action text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE prev pos_finance_commands%ROWTYPE;
BEGIN
 IF NOT app_private.pos_access(p_outlet,CASE p_action WHEN 'profile' THEN 'configure'
  WHEN 'freeze' THEN 'sale' WHEN 'open_shift' THEN 'shift' WHEN 'cash_move' THEN 'shift'
  WHEN 'tender' THEN 'collect' WHEN 'close_shift' THEN 'close' WHEN 'issue' THEN 'document'
  WHEN 'refund' THEN 'refund' ELSE '' END) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO prev FROM pos_finance_commands WHERE outlet_id=p_outlet AND request_key=p_key;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF prev.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'') THEN
  RAISE EXCEPTION 'Replay belongs to a different actor' USING ERRCODE='42501'; END IF;
 IF prev.request_hash<>p_hash OR prev.action<>p_action THEN RAISE EXCEPTION 'Key conflict' USING ERRCODE='40001'; END IF;
 RETURN prev.result||jsonb_build_object('duplicate',true);
END $$;

-- All finance commands are dispatched by ONE lock-bearing DB function, to serialize
-- a sale or register and commit command result+business state+audit/outbox in one transaction.
CREATE FUNCTION app_private.pos_finance_command(p_outlet text,p_key text,p_hash text,p_action text,p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE r restaurants%ROWTYPE; gate pos_finance_gates%ROWTYPE; prior pos_finance_commands%ROWTYPE;
 seller pos_seller_profiles%ROWTYPE; bill pos_bills%ROWTYPE; sale pos_sales%ROWTYPE;
 shift pos_shifts%ROWTYPE; t pos_tenders%ROWTYPE; original pos_documents%ROWTYPE;
 result jsonb; quote jsonb; id text; year integer; serial integer; document_no text; kind text;
 sum_paid bigint; sum_refund bigint; due bigint; amt bigint; tendered bigint; opening bigint;
 expected_cash bigint; signed_move bigint; line jsonb; actor text:=NULLIF(current_setting('app.actor_id',true),'');
 action_permission text;
BEGIN
 action_permission:=CASE p_action WHEN 'freeze' THEN 'sale' WHEN 'open_shift' THEN 'shift'
 WHEN 'cash_move' THEN 'shift' WHEN 'tender' THEN 'collect' WHEN 'close_shift' THEN 'close'
 WHEN 'issue' THEN 'document' WHEN 'refund' THEN 'refund' ELSE '' END;
 IF NOT app_private.pos_access(p_outlet,action_permission) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM restaurants WHERE id=p_outlet FOR SHARE;
 PERFORM 1 FROM organizations WHERE id=r.organization_id FOR SHARE;
 IF NOT app_private.pos_access(p_outlet,action_permission) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO gate FROM pos_finance_gates WHERE outlet_id=p_outlet FOR SHARE;
 IF gate.outlet_id IS NULL OR NOT gate.payments_enabled OR NOT EXISTS
 (SELECT 1 FROM pos_outlet_settings WHERE outlet_id=p_outlet AND enabled)
 THEN RAISE EXCEPTION 'Finance operator release gate is closed' USING ERRCODE='42501'; END IF;
 IF p_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 OR p_hash !~ '^[0-9a-f]{64}$' OR jsonb_typeof(p_data) IS DISTINCT FROM 'object'
 THEN RAISE EXCEPTION 'Invalid finance command' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('finance:'||p_outlet||':'||p_key,0));
 SELECT * INTO prior FROM pos_finance_commands WHERE outlet_id=p_outlet AND request_key=p_key;
 IF FOUND THEN
  IF prior.request_hash<>p_hash OR prior.action<>p_action THEN RAISE EXCEPTION 'Key conflict' USING ERRCODE='40001'; END IF;
  RETURN prior.result||jsonb_build_object('duplicate',true);
 END IF;
 CASE p_action
 WHEN 'freeze' THEN
  SELECT * INTO sale FROM pos_sales WHERE id=p_data->>'saleId' AND outlet_id=p_outlet FOR UPDATE;
  IF NOT FOUND OR sale.state<>'order_submitted' THEN RAISE EXCEPTION 'Unavailable sale' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM pos_bills WHERE sale_id=sale.id) THEN RAISE EXCEPTION 'Bill already frozen' USING ERRCODE='40001'; END IF;
  IF EXISTS(SELECT 1 FROM orders WHERE id=sale.order_id AND restaurant_id=p_outlet
   AND status IN ('rejected','cancelled','expired') ) THEN RAISE EXCEPTION 'Cancelled order cannot be billed' USING ERRCODE='22023'; END IF;
  quote:=app_private.pos_preview(p_outlet,sale.id);
  IF quote->>'totalMinor' IS DISTINCT FROM p_data->>'expectedTotalMinor' OR
    (quote->>'taxProfileRevision')::integer<>(p_data->>'expectedTaxRevision')::integer
  THEN RAISE EXCEPTION 'Tax quote changed' USING ERRCODE='40001'; END IF;
  INSERT INTO pos_bills(sale_id,organization_id,outlet_id,currency,subtotal_minor,taxable_base_minor,tax_minor,total_minor,
   seller_snapshot,customer_snapshot,line_snapshot,tax_profile_revision,tax_mode)
  VALUES(sale.id,r.organization_id,p_outlet,sale.currency,(quote->>'subtotalMinor')::bigint,
   (quote->>'taxableBaseMinor')::bigint,(quote->>'taxMinor')::bigint,(quote->>'totalMinor')::bigint,
   quote->'seller',COALESCE(p_data->'customer','{}'::jsonb),quote->'lines',
   (quote->>'taxProfileRevision')::integer,quote->>'taxMode');
  -- Synchronize the operational order with the same snapshot. Inclusive prices
  -- use the taxable base, so order subtotal + tax always equals total.
  UPDATE orders SET subtotal_minor=(quote->>'taxableBaseMinor')::integer,
   subtotal_paise=(quote->>'taxableBaseMinor')::integer,
   tax_minor=(quote->>'taxMinor')::integer,tax_paise=(quote->>'taxMinor')::integer,
   total_minor=(quote->>'totalMinor')::integer,total_paise=(quote->>'totalMinor')::integer,
   version=version+1,updated_at=clock_timestamp()
   WHERE id=sale.order_id AND restaurant_id=p_outlet;
  INSERT INTO outbox_events(id,organization_id,outlet_id,type,schema_version,aggregate_version,payload)
   SELECT gen_random_uuid()::text,r.organization_id,p_outlet,'order.financials_changed',1,version,
   jsonb_build_object('orderId',sale.order_id,'totalMinor',total_minor,'currency',currency)
   FROM orders WHERE id=sale.order_id;
  result:=quote||jsonb_build_object('frozen',true);
 WHEN 'open_shift' THEN
  IF length(btrim(COALESCE(p_data->>'registerName',''))) NOT BETWEEN 2 AND 40 THEN RAISE EXCEPTION 'Invalid register name' USING ERRCODE='22023'; END IF;
  opening:=(p_data->>'openingMinor')::bigint;
  IF opening<0 OR opening>2147483647 THEN RAISE EXCEPTION 'Invalid opening float' USING ERRCODE='22023'; END IF;
  id:='shift-'||gen_random_uuid()::text;
  INSERT INTO pos_shifts(id,organization_id,outlet_id,register_name,actor_id,currency,opening_minor)
  VALUES(id,r.organization_id,p_outlet,btrim(p_data->>'registerName'),actor,r.currency,opening);
  result:=jsonb_build_object('shiftId',id,'state','open','openingMinor',opening::text,'currency',r.currency);
 WHEN 'cash_move' THEN
  SELECT * INTO shift FROM pos_shifts WHERE id=p_data->>'shiftId' AND outlet_id=p_outlet FOR UPDATE;
  IF NOT FOUND OR shift.state<>'open' OR (shift.actor_id<>actor AND NOT app_private.pos_access(p_outlet,'close'))
  THEN RAISE EXCEPTION 'Shift unavailable' USING ERRCODE='42501'; END IF;
  amt:=(p_data->>'amountMinor')::bigint;
  IF amt<=0 OR amt>2147483647 OR p_data->>'direction' NOT IN ('in','out')
    OR length(btrim(COALESCE(p_data->>'reason',''))) NOT BETWEEN 5 AND 200
  THEN RAISE EXCEPTION 'Invalid cash movement' USING ERRCODE='22023'; END IF;
  INSERT INTO pos_cash_movements(id,organization_id,outlet_id,shift_id,direction,amount_minor,reason,actor_id)
  VALUES(gen_random_uuid()::text,r.organization_id,p_outlet,shift.id,p_data->>'direction',amt,btrim(p_data->>'reason'),actor);
  result:=jsonb_build_object('shiftId',shift.id,'direction',p_data->>'direction','amountMinor',amt::text);
 WHEN 'tender' THEN
  SELECT * INTO sale FROM pos_sales WHERE id=p_data->>'saleId' AND outlet_id=p_outlet FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown sale' USING ERRCODE='22023'; END IF;
  SELECT * INTO bill FROM pos_bills WHERE sale_id=sale.id AND outlet_id=p_outlet;
  SELECT * INTO shift FROM pos_shifts WHERE id=p_data->>'shiftId' AND outlet_id=p_outlet FOR UPDATE;
  IF bill.sale_id IS NULL OR shift.id IS NULL OR shift.state<>'open' OR shift.currency<>bill.currency OR
   (shift.actor_id<>actor AND NOT app_private.pos_access(p_outlet,'close'))
  THEN RAISE EXCEPTION 'Open assigned shift and frozen bill required' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM orders WHERE id=sale.order_id AND restaurant_id=p_outlet
   AND status IN ('accepted','preparing','ready','served','collected'))
  THEN RAISE EXCEPTION 'Order must be accepted before collection' USING ERRCODE='22023'; END IF;
  IF p_data->>'method' NOT IN ('cash','card_external','upi_external','bank_external')
  THEN RAISE EXCEPTION 'Invalid payment method' USING ERRCODE='22023'; END IF;
  amt:=(p_data->>'amountMinor')::bigint;tendered:=(p_data->>'tenderedMinor')::bigint;
  IF amt<=0 OR amt>2147483647 OR tendered<amt OR tendered>2147483647
   OR (p_data->>'method'<>'cash' AND (tendered<>amt OR length(btrim(COALESCE(p_data->>'reference',''))) NOT BETWEEN 3 AND 80))
  THEN RAISE EXCEPTION 'Invalid tender' USING ERRCODE='22023'; END IF;
  SELECT COALESCE(sum(amount_minor),0) INTO sum_paid FROM pos_tenders WHERE sale_id=sale.id AND outlet_id=p_outlet;
  due:=bill.total_minor-sum_paid;
  IF amt>due THEN RAISE EXCEPTION 'Tender exceeds balance' USING ERRCODE='40001'; END IF;
  id:='tender-'||gen_random_uuid()::text;
  INSERT INTO pos_tenders(id,organization_id,outlet_id,sale_id,shift_id,method,amount_minor,tendered_minor,change_minor,reference,actor_id)
  VALUES(id,r.organization_id,p_outlet,sale.id,shift.id,p_data->>'method',amt,tendered,tendered-amt,
    NULLIF(btrim(p_data->>'reference'),''),actor);
  IF amt=due THEN
   UPDATE orders SET payment_status='paid',version=version+1,updated_at=clock_timestamp()
   WHERE id=sale.order_id AND restaurant_id=p_outlet AND payment_status='unpaid';
   IF NOT FOUND THEN RAISE EXCEPTION 'Order payment state conflict' USING ERRCODE='40001'; END IF;
   INSERT INTO outbox_events(id,organization_id,outlet_id,type,schema_version,aggregate_version,payload)
   SELECT gen_random_uuid()::text,r.organization_id,p_outlet,'order.payment_changed',1,version,
    jsonb_build_object('orderId',sale.order_id,'paymentStatus','paid') FROM orders WHERE id=sale.order_id;
  END IF;
  result:=jsonb_build_object('tenderId',id,'saleId',sale.id,'appliedMinor',amt::text,
   'changeMinor',(tendered-amt)::text,'remainingMinor',(due-amt)::text,
   'status',CASE WHEN amt=due THEN 'paid' ELSE 'partial' END,'evidence','staff_recorded');
 WHEN 'close_shift' THEN
  SELECT * INTO shift FROM pos_shifts WHERE id=p_data->>'shiftId' AND outlet_id=p_outlet FOR UPDATE;
  IF NOT FOUND OR shift.state<>'open' THEN RAISE EXCEPTION 'Shift not open' USING ERRCODE='40001'; END IF;
  SELECT COALESCE(sum(CASE WHEN direction='in' THEN amount_minor ELSE -amount_minor END),0)
   INTO signed_move FROM pos_cash_movements WHERE shift_id=shift.id;
  SELECT COALESCE(sum(amount_minor),0) INTO sum_paid FROM pos_tenders
   WHERE shift_id=shift.id AND method='cash';
  SELECT COALESCE(sum(f.amount_minor),0) INTO sum_refund FROM pos_refunds f JOIN pos_tenders t ON t.id=f.tender_id
   WHERE f.shift_id=shift.id AND t.method='cash';
  expected_cash:=shift.opening_minor+sum_paid+signed_move-sum_refund;
  amt:=(p_data->>'countedMinor')::bigint;
  IF amt<0 OR amt>2147483647 OR expected_cash<0 OR expected_cash>2147483647
  THEN RAISE EXCEPTION 'Invalid drawer count' USING ERRCODE='22023'; END IF;
  UPDATE pos_shifts SET state='closed',counted_minor=amt,expected_minor=expected_cash,
   closed_at=clock_timestamp() WHERE id=shift.id;
  result:=jsonb_build_object('shiftId',shift.id,'state','closed','currency',shift.currency,
   'countedMinor',amt::text,'expectedMinor',expected_cash::text,
   'varianceMinor',(amt-expected_cash)::text);
 WHEN 'issue' THEN
  IF NOT gate.documents_enabled THEN RAISE EXCEPTION 'Document release gate closed' USING ERRCODE='42501'; END IF;
  SELECT * INTO sale FROM pos_sales WHERE id=p_data->>'saleId' AND outlet_id=p_outlet FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown sale' USING ERRCODE='22023'; END IF;
  SELECT * INTO bill FROM pos_bills WHERE sale_id=sale.id AND outlet_id=p_outlet;
  SELECT * INTO seller FROM pos_seller_profiles WHERE outlet_id=p_outlet;
  IF bill.sale_id IS NULL OR EXISTS(SELECT 1 FROM pos_documents WHERE sale_id=sale.id AND kind IN ('invoice','receipt'))
  THEN RAISE EXCEPTION 'Already issued or not frozen' USING ERRCODE='40001'; END IF;
  SELECT COALESCE(sum(amount_minor),0) INTO sum_paid FROM pos_tenders WHERE sale_id=sale.id;
  IF sum_paid<>bill.total_minor THEN RAISE EXCEPTION 'Outstanding balance' USING ERRCODE='40001'; END IF;
  IF bill.tax_mode='non_registered' THEN kind:='receipt';
  ELSE kind:='invoice';
   IF NOT gate.fiscal_approved OR seller.tax_regime<>'requires_review' OR seller.tax_registration IS NULL
   THEN RAISE EXCEPTION 'Fiscal adapter not approved' USING ERRCODE='42501'; END IF;
  END IF;
  year:=extract(year FROM clock_timestamp() AT TIME ZONE r.timezone)::integer;
  INSERT INTO pos_document_sequences(outlet_id,fiscal_year,kind,last_number) VALUES(p_outlet,year,kind,1)
  ON CONFLICT(outlet_id,fiscal_year,kind) DO UPDATE
  SET last_number=pos_document_sequences.last_number+1 RETURNING last_number INTO serial;
  document_no:=upper(kind)||'-'||year::text||'-'||lpad(serial::text,6,'0');
  id:='doc-'||gen_random_uuid()::text;
  INSERT INTO pos_documents(id,organization_id,outlet_id,sale_id,kind,fiscal_year,serial,document_number,snapshot,issued_by)
  VALUES(id,r.organization_id,p_outlet,sale.id,kind,year,serial,document_no,
   jsonb_build_object('bill',jsonb_build_object('subtotalMinor',bill.subtotal_minor::text,
    'taxableBaseMinor',bill.taxable_base_minor::text,'taxMinor',bill.tax_minor::text,
    'totalMinor',bill.total_minor::text,'currency',bill.currency,'seller',bill.seller_snapshot,
    'customer',bill.customer_snapshot,'lines',bill.line_snapshot,'taxMode',bill.tax_mode),
    'settlement',COALESCE((SELECT jsonb_agg(jsonb_build_object('method',t.method,'amountMinor',t.amount_minor::text,
    'reference',t.reference,'evidence',t.evidence) ORDER BY t.created_at,t.id) FROM pos_tenders t WHERE t.sale_id=sale.id),'[]'::jsonb),
    'legalStatus',CASE WHEN kind='receipt' THEN 'non_tax_receipt' ELSE 'merchant_invoice_approval_required' END,
    'orderId',sale.order_id),actor);
  result:=jsonb_build_object('documentId',id,'documentNumber',document_no,'kind',kind,'saleId',sale.id);
 WHEN 'refund' THEN
  IF NOT gate.documents_enabled THEN RAISE EXCEPTION 'Document gate closed' USING ERRCODE='42501'; END IF;
  SELECT * INTO sale FROM pos_sales WHERE id=p_data->>'saleId' AND outlet_id=p_outlet FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown sale' USING ERRCODE='22023'; END IF;
  SELECT * INTO bill FROM pos_bills WHERE sale_id=sale.id AND outlet_id=p_outlet;
  SELECT * INTO original FROM pos_documents WHERE outlet_id=p_outlet AND sale_id=sale.id AND kind IN ('receipt','invoice');
  SELECT * INTO shift FROM pos_shifts WHERE id=p_data->>'shiftId' AND outlet_id=p_outlet FOR UPDATE;
  IF bill.sale_id IS NULL OR original.id IS NULL OR shift.id IS NULL OR shift.state<>'open' OR shift.currency<>bill.currency
    OR length(btrim(COALESCE(p_data->>'reason',''))) NOT BETWEEN 5 AND 200
  THEN RAISE EXCEPTION 'Document, reason and open shift required' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM pos_refunds WHERE sale_id=sale.id) THEN
   RAISE EXCEPTION 'Full sale refund already recorded' USING ERRCODE='40001'; END IF;
  IF EXISTS(SELECT 1 FROM pos_tenders WHERE sale_id=sale.id AND method<>'cash')
    AND p_data->>'externalRefundAttested' IS DISTINCT FROM 'true' THEN
   RAISE EXCEPTION 'External reversal requires staff attestation' USING ERRCODE='22023'; END IF;
  -- Staff-recorded full-sale reversal, not a payment-provider refund API call.
  FOR t IN SELECT * FROM pos_tenders WHERE sale_id=sale.id AND outlet_id=p_outlet ORDER BY id LOOP
   INSERT INTO pos_refunds(id,organization_id,outlet_id,sale_id,tender_id,shift_id,amount_minor,reason,actor_id)
   VALUES('refund-'||gen_random_uuid()::text,r.organization_id,p_outlet,sale.id,t.id,shift.id,
    t.amount_minor,btrim(p_data->>'reason'),actor);
  END LOOP;
  year:=extract(year FROM clock_timestamp() AT TIME ZONE r.timezone)::integer;kind:='credit_note';
  INSERT INTO pos_document_sequences(outlet_id,fiscal_year,kind,last_number) VALUES(p_outlet,year,kind,1)
  ON CONFLICT(outlet_id,fiscal_year,kind) DO UPDATE
  SET last_number=pos_document_sequences.last_number+1 RETURNING last_number INTO serial;
  document_no:='CREDIT-'||year::text||'-'||lpad(serial::text,6,'0');
  id:='doc-'||gen_random_uuid()::text;
  INSERT INTO pos_documents(id,organization_id,outlet_id,sale_id,kind,fiscal_year,serial,document_number,source_document_id,snapshot,issued_by)
  VALUES(id,r.organization_id,p_outlet,sale.id,'credit_note',year,serial,document_no,original.id,
   jsonb_build_object('reverses',original.document_number,'reason',btrim(p_data->>'reason'),
   'bill',original.snapshot->'bill','refundMethod','original_tenders','totalMinor',bill.total_minor::text,
   'legalStatus','merchant_credit_document_review_required'),actor);
  result:=jsonb_build_object('documentId',id,'kind','credit_note','documentNumber',document_no,
   'originalDocumentId',original.id,'refundedMinor',bill.total_minor::text,'status','staff_recorded');
 ELSE RAISE EXCEPTION 'Unknown finance action' USING ERRCODE='22023';
 END CASE;
 INSERT INTO pos_finance_commands(organization_id,outlet_id,request_key,request_hash,action,result,actor_id)
 VALUES(r.organization_id,p_outlet,p_key,p_hash,p_action,result,actor);
 INSERT INTO domain_audit(id,organization_id,actor_id,action,details)
 VALUES(gen_random_uuid()::text,r.organization_id,actor,'pos.finance.'||p_action,
 jsonb_build_object('outletId',p_outlet,'saleId',p_data->>'saleId','result',result-'reference'));
 INSERT INTO outbox_events(id,organization_id,outlet_id,type,schema_version,aggregate_version,payload)
 VALUES(gen_random_uuid()::text,r.organization_id,p_outlet,'pos.finance.'||p_action,1,1,
 jsonb_build_object('outletId',p_outlet,'saleId',p_data->>'saleId','action',p_action));
 RETURN result;
END $$;

-- Private projection: bounded, no raw buyer identifiers in list rows.
CREATE FUNCTION app_private.pos_ledger(p_outlet text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF NOT app_private.pos_access(p_outlet,'ledger') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('saleId',s.id,'orderId',s.order_id,'currency',s.currency,
  'subtotalMinor',s.subtotal_minor::text,'totalMinor',b.total_minor::text,'taxMinor',b.tax_minor::text,
  'paidMinor',COALESCE((SELECT sum(t.amount_minor) FROM pos_tenders t WHERE t.sale_id=s.id),0)::text,
  'refundedMinor',COALESCE((SELECT sum(f.amount_minor) FROM pos_refunds f WHERE f.sale_id=s.id),0)::text,
  'documentNumber',(SELECT d.document_number FROM pos_documents d WHERE d.sale_id=s.id AND d.kind IN ('receipt','invoice')),
  'createdAt',s.created_at) ORDER BY s.created_at DESC,s.id DESC)
 FROM (SELECT * FROM pos_sales WHERE outlet_id=p_outlet ORDER BY created_at DESC,id DESC LIMIT 60) s
 LEFT JOIN pos_bills b ON b.sale_id=s.id),'[]'::jsonb);
END $$;
CREATE FUNCTION app_private.pos_sale_detail(p_outlet text,p_sale text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE s pos_sales%ROWTYPE;b pos_bills%ROWTYPE;
BEGIN
 IF NOT app_private.pos_access(p_outlet,'ledger') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM pos_sales WHERE outlet_id=p_outlet AND id=p_sale;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sale unavailable' USING ERRCODE='22023'; END IF;
 SELECT * INTO b FROM pos_bills WHERE sale_id=s.id;
 RETURN jsonb_build_object('saleId',s.id,'orderId',s.order_id,'currency',s.currency,
  'subtotalMinor',s.subtotal_minor::text,
  'bill',CASE WHEN b.sale_id IS NULL THEN NULL ELSE jsonb_build_object('totalMinor',b.total_minor::text,
   'subtotalMinor',b.subtotal_minor::text,'taxMinor',b.tax_minor::text,'taxableBaseMinor',b.taxable_base_minor::text,
   'seller',b.seller_snapshot,'customer',b.customer_snapshot,'lines',b.line_snapshot,'taxMode',b.tax_mode,
   'taxProfileRevision',b.tax_profile_revision) END,
  'tenders',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',t.id,'method',t.method,'amountMinor',t.amount_minor::text,
   'changeMinor',t.change_minor::text,'reference',t.reference,'evidence',t.evidence,'shiftId',t.shift_id,'createdAt',t.created_at)
   ORDER BY t.created_at,t.id) FROM pos_tenders t WHERE t.sale_id=s.id),'[]'::jsonb),
  'refunds',COALESCE((SELECT jsonb_agg(jsonb_build_object('tenderId',f.tender_id,'amountMinor',f.amount_minor::text,
   'reason',f.reason,'createdAt',f.created_at) ORDER BY f.created_at,f.id)
   FROM pos_refunds f WHERE f.sale_id=s.id),'[]'::jsonb),
  'documents',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',d.id,'number',d.document_number,'kind',d.kind,
  'sourceDocumentId',d.source_document_id,'issuedAt',d.issued_at)
  ORDER BY d.issued_at,d.serial) FROM pos_documents d WHERE d.sale_id=s.id),'[]'::jsonb));
END $$;
CREATE FUNCTION app_private.pos_document_detail(p_outlet text,p_document text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $
DECLARE d pos_documents%ROWTYPE;
BEGIN
 IF NOT app_private.pos_access(p_outlet,'ledger') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO d FROM pos_documents WHERE outlet_id=p_outlet AND id=p_document;
 IF NOT FOUND THEN RAISE EXCEPTION 'Document unavailable' USING ERRCODE='22023'; END IF;
 RETURN jsonb_build_object('id',d.id,'number',d.document_number,'kind',d.kind,'issuedAt',d.issued_at,
 'sourceDocumentId',d.source_document_id,'snapshot',d.snapshot);
END $$;
CREATE FUNCTION app_private.pos_shift_list(p_outlet text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF NOT app_private.pos_access(p_outlet,'shift') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',s.id,'registerName',s.register_name,'state',s.state,
 'actorId',s.actor_id,'openingMinor',s.opening_minor::text,'expectedMinor',s.expected_minor::text,
 'countedMinor',s.counted_minor::text,'currency',s.currency,'openedAt',s.opened_at,'closedAt',s.closed_at,
 'cashTakenMinor',COALESCE((SELECT sum(t.amount_minor) FROM pos_tenders t WHERE t.shift_id=s.id AND t.method='cash'),0)::text,
 'cashRefundMinor',COALESCE((SELECT sum(f.amount_minor) FROM pos_refunds f JOIN pos_tenders t ON t.id=f.tender_id WHERE f.shift_id=s.id AND t.method='cash'),0)::text)
 ORDER BY s.opened_at DESC,s.id DESC)
 FROM (SELECT * FROM pos_shifts WHERE outlet_id=p_outlet ORDER BY opened_at DESC,id DESC LIMIT 30) s),'[]'::jsonb);
END $$;
-- Prevent SQL role from invoking unrestricted legacy finance functions on a POS-linked sale.
-- Explicit privileges only on narrowly scoped reviewed functions.
DO $$ DECLARE x text; BEGIN
 FOREACH x IN ARRAY ARRAY[
 'app_private.pos_set_tax_profile(text,text,text,jsonb)',
 'app_private.pos_preview(text,text)',
 'app_private.pos_finance_replay(text,text,text,text)',
 'app_private.pos_finance_command(text,text,text,text,jsonb)',
 'app_private.pos_ledger(text)','app_private.pos_sale_detail(text,text)',
 'app_private.pos_document_detail(text,text)','app_private.pos_shift_list(text)'
 ] LOOP
 EXECUTE 'REVOKE ALL ON FUNCTION '||x||' FROM PUBLIC';
 EXECUTE 'GRANT EXECUTE ON FUNCTION '||x||' TO menuminute_app';
 END LOOP;
END $$;

CREATE FUNCTION app_private.pos_finance_context(p_outlet text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE g pos_finance_gates%ROWTYPE; p pos_tax_profiles%ROWTYPE;
BEGIN
 IF NOT app_private.pos_access(p_outlet,'read') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO g FROM pos_finance_gates WHERE outlet_id=p_outlet;
 SELECT * INTO p FROM pos_tax_profiles WHERE outlet_id=p_outlet;
 RETURN jsonb_build_object('paymentsEnabled',COALESCE(g.payments_enabled,false),
 'documentsEnabled',COALESCE(g.documents_enabled,false),'fiscalApproved',COALESCE(g.fiscal_approved,false),
 'taxProfile',CASE WHEN p.outlet_id IS NULL THEN NULL ELSE jsonb_build_object('mode',p.mode,'inclusive',p.inclusive,
 'taxLabel',p.tax_label,'revision',p.revision,'classes',COALESCE(
 (SELECT jsonb_agg(jsonb_build_object('dishId',c.dish_id,'classification',c.classification,
 'rateBps',c.rate_bps) ORDER BY c.dish_id) FROM pos_tax_classes c WHERE c.outlet_id=p_outlet),'[]'::jsonb)) END,
 'canManage',app_private.pos_access(p_outlet,'configure'),
 'canCollect',app_private.pos_access(p_outlet,'collect'),
 'canRefund',app_private.pos_access(p_outlet,'refund'),
 'canIssue',app_private.pos_access(p_outlet,'document'));
END $$;
CREATE FUNCTION app_private.pos_reconciliation(p_outlet text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF NOT app_private.pos_access(p_outlet,'close') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('checkedAt',now(),'outletId',p_outlet,'anomalies',
 COALESCE((SELECT jsonb_agg(jsonb_build_object('saleId',x.sale_id,'reason',x.reason))
 FROM (
 SELECT b.sale_id,'tender_exceeds_bill'::text AS reason FROM pos_bills b
 WHERE b.outlet_id=p_outlet AND COALESCE((SELECT sum(t.amount_minor) FROM pos_tenders t WHERE t.sale_id=b.sale_id),0)>b.total_minor
 UNION ALL
 SELECT b.sale_id,'refund_exceeds_collection' FROM pos_bills b
 WHERE b.outlet_id=p_outlet AND COALESCE((SELECT sum(f.amount_minor) FROM pos_refunds f WHERE f.sale_id=b.sale_id),0)>
 COALESCE((SELECT sum(t.amount_minor) FROM pos_tenders t WHERE t.sale_id=b.sale_id),0)
 UNION ALL
 SELECT b.sale_id,'bill_line_total_mismatch' FROM pos_bills b
 WHERE b.outlet_id=p_outlet AND
  COALESCE((SELECT sum((l.value->>'totalMinor')::bigint) FROM jsonb_array_elements(b.line_snapshot) l(value)),0)<>b.total_minor
 UNION ALL
 SELECT b.sale_id,'settlement_order_mismatch' FROM pos_bills b JOIN pos_sales s ON s.id=b.sale_id
 JOIN orders o ON o.id=s.order_id WHERE b.outlet_id=p_outlet AND o.payment_status='paid'
 AND COALESCE((SELECT sum(t.amount_minor) FROM pos_tenders t WHERE t.sale_id=b.sale_id),0)<>b.total_minor
 ) x),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION app_private.pos_finance_context(text),app_private.pos_reconciliation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.pos_finance_context(text),app_private.pos_reconciliation(text) TO menuminute_app;
