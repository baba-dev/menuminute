-- Final activation rollout. Existing eligible outlets are backfilled once, and
-- future-dated entitlements activate on an authorized POS visit. All changes are
-- additive; merchant seller identity, financial records and disabled fiscal gates remain untouched.

-- The ordinary POS context is read often, so only a currently entitled, authorized
-- reader may lazily provision their own outlet. This function is idempotent.
CREATE FUNCTION app_private.pos_ensure_active(p_outlet text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_org text;
BEGIN
 IF NOT app_private.pos_access(p_outlet,'read')
   OR current_setting('app.outlet_id',true) IS DISTINCT FROM p_outlet
 THEN RAISE EXCEPTION 'POS access required' USING ERRCODE='42501'; END IF;
 SELECT r.organization_id INTO v_org FROM restaurants r
   JOIN organizations o ON o.id=r.organization_id AND o.is_active
   WHERE r.id=p_outlet AND r.is_active AND NOT r.is_demo_data;
 IF v_org IS NULL THEN RETURN false; END IF;
 IF app_private.pos_standard_entitled(v_org) THEN
   INSERT INTO pos_outlet_settings(organization_id,outlet_id,enabled,revision)
   VALUES(v_org,p_outlet,true,1)
   ON CONFLICT(outlet_id) DO UPDATE
     SET enabled=true,revision=pos_outlet_settings.revision+1,updated_at=clock_timestamp()
   WHERE NOT pos_outlet_settings.enabled;
 END IF;
 RETURN EXISTS(SELECT 1 FROM pos_outlet_settings
   WHERE outlet_id=p_outlet AND enabled);
END $$;
REVOKE ALL ON FUNCTION app_private.pos_ensure_active(text) FROM PUBLIC,menuminute_worker,menuminute_billing;
GRANT EXECUTE ON FUNCTION app_private.pos_ensure_active(text) TO menuminute_app;

-- Register closure is a shift permission, never a document-issuance entitlement.
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
 'canRefund',app_private.pos_access(p_outlet,'refund'),'canIssue',app_private.pos_access(p_outlet,'document'),
 'canCloseShift',app_private.pos_access(p_outlet,'close'));
END $$;


