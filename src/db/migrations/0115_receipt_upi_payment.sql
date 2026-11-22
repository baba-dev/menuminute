-- 0115: Per-outlet UPI payee profile used to print a pre-filled "Scan & Pay" QR on unpaid INR receipts.
-- MenuMinute only prints a link the merchant's own UPI ID accepts: no payment-provider call, no money
-- movement and no payment confirmation. Additive and inert until a merchant saves a profile; existing
-- receipts, orders and sales are unchanged. Available on every plan (no entitlement check).
CREATE TABLE app_private.outlet_receipt_payment_profiles (
  outlet_id text PRIMARY KEY,
  organization_id text NOT NULL,
  upi_id text NOT NULL CHECK (
    upi_id ~ '^[a-zA-Z0-9][a-zA-Z0-9._-]{1,255}@[a-zA-Z][a-zA-Z0-9]{1,63}$' AND upi_id = lower(upi_id)
  ),
  payee_name text NOT NULL CHECK (
    length(payee_name) BETWEEN 2 AND 40 AND payee_name ~ '^[A-Za-z0-9 .&''-]+$' AND payee_name = btrim(payee_name)
  ),
  enabled boolean NOT NULL,
  revision integer NOT NULL CHECK (revision>0),
  updated_by text NOT NULL REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (organization_id,outlet_id) REFERENCES restaurants(organization_id,id)
);
CREATE TABLE app_private.outlet_receipt_payment_profiles_history (
  outlet_id text NOT NULL,
  revision integer NOT NULL,
  organization_id text NOT NULL,
  -- History keeps only a masked hint (never the full UPI ID), like the audit trail.
  upi_id_hint text NOT NULL,
  payee_name text NOT NULL,
  enabled boolean NOT NULL,
  changed_by text NOT NULL REFERENCES users(id),
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (outlet_id,revision),
  FOREIGN KEY (organization_id,outlet_id) REFERENCES restaurants(organization_id,id)
);
CREATE INDEX outlet_receipt_payment_history_org_idx
  ON app_private.outlet_receipt_payment_profiles_history(organization_id,outlet_id,revision DESC);
REVOKE ALL ON app_private.outlet_receipt_payment_profiles,
  app_private.outlet_receipt_payment_profiles_history
  FROM PUBLIC,menuminute_app,menuminute_worker,menuminute_billing;

