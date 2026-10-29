-- 0036: Explicit single-superadmin operator grant and outlet activation.
-- Separate from the two-operator pilot and commercial Razorpay checkout.
-- Permanent means no scheduled expiry in the business UI (year-9999 sentinel),
-- still revocable; no customer subscription or collected payment is implied.
-- All changes are additive; previous migration checksums remain untouched.

ALTER TABLE kitchen_pilot_outlets
  ADD COLUMN activation_mode text NOT NULL DEFAULT 'pilot'
    CHECK (activation_mode IN ('pilot','operator'));

-- The legacy pilot always requires distinct operators. An operator-mode
-- activation can self-attest ONLY when exactly one enrolled superadmin exists.
ALTER TABLE kitchen_pilot_outlets DROP CONSTRAINT kitchen_pilot_outlets_check;
ALTER TABLE kitchen_pilot_outlets ADD CONSTRAINT kitchen_pilot_review_integrity
  CHECK (approved_by IS NULL OR approved_by<>requested_by OR activation_mode='operator');
ALTER TABLE kitchen_pilot_outlets ADD CONSTRAINT kitchen_operator_state_integrity
  CHECK (activation_mode <> 'operator' OR state IN ('active','draining','disabled'));

-- A previously disabled operator outlet may be requested as a traditional
-- independently reviewed pilot later. Normalize back to pilot before the
-- state constraint is checked; do not change any historical audit receipts.
CREATE FUNCTION app_private.kitchen_operator_reset_to_pilot() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
BEGIN
 IF NEW.state='requested' THEN NEW.activation_mode:='pilot'; END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION app_private.kitchen_operator_reset_to_pilot() FROM PUBLIC;
CREATE TRIGGER kitchen_operator_reset_to_pilot
 BEFORE INSERT OR UPDATE ON kitchen_pilot_outlets
 FOR EACH ROW EXECUTE FUNCTION app_private.kitchen_operator_reset_to_pilot();

-- Deny revocation of an active Kitchen grant while any outlet has live intake.
-- The operator must drain and finalize first; accepted tickets are never stranded.
CREATE FUNCTION app_private.kitchen_operator_grant_revoke_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
BEGIN
 IF OLD.capability='kitchen.new' AND OLD.operator <> 'razorpay-webhook'
   AND OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL
   AND EXISTS(
     SELECT 1 FROM restaurants r JOIN kitchen_outlet_settings k ON k.outlet_id=r.id
     WHERE r.organization_id=OLD.organization_id AND k.enabled
   )
 THEN RAISE EXCEPTION 'Drain and disable active Kitchen outlets before revoking access'
   USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION app_private.kitchen_operator_grant_revoke_guard() FROM PUBLIC;
CREATE TRIGGER kitchen_operator_revoke_guard BEFORE UPDATE OF revoked_at ON entitlement_grants
 FOR EACH ROW EXECUTE FUNCTION app_private.kitchen_operator_grant_revoke_guard();