-- Serialize cash attestation and shift open/close so a concurrent close cannot
-- misattribute a payment. Ambiguous multi-register cash remains unassigned.
CREATE OR REPLACE FUNCTION app_private.pos_assign_staff_cash_shift() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_ids text[];
BEGIN
 IF NEW.method='cash' THEN
   PERFORM pg_advisory_xact_lock(hashtextextended('pos-shift-outlet:'||NEW.outlet_id,0));
   SELECT array_agg(s.id) INTO v_ids FROM (
     SELECT id FROM pos_shifts WHERE outlet_id=NEW.outlet_id AND state='open'
     ORDER BY id LIMIT 2 FOR SHARE
   ) s;
   IF cardinality(v_ids)=1 THEN NEW.shift_id:=v_ids[1]; END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION app_private.pos_shift_command(
 p_outlet text,p_key text,p_hash text,p_action text,p_data jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
 r restaurants%ROWTYPE;shift pos_shifts%ROWTYPE;prior pos_finance_commands%ROWTYPE;
 actor text:=NULLIF(current_setting('app.actor_id',true),'');
 action_permission text;result jsonb;new_id text;
 opening bigint;amount bigint;counted bigint;expected_cash bigint;
 movement bigint;cash_paid bigint;cash_refunded bigint;
 staff_paid bigint;staff_refunded bigint;
BEGIN
 action_permission:=CASE WHEN p_action='close_shift' THEN 'close' ELSE 'shift' END;
 IF p_action NOT IN ('open_shift','cash_move','close_shift')
   OR NOT app_private.pos_access(p_outlet,action_permission)
   OR current_setting('app.outlet_id',true) IS DISTINCT FROM p_outlet
 THEN RAISE EXCEPTION 'Shift access denied' USING ERRCODE='42501'; END IF;
 -- Serialize opening, closing, and cash attribution for this outlet.
 PERFORM pg_advisory_xact_lock(hashtextextended('pos-shift-outlet:'||p_outlet,0));
 SELECT * INTO r FROM restaurants WHERE id=p_outlet AND is_active AND NOT is_demo_data FOR SHARE;
 IF NOT FOUND OR NOT EXISTS(
   SELECT 1 FROM pos_outlet_settings WHERE outlet_id=p_outlet AND enabled)
 THEN RAISE EXCEPTION 'Point of Sale is not active' USING ERRCODE='42501'; END IF;
 IF p_key IS NULL OR p_key !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
   OR p_hash IS NULL OR p_hash !~ '^[a-f0-9]{64}$'
   OR jsonb_typeof(p_data) IS DISTINCT FROM 'object'
 THEN RAISE EXCEPTION 'Invalid shift command' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('finance:'||p_outlet||':'||p_key,0));
 SELECT * INTO prior FROM pos_finance_commands
 WHERE outlet_id=p_outlet AND request_key=p_key FOR UPDATE;
 IF FOUND THEN
   IF prior.action<>p_action OR prior.request_hash<>p_hash OR prior.actor_id<>actor
   THEN RAISE EXCEPTION 'Shift request conflict' USING ERRCODE='40001'; END IF;
   RETURN prior.result||jsonb_build_object('duplicate',true);
 END IF;
 CASE p_action
 WHEN 'open_shift' THEN
   IF length(btrim(COALESCE(p_data->>'registerName',''))) NOT BETWEEN 2 AND 40
     OR COALESCE(p_data->>'openingMinor','') !~ '^(0|[1-9][0-9]{0,9})$'
   THEN RAISE EXCEPTION 'Invalid opening cash' USING ERRCODE='22023'; END IF;
   opening:=(p_data->>'openingMinor')::bigint;
   IF opening>2147483647 THEN RAISE EXCEPTION 'Opening cash exceeds limit' USING ERRCODE='22023'; END IF;
   new_id:='shift-'||gen_random_uuid()::text;
   INSERT INTO pos_shifts(id,organization_id,outlet_id,register_name,actor_id,currency,opening_minor)
   VALUES(new_id,r.organization_id,p_outlet,btrim(p_data->>'registerName'),actor,r.currency,opening);
   result:=jsonb_build_object('shiftId',new_id,'state','open','openingMinor',opening::text,'currency',r.currency);
 WHEN 'cash_move' THEN
   SELECT * INTO shift FROM pos_shifts WHERE id=p_data->>'shiftId'
     AND outlet_id=p_outlet FOR UPDATE;
   IF NOT FOUND OR shift.state<>'open'
     OR (shift.actor_id<>actor AND NOT app_private.pos_access(p_outlet,'close'))
   THEN RAISE EXCEPTION 'Shift unavailable' USING ERRCODE='42501'; END IF;
   IF COALESCE(p_data->>'amountMinor','') !~ '^[1-9][0-9]{0,9}$'
     OR p_data->>'direction' NOT IN ('in','out')
     OR length(btrim(COALESCE(p_data->>'reason',''))) NOT BETWEEN 5 AND 200
   THEN RAISE EXCEPTION 'Invalid cash movement' USING ERRCODE='22023'; END IF;
   amount:=(p_data->>'amountMinor')::bigint;
   IF amount>2147483647 THEN RAISE EXCEPTION 'Cash movement exceeds limit' USING ERRCODE='22023'; END IF;
   INSERT INTO pos_cash_movements(id,organization_id,outlet_id,shift_id,direction,amount_minor,reason,actor_id)
   VALUES(gen_random_uuid()::text,r.organization_id,p_outlet,shift.id,
      p_data->>'direction',amount,btrim(p_data->>'reason'),actor);
   result:=jsonb_build_object('shiftId',shift.id,'direction',p_data->>'direction','amountMinor',amount::text);
 WHEN 'close_shift' THEN
   SELECT * INTO shift FROM pos_shifts WHERE id=p_data->>'shiftId'
     AND outlet_id=p_outlet FOR UPDATE;
   IF NOT FOUND OR shift.state<>'open'
   THEN RAISE EXCEPTION 'Shift not open' USING ERRCODE='40001'; END IF;
   IF COALESCE(p_data->>'countedMinor','') !~ '^(0|[1-9][0-9]{0,9})$'
   THEN RAISE EXCEPTION 'Invalid drawer count' USING ERRCODE='22023'; END IF;
   counted:=(p_data->>'countedMinor')::bigint;
   IF counted>2147483647 THEN RAISE EXCEPTION 'Drawer count exceeds limit' USING ERRCODE='22023'; END IF;
   SELECT COALESCE(sum(CASE WHEN direction='in' THEN amount_minor ELSE -amount_minor END),0)
     INTO movement FROM pos_cash_movements WHERE shift_id=shift.id;
   SELECT COALESCE(sum(amount_minor),0) INTO cash_paid FROM pos_tenders
     WHERE shift_id=shift.id AND method='cash';
   SELECT COALESCE(sum(f.amount_minor),0) INTO cash_refunded
     FROM pos_refunds f JOIN pos_tenders t ON t.id=f.tender_id
     WHERE f.shift_id=shift.id AND t.method='cash';
   SELECT COALESCE(sum(amount_minor),0) INTO staff_paid
     FROM pos_staff_payment_attestations WHERE shift_id=shift.id AND method='cash';
   SELECT COALESCE(sum(f.amount_minor),0) INTO staff_refunded
     FROM pos_staff_refunds f
     WHERE f.shift_id=shift.id AND f.method='cash';
   expected_cash:=shift.opening_minor+movement+cash_paid+staff_paid-cash_refunded-staff_refunded;
   IF expected_cash<0 OR expected_cash>2147483647
   THEN RAISE EXCEPTION 'Invalid expected cash' USING ERRCODE='22023'; END IF;
   UPDATE pos_shifts SET state='closed',counted_minor=counted,expected_minor=expected_cash,
      closed_at=clock_timestamp() WHERE id=shift.id;
   result:=jsonb_build_object('shiftId',shift.id,'state','closed','currency',shift.currency,
      'countedMinor',counted::text,'expectedMinor',expected_cash::text,
      'varianceMinor',(counted-expected_cash)::text);
 END CASE;
 INSERT INTO pos_finance_commands(organization_id,outlet_id,request_key,request_hash,action,result,actor_id)
 VALUES(r.organization_id,p_outlet,p_key,p_hash,p_action,result,actor);
 INSERT INTO domain_audit(id,organization_id,actor_id,action,details)
 VALUES(gen_random_uuid()::text,r.organization_id,actor,'pos.finance.'||p_action,
   jsonb_build_object('outletId',p_outlet,'shiftId',result->>'shiftId','result',result));
 INSERT INTO outbox_events(id,organization_id,outlet_id,type,schema_version,aggregate_version,payload)
 VALUES(gen_random_uuid()::text,r.organization_id,p_outlet,'pos.finance.'||p_action,1,1,
   jsonb_build_object('outletId',p_outlet,'shiftId',result->>'shiftId','action',p_action));
 RETURN result;
