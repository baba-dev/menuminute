-- 0104: Independent merchant-declared sales-tax preferences (NOT a statutory invoice adapter).
-- Safe to apply with existing INR subscriptions / POS finance gates / published menus.
-- No default tax rate and no change to existing order, sale or receipt values.
CREATE TABLE app_private.outlet_sales_tax_policies (
  outlet_id text PRIMARY KEY,
  organization_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('unconfigured','no_tax','configured')),
  label text NOT NULL CHECK (length(btrim(label)) BETWEEN 2 AND 40),
  rate_bps integer NOT NULL CHECK (rate_bps BETWEEN 0 AND 10000),
  inclusive boolean NOT NULL,
  revision integer NOT NULL CHECK (revision>0),
  updated_by text NOT NULL REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (organization_id,outlet_id) REFERENCES restaurants(organization_id,id),
  CONSTRAINT outlet_sales_tax_status_rate CHECK (
    (status='configured' AND rate_bps>0) OR
    (status<>'configured' AND rate_bps=0)
  )
);
CREATE TABLE app_private.outlet_sales_tax_policy_history (
  outlet_id text NOT NULL,
  revision integer NOT NULL,
  organization_id text NOT NULL,
  status text NOT NULL,
  label text NOT NULL,
  rate_bps integer NOT NULL,
  inclusive boolean NOT NULL,
  changed_by text NOT NULL REFERENCES users(id),
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (outlet_id,revision),
  FOREIGN KEY (organization_id,outlet_id) REFERENCES restaurants(organization_id,id)
);
CREATE INDEX outlet_sales_tax_policy_history_org_idx
  ON app_private.outlet_sales_tax_policy_history(organization_id,outlet_id,revision DESC);
REVOKE ALL ON app_private.outlet_sales_tax_policies,
  app_private.outlet_sales_tax_policy_history
  FROM PUBLIC,menuminute_app,menuminute_worker,menuminute_billing;