-- Readable by anyone who may print receipts for the outlet (POS read access) and by outlet managers.
-- Never exposes another tenant's profile. No row means the merchant has not set up UPI printing.
CREATE FUNCTION app_private.read_outlet_receipt_payment(p_org text,p_outlet text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE p app_private.outlet_receipt_payment_profiles%ROWTYPE;
BEGIN
 IF current_setting('app.outlet_id',true) IS DISTINCT FROM p_outlet
   OR NOT (app_private.pos_access(p_outlet,'read') OR app_private.can_outlet(p_outlet,'outlet.manage'))
   OR NOT EXISTS(SELECT 1 FROM restaurants WHERE organization_id=p_org AND id=p_outlet AND is_active)
 THEN RAISE EXCEPTION 'Outlet access denied' USING ERRCODE='42501'; END IF;
 SELECT * INTO p FROM app_private.outlet_receipt_payment_profiles
   WHERE outlet_id=p_outlet AND organization_id=p_org;
 IF NOT FOUND THEN
  RETURN jsonb_build_object('configured',false,'upiId',NULL,'payeeName',NULL,'enabled',false,
    'revision',0,'updatedAt',NULL);
 END IF;
 RETURN jsonb_build_object('configured',true,'upiId',p.upi_id,'payeeName',p.payee_name,
   'enabled',p.enabled,'revision',p.revision,'updatedAt',p.updated_at);
END $$;
REVOKE ALL ON FUNCTION app_private.read_outlet_receipt_payment(text,text)
  FROM PUBLIC,menuminute_worker,menuminute_billing;
GRANT EXECUTE ON FUNCTION app_private.read_outlet_receipt_payment(text,text) TO menuminute_app;

-- Compare-and-swap, serialized by outlet. Only outlet managers may write; demo outlets are refused.
CREATE FUNCTION app_private.save_outlet_receipt_payment(
 p_org text,p_outlet text,p_expected integer,p_data jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE p app_private.outlet_receipt_payment_profiles%ROWTYPE; r restaurants%ROWTYPE;
 v_upi text; v_name text; v_enabled boolean; v_revision integer;
 v_actor text:=NULLIF(current_setting('app.actor_id',true),'');
BEGIN
 IF current_setting('app.outlet_id',true) IS DISTINCT FROM p_outlet
   OR NOT app_private.can_outlet(p_outlet,'outlet.manage')
   OR p_expected IS NULL OR p_expected<0 OR p_data IS NULL
   OR jsonb_typeof(p_data)<>'object'
   OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_data) k(key)
      WHERE k.key NOT IN ('upiId','payeeName','enabled'))
   OR jsonb_typeof(p_data->'upiId') IS DISTINCT FROM 'string'
   OR jsonb_typeof(p_data->'payeeName') IS DISTINCT FROM 'string'
   OR jsonb_typeof(p_data->'enabled') IS DISTINCT FROM 'boolean'
 THEN RAISE EXCEPTION 'Invalid receipt payment settings or outlet access' USING ERRCODE='42501'; END IF;
 v_upi:=lower(btrim(p_data->>'upiId'));
 v_name:=btrim(p_data->>'payeeName');
 v_enabled:=(p_data->>'enabled')::boolean;
 IF v_upi !~ '^[a-z0-9][a-z0-9._-]{1,255}@[a-z][a-z0-9]{1,63}$'
   OR length(v_name) NOT BETWEEN 2 AND 40 OR v_name !~ '^[A-Za-z0-9 .&''-]+$'
 THEN RAISE EXCEPTION 'Invalid UPI ID or payee name' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('outlet-receipt-payment:'||p_outlet,0));
 SELECT * INTO r FROM restaurants WHERE id=p_outlet AND organization_id=p_org
   AND is_active AND NOT is_demo_data FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Outlet unavailable' USING ERRCODE='42501'; END IF;
 SELECT * INTO p FROM app_private.outlet_receipt_payment_profiles
   WHERE outlet_id=p_outlet AND organization_id=p_org FOR UPDATE;
 IF COALESCE(p.revision,0)<>p_expected THEN
  RAISE EXCEPTION 'Receipt payment settings changed; reload and review' USING ERRCODE='40001'; END IF;
 v_revision:=p_expected+1;
 INSERT INTO app_private.outlet_receipt_payment_profiles(
   outlet_id,organization_id,upi_id,payee_name,enabled,revision,updated_by)
 VALUES(p_outlet,p_org,v_upi,v_name,v_enabled,v_revision,v_actor)
 ON CONFLICT(outlet_id) DO UPDATE SET
   upi_id=excluded.upi_id,payee_name=excluded.payee_name,enabled=excluded.enabled,
   revision=excluded.revision,updated_by=excluded.updated_by,updated_at=clock_timestamp();
 INSERT INTO app_private.outlet_receipt_payment_profiles_history(
   outlet_id,revision,organization_id,upi_id_hint,payee_name,enabled,changed_by)
 VALUES(p_outlet,v_revision,p_org,left(v_upi,2)||'***@'||split_part(v_upi,'@',2),v_name,v_enabled,v_actor);
 -- The UPI ID is deliberately not copied into the audit trail.
 INSERT INTO domain_audit(id,organization_id,actor_id,action,details)
 VALUES(gen_random_uuid()::text,p_org,v_actor,'outlet.receipt_payment.settings',
  jsonb_build_object('outletId',p_outlet,'revision',v_revision,'enabled',v_enabled));
 RETURN jsonb_build_object('configured',true,'upiId',v_upi,'payeeName',v_name,
   'enabled',v_enabled,'revision',v_revision,'updatedAt',clock_timestamp());
END $$;
REVOKE ALL ON FUNCTION app_private.save_outlet_receipt_payment(text,text,integer,jsonb)
  FROM PUBLIC,menuminute_worker,menuminute_billing;
GRANT EXECUTE ON FUNCTION app_private.save_outlet_receipt_payment(text,text,integer,jsonb)
  TO menuminute_app;

-- A receipt for a cancelled, declined or expired order must never invite payment. Same live-status
-- rule the POS register uses; only callers who may print the outlet's receipts can ask.
CREATE FUNCTION app_private.receipt_sale_accepts_payment(p_outlet text,p_sale text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF current_setting('app.outlet_id',true) IS DISTINCT FROM p_outlet
   OR NOT app_private.pos_access(p_outlet,'read')
 THEN RAISE EXCEPTION 'Outlet access denied' USING ERRCODE='42501'; END IF;
 RETURN EXISTS (
  SELECT 1 FROM pos_sales s JOIN orders o ON o.id=s.order_id AND o.restaurant_id=s.outlet_id
  WHERE s.id=p_sale AND s.outlet_id=p_outlet AND o.status NOT IN ('cancelled','rejected','expired'));
END $$;
REVOKE ALL ON FUNCTION app_private.receipt_sale_accepts_payment(text,text)
  FROM PUBLIC,menuminute_worker,menuminute_billing;
GRANT EXECUTE ON FUNCTION app_private.receipt_sale_accepts_payment(text,text) TO menuminute_app;