END $$;

-- A refund is a fresh cash movement: assign it to the drawer handling the
-- refund, never retroactively to the original payment's already-closed shift.
ALTER TABLE pos_staff_refunds ADD COLUMN shift_id text;
ALTER TABLE pos_staff_refunds
 ADD CONSTRAINT pos_staff_refund_shift_fk FOREIGN KEY(outlet_id,shift_id)
 REFERENCES pos_shifts(outlet_id,id);
CREATE INDEX pos_staff_refund_shift_cash ON pos_staff_refunds(shift_id)
 WHERE shift_id IS NOT NULL AND method='cash';
CREATE FUNCTION app_private.pos_assign_staff_cash_refund_shift() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_ids text[];
BEGIN
 IF NEW.method='cash' THEN
   PERFORM pg_advisory_xact_lock(hashtextextended('pos-shift-outlet:'||NEW.outlet_id,0));
   SELECT array_agg(s.id) INTO v_ids FROM (
     SELECT id FROM pos_shifts WHERE outlet_id=NEW.outlet_id AND state='open'
     ORDER BY id LIMIT 2 FOR SHARE
   ) s;
   IF cardinality(v_ids)=1 THEN NEW.shift_id:=v_ids[1]; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app_private.pos_assign_staff_cash_refund_shift()
 FROM PUBLIC,menuminute_app,menuminute_worker;
CREATE TRIGGER pos_staff_cash_refund_shift_attribution
 BEFORE INSERT ON pos_staff_refunds
 FOR EACH ROW EXECUTE FUNCTION app_private.pos_assign_staff_cash_refund_shift();

-- Drawer totals and Reports use the refund drawer, not the original sale drawer.
CREATE OR REPLACE FUNCTION app_private.pos_shift_list(p_outlet text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF NOT app_private.pos_access(p_outlet,'shift') THEN
   RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object(
 'id',s.id,'registerName',s.register_name,'state',s.state,
 'actorId',s.actor_id,'openingMinor',s.opening_minor::text,'expectedMinor',s.expected_minor::text,
 'countedMinor',s.counted_minor::text,'currency',s.currency,'openedAt',s.opened_at,'closedAt',s.closed_at,
 'cashTakenMinor',(
    COALESCE((SELECT sum(t.amount_minor) FROM pos_tenders t
      WHERE t.shift_id=s.id AND t.method='cash'),0)
   +COALESCE((SELECT sum(a.amount_minor) FROM pos_staff_payment_attestations a
      WHERE a.shift_id=s.id AND a.method='cash'),0))::text,
 'cashRefundMinor',(
    COALESCE((SELECT sum(f.amount_minor) FROM pos_refunds f JOIN pos_tenders t ON t.id=f.tender_id
      WHERE f.shift_id=s.id AND t.method='cash'),0)
   +COALESCE((SELECT sum(f.amount_minor) FROM pos_staff_refunds f
      WHERE f.shift_id=s.id AND f.method='cash'),0))::text)
 ORDER BY s.opened_at DESC,s.id DESC)
 FROM (SELECT * FROM pos_shifts WHERE outlet_id=p_outlet
   ORDER BY opened_at DESC,id DESC LIMIT 30) s),'[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION app_private.reports_finance_snapshot_v2(
 p_outlet text,p_from date,p_to date
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_snapshot jsonb;v_tz text;v_staff bigint;v_staff_ref bigint;
 v_cash bigint;v_cash_ref bigint;v_methods jsonb;v_staff_refunds jsonb;