-- Read only for a member with the existing outlet menu-read authority. Never
-- expose a cross-tenant profile. No policy row means merchant has NOT declared 0% tax.
CREATE FUNCTION app_private.read_outlet_sales_tax(p_org text,p_outlet text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE p app_private.outlet_sales_tax_policies%ROWTYPE;
BEGIN
 IF current_setting('app.outlet_id',true) IS DISTINCT FROM p_outlet
   OR NOT app_private.can_outlet(p_outlet,'menu.read')
   OR NOT EXISTS(SELECT 1 FROM restaurants WHERE organization_id=p_org AND id=p_outlet AND is_active)
 THEN RAISE EXCEPTION 'Outlet access denied' USING ERRCODE='42501'; END IF;
 SELECT * INTO p FROM app_private.outlet_sales_tax_policies WHERE outlet_id=p_outlet AND organization_id=p_org;
 IF NOT FOUND THEN
  RETURN jsonb_build_object('status','unconfigured','label','Sales tax','rateBps',0,
    'inclusive',false,'revision',0,'updatedAt',NULL,'canChangeOrders',false);
 END IF;
 RETURN jsonb_build_object('status',p.status,'label',p.label,'rateBps',p.rate_bps,
   'inclusive',p.inclusive,'revision',p.revision,'updatedAt',p.updated_at,
   'canChangeOrders',false);
END $$;
REVOKE ALL ON FUNCTION app_private.read_outlet_sales_tax(text,text) FROM PUBLIC,menuminute_worker,menuminute_billing;
GRANT EXECUTE ON FUNCTION app_private.read_outlet_sales_tax(text,text) TO menuminute_app;

-- Compare-and-swap, serialized by outlet. Only explicit owner/manager
-- authorization, explicit merchant declaration, and bounded rates are accepted.
CREATE FUNCTION app_private.save_outlet_sales_tax(
 p_org text,p_outlet text,p_expected integer,p_data jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE p app_private.outlet_sales_tax_policies%ROWTYPE; r restaurants%ROWTYPE;
 v_status text; v_label text;v_rate integer;v_inclusive boolean;
 v_revision integer;v_actor text:=NULLIF(current_setting('app.actor_id',true),'');
BEGIN
 IF current_setting('app.outlet_id',true) IS DISTINCT FROM p_outlet
   OR NOT app_private.can_outlet(p_outlet,'outlet.manage')
   OR p_expected IS NULL OR p_expected<0 OR p_data IS NULL
   OR jsonb_typeof(p_data)<>'object'
   OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_data) k(key)
      WHERE k.key NOT IN ('status','label','rateBps','inclusive','confirmed'))
   OR p_data->>'status' NOT IN ('unconfigured','no_tax','configured')
   OR jsonb_typeof(p_data->'label') IS DISTINCT FROM 'string'
   OR jsonb_typeof(p_data->'rateBps') IS DISTINCT FROM 'number'
   OR COALESCE(p_data->>'rateBps','') !~ '^[0-9]{1,5}$'
   OR jsonb_typeof(p_data->'inclusive') IS DISTINCT FROM 'boolean'
   OR jsonb_typeof(p_data->'confirmed') IS DISTINCT FROM 'boolean'
   OR (p_data->>'confirmed')::boolean IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'Invalid sales tax settings or outlet access' USING ERRCODE='42501'; END IF;
 v_status:=p_data->>'status';v_label:=btrim(p_data->>'label');
 v_rate:=(p_data->>'rateBps')::integer;v_inclusive:=(p_data->>'inclusive')::boolean;
 IF length(v_label) NOT BETWEEN 2 AND 40 OR v_rate NOT BETWEEN 0 AND 10000
   OR (v_status='configured' AND v_rate=0)
   OR (v_status<>'configured' AND v_rate<>0)
 THEN RAISE EXCEPTION 'Invalid tax label, status or rate' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('outlet-sales-tax:'||p_outlet,0));
 SELECT * INTO r FROM restaurants WHERE id=p_outlet AND organization_id=p_org
   AND is_active AND NOT is_demo_data FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Outlet unavailable' USING ERRCODE='42501'; END IF;
 SELECT * INTO p FROM app_private.outlet_sales_tax_policies
   WHERE outlet_id=p_outlet AND organization_id=p_org FOR UPDATE;
 IF COALESCE(p.revision,0)<>p_expected THEN
  RAISE EXCEPTION 'Sales tax settings changed; reload and review' USING ERRCODE='40001'; END IF;
 v_revision:=p_expected+1;
 INSERT INTO app_private.outlet_sales_tax_policies(
   outlet_id,organization_id,status,label,rate_bps,inclusive,revision,updated_by)
 VALUES(p_outlet,p_org,v_status,v_label,v_rate,v_inclusive,v_revision,v_actor)
 ON CONFLICT(outlet_id) DO UPDATE SET
   status=excluded.status,label=excluded.label,rate_bps=excluded.rate_bps,
   inclusive=excluded.inclusive,revision=excluded.revision,
   updated_by=excluded.updated_by,updated_at=clock_timestamp();
 INSERT INTO app_private.outlet_sales_tax_policy_history(
   outlet_id,revision,organization_id,status,label,rate_bps,inclusive,changed_by)
 VALUES(p_outlet,v_revision,p_org,v_status,v_label,v_rate,v_inclusive,v_actor);
 INSERT INTO domain_audit(id,organization_id,actor_id,action,details)
 VALUES(gen_random_uuid()::text,p_org,v_actor,'outlet.sales_tax.settings',
  jsonb_build_object('outletId',p_outlet,'revision',v_revision,'status',v_status,
    'rateBps',v_rate,'inclusive',v_inclusive,'appliedToOrders',false));
 RETURN jsonb_build_object('status',v_status,'label',v_label,'rateBps',v_rate,
   'inclusive',v_inclusive,'revision',v_revision,'updatedAt',clock_timestamp(),
   'canChangeOrders',false);
END $$;
REVOKE ALL ON FUNCTION app_private.save_outlet_sales_tax(text,text,integer,jsonb)
 FROM PUBLIC,menuminute_worker,menuminute_billing;
GRANT EXECUTE ON FUNCTION app_private.save_outlet_sales_tax(text,text,integer,jsonb)
 TO menuminute_app;