CREATE FUNCTION app_private.kitchen_operator_grant(p_org text,p_data jsonb,p_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE actor text:=NULLIF(current_setting('app.actor_id',true),'');
 op_email text; existing admin_command_receipts%ROWTYPE; org organizations%ROWTYPE;
 grant_id text; term text:=coalesce(p_data->>'term','');
 reason text:=btrim(coalesce(p_data->>'reason',''));
 currency text:=coalesce(p_data->>'billingCurrency','');
 start_time timestamptz; end_time timestamptz;
 result jsonb;
BEGIN
 IF actor IS NULL OR NOT app_private.is_super_admin(actor)
   OR p_key IS NULL OR p_key !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   OR p_org IS NULL OR length(p_org) NOT BETWEEN 1 AND 254
   OR p_data IS NULL OR jsonb_typeof(p_data)<>'object'
   OR term NOT IN ('trial_7','permanent')
   OR currency NOT IN ('USD','INR')
   OR length(reason) NOT BETWEEN 10 AND 500
 THEN RAISE EXCEPTION 'Invalid operator Kitchen access grant' USING ERRCODE='42501'; END IF;
 SELECT email INTO op_email FROM users WHERE id=actor;
 PERFORM 1 FROM organizations WHERE id=p_org AND is_active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active organization required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(actor||':'||p_key,0));
 SELECT * INTO existing FROM admin_command_receipts WHERE actor_id=actor AND request_key=p_key;
 IF FOUND THEN
   IF existing.action<>'kitchen.operator.grant' OR existing.target_id<>p_org
     OR existing.payload<>p_data THEN RAISE EXCEPTION 'Operator grant key conflict' USING ERRCODE='23505'; END IF;
   RETURN existing.result;
 END IF;
 IF NOT app_private.require_step_up() THEN
   RAISE EXCEPTION 'Confirm a privileged action with password and authenticator' USING ERRCODE='42501';
 END IF;
 start_time:=(p_data->>'startsAt')::timestamptz;
 end_time:=(p_data->>'endsAt')::timestamptz;
 IF start_time IS NULL OR end_time IS NULL OR end_time<=start_time
   OR end_time<=clock_timestamp() OR start_time>clock_timestamp()+interval '30 days'
   OR start_time<clock_timestamp()-interval '10 minutes'
 THEN RAISE EXCEPTION 'Invalid operator grant window' USING ERRCODE='22023'; END IF;
 IF (term='trial_7' AND
      (end_time<start_time+interval '6 days 23 hours' OR
       end_time>start_time+interval '7 days 1 minute'))
    OR (term='permanent' AND end_time<>'9999-12-31 23:59:59+00'::timestamptz)
 THEN RAISE EXCEPTION 'Operator grant term does not match its window' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM entitlement_grants e
   WHERE e.organization_id=p_org AND e.capability='kitchen.new'
     AND e.revoked_at IS NULL AND e.starts_at<end_time AND e.ends_at>start_time)
 THEN RAISE EXCEPTION 'Overlapping Kitchen access exists; revoke or complete the existing term'
   USING ERRCODE='23505'; END IF;
 grant_id:=gen_random_uuid()::text;
 INSERT INTO entitlement_grants(id,organization_id,capability,billing_currency,starts_at,ends_at,operator,reason,request_key)
 VALUES(grant_id,p_org,'kitchen.new',currency,start_time,end_time,op_email,
        'Operator '||term||': '||reason,p_key);
 PERFORM app_private.record_org_change(p_org,'kitchen.operator.grant',NULL);
 INSERT INTO domain_audit(id,organization_id,actor_id,action,details)
 VALUES(gen_random_uuid()::text,p_org,actor,'kitchen.operator.grant',
   jsonb_build_object('grantId',grant_id,'term',term,'reason',reason));
 INSERT INTO admin_audit_logs(id,actor_id,actor_email,action,target_type,target_id,details)
 VALUES(gen_random_uuid()::text,actor,op_email,'kitchen.operator.grant','organization',p_org,
   jsonb_build_object('grantId',grant_id,'term',term,'reason',reason));
 result:=jsonb_build_object('id',grant_id,'term',term);
 INSERT INTO admin_command_receipts(actor_id,request_key,action,target_id,payload,result)
 VALUES(actor,p_key,'kitchen.operator.grant',p_org,p_data,result);
 RETURN result;
END $fn$;
REVOKE ALL ON FUNCTION app_private.kitchen_operator_grant(text,jsonb,text)
 FROM PUBLIC,menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.kitchen_operator_grant(text,jsonb,text) TO menuminute_app;