BEGIN
 v_snapshot:=app_private.reports_finance_snapshot(p_outlet,p_from,p_to);
 IF (v_snapshot->>'available') IS DISTINCT FROM 'true' THEN RETURN v_snapshot; END IF;
 SELECT timezone INTO v_tz FROM restaurants WHERE id=p_outlet AND is_active;
 IF v_tz IS NULL THEN RAISE EXCEPTION 'Outlet unavailable' USING ERRCODE='42501'; END IF;
 SELECT COALESCE(sum(amount_minor),0),
   COALESCE(sum(amount_minor) FILTER (WHERE method='cash' AND shift_id IS NULL),0)
 INTO v_staff,v_cash FROM pos_staff_payment_attestations
 WHERE outlet_id=p_outlet AND (created_at AT TIME ZONE v_tz)::date BETWEEN p_from AND p_to;
 SELECT COALESCE(sum(r.amount_minor),0),
   COALESCE(sum(r.amount_minor) FILTER (WHERE r.method='cash' AND r.shift_id IS NULL),0)
 INTO v_staff_ref,v_cash_ref FROM pos_staff_refunds r
 WHERE r.outlet_id=p_outlet AND (r.created_at AT TIME ZONE v_tz)::date BETWEEN p_from AND p_to;
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
   'method','staff_'||method,'tenderCount',count_entries,'amountMinor',total::text)
   ORDER BY method),'[]'::jsonb)
 INTO v_methods FROM (
   SELECT method,count(*)::integer AS count_entries,sum(amount_minor) AS total
   FROM pos_staff_payment_attestations
   WHERE outlet_id=p_outlet AND (created_at AT TIME ZONE v_tz)::date BETWEEN p_from AND p_to
   GROUP BY method
 ) methods;
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
   'id',r.sale_id,'orderId',r.order_id,'amountMinor',r.amount_minor::text,
   'reason',r.reason,'actorName',COALESCE(u.name,'Staff'),'createdAt',r.created_at,
   'evidence','staff_refund_attested') ORDER BY r.created_at DESC,r.sale_id DESC),'[]'::jsonb)
 INTO v_staff_refunds
 FROM (SELECT * FROM pos_staff_refunds WHERE outlet_id=p_outlet
   AND (created_at AT TIME ZONE v_tz)::date BETWEEN p_from AND p_to
   ORDER BY created_at DESC,sale_id DESC LIMIT 20) r
 LEFT JOIN users u ON u.id=r.actor_id;
 RETURN v_snapshot || jsonb_build_object(
   'totalCollectedMinor',((v_snapshot->>'totalCollectedMinor')::bigint+v_staff)::text,
   'totalRefundedMinor',((v_snapshot->>'totalRefundedMinor')::bigint+v_staff_ref)::text,
   'financeCollectedMinor',v_snapshot->>'totalCollectedMinor',
   'financeRefundedMinor',v_snapshot->>'totalRefundedMinor',
   'staffCollectedMinor',v_staff::text,
   'staffRefundedMinor',v_staff_ref::text,
   'unassignedCashCollectedMinor',v_cash::text,
   'unassignedCashRefundedMinor',v_cash_ref::text,
   'unassignedNetCashMinor',(v_cash-v_cash_ref)::text,
   'unassignedCashExplanation','Only staff cash without an open register assignment is excluded from drawer totals.',
   'tenders',COALESCE(v_snapshot->'tenders','[]'::jsonb) || v_methods,
   'recentRefunds',COALESCE(v_snapshot->'recentRefunds','[]'::jsonb) || v_staff_refunds,
   'financeAndStaffEvidenceCombined',true,
   'bankReconciliationVerified',false
 );
END $$;
REVOKE ALL ON FUNCTION app_private.reports_finance_snapshot_v2(text,date,date)
  FROM PUBLIC,menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.reports_finance_snapshot_v2(text,date,date)
  TO menuminute_app;

-- Backfill active paid organizations (including Community Edition). Never
-- touch demo outlets, past tenders, invoice gates, or payment-provider settings.
DO $$
DECLARE v_org record;
BEGIN
 FOR v_org IN
   SELECT o.id FROM organizations o
   WHERE o.is_active AND app_private.pos_standard_entitled(o.id)
 LOOP
   PERFORM app_private.pos_activate_entitled_outlets(v_org.id);
 END LOOP;
END $$;