-- For owner-operated deployments with exactly one qualified superadmin:
-- operator attests external reviews and release with one-use step-up.
-- This does NOT mark the external QA tickets complete or publish paid checkout.
CREATE FUNCTION app_private.kitchen_operator_activate(p_outlet text,p_data jsonb,p_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE actor text:=NULLIF(current_setting('app.actor_id',true),'');
 op_email text; org text; readiness jsonb; current_pilot kitchen_pilot_outlets%ROWTYPE;
 existing admin_command_receipts%ROWTYPE; reply jsonb;
 reason text:=btrim(coalesce(p_data->>'reason',''));
 release_sha text:=coalesce(p_data->>'releaseSha','');
 evidence text:=coalesce(p_data->>'evidenceUrl','');
BEGIN
 IF actor IS NULL OR NOT app_private.is_super_admin(actor)
   OR p_key IS NULL OR p_key !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   OR p_data IS NULL OR jsonb_typeof(p_data)<>'object'
   OR length(reason) NOT BETWEEN 10 AND 500
   OR release_sha !~ '^[a-f0-9]{40}$'
   OR evidence !~ '^https://github[.]com/baba-dev/menuminute/(issues|pull)/[0-9]+'
   OR length(evidence)>500
 THEN RAISE EXCEPTION 'Invalid operator Kitchen activation' USING ERRCODE='42501'; END IF;
 -- Enforce solitary qualified platform administrator using owner-only user rows.
 IF (SELECT count(*) FROM users WHERE is_super_admin AND email_verified AND two_factor_enabled)<>1
 THEN RAISE EXCEPTION 'Independent reviewer is required when multiple superadmins exist'
   USING ERRCODE='42501'; END IF;
 SELECT r.organization_id INTO org FROM restaurants r
 JOIN organizations o ON o.id=r.organization_id AND o.is_active
 WHERE r.id=p_outlet AND r.is_active;
 IF org IS NULL THEN RAISE EXCEPTION 'Outlet unavailable' USING ERRCODE='22023'; END IF;
 SELECT email INTO op_email FROM users WHERE id=actor;
 PERFORM 1 FROM organizations WHERE id=org FOR UPDATE;
 PERFORM pg_advisory_xact_lock(hashtextextended(actor||':'||p_key,0));
 SELECT * INTO existing FROM admin_command_receipts WHERE actor_id=actor AND request_key=p_key;
 IF FOUND THEN
   IF existing.action<>'kitchen.operator.activate' OR existing.target_id<>p_outlet
     OR existing.payload<>p_data THEN RAISE EXCEPTION 'Operator activation key conflict' USING ERRCODE='23505'; END IF;
   RETURN existing.result;
 END IF;
 IF NOT app_private.require_step_up() THEN
   RAISE EXCEPTION 'Confirm a privileged action with password and authenticator' USING ERRCODE='42501';
 END IF;
 SELECT * INTO current_pilot FROM kitchen_pilot_outlets WHERE outlet_id=p_outlet FOR UPDATE;
 IF current_pilot.state IN ('active','draining','requested','approved') THEN
   RAISE EXCEPTION 'Active or pending kitchen lifecycle must be resolved first'
     USING ERRCODE='40001';
 END IF;
 readiness:=app_private.kitchen_pilot_status(p_outlet);
 IF NOT (readiness->>'configurationReady')::boolean
   OR NOT (readiness->>'orderingEntitled')::boolean
   OR (readiness->>'openKitchenOrders')::integer>0
   OR NOT (readiness->>'kitchenEntitled')::boolean
 THEN RAISE EXCEPTION 'Kitchen readiness and active operator grant are required'
   USING ERRCODE='42501'; END IF;
 INSERT INTO kitchen_pilot_outlets(
   outlet_id,organization_id,state,requested_by,approved_by,release_sha,evidence_url,
   reason,approved_at,active_at,expires_at,activation_mode)
 VALUES(p_outlet,org,'active',actor,actor,release_sha,evidence,reason,
   clock_timestamp(),clock_timestamp(),NULL,'operator')
 ON CONFLICT(outlet_id) DO UPDATE SET
   state='active',requested_by=actor,approved_by=actor,
   release_sha=EXCLUDED.release_sha,evidence_url=EXCLUDED.evidence_url,
   reason=EXCLUDED.reason,approved_at=clock_timestamp(),
   active_at=clock_timestamp(),expires_at=NULL,
   activation_mode='operator',revision=kitchen_pilot_outlets.revision+1,
   updated_at=clock_timestamp();
 INSERT INTO kitchen_outlet_settings(outlet_id,enabled) VALUES(p_outlet,true)
 ON CONFLICT(outlet_id) DO UPDATE SET enabled=true,
   revision=kitchen_outlet_settings.revision+1,updated_at=clock_timestamp();
 PERFORM app_private.kitchen_emit(p_outlet,'settings.changed');
 PERFORM app_private.record_org_change(org,'kitchen.operator.activate',p_outlet);
 INSERT INTO domain_audit(id,organization_id,actor_id,action,details)
 VALUES(gen_random_uuid()::text,org,actor,'kitchen.operator.activate',
   jsonb_build_object('outletId',p_outlet,'releaseSha',release_sha,
   'evidenceUrl',evidence,'reason',reason));
 INSERT INTO admin_audit_logs(id,actor_id,actor_email,action,target_type,target_id,details)
 VALUES(gen_random_uuid()::text,actor,op_email,'kitchen.operator.activate','kitchen',p_outlet,
   jsonb_build_object('releaseSha',release_sha,'evidenceUrl',evidence,'reason',reason));
 reply:=app_private.kitchen_pilot_status(p_outlet);
 INSERT INTO admin_command_receipts(actor_id,request_key,action,target_id,payload,result)
 VALUES(actor,p_key,'kitchen.operator.activate',p_outlet,p_data,reply);
 RETURN reply;
END $fn$;
REVOKE ALL ON FUNCTION app_private.kitchen_operator_activate(text,jsonb,text)
 FROM PUBLIC,menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.kitchen_operator_activate(text,jsonb,text) TO menuminute_app;
