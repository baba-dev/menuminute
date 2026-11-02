-- Kitchen catalog maintenance after a separately approved platform release.
-- No automatic activation: this is only executed by a live superadmin using
-- a one-time password+authenticator proof, through the existing admin editor.
CREATE FUNCTION app_private.kitchen_catalog_update(
 p_plan text,p_data jsonb,p_key text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE
 actor text:=NULLIF(current_setting('app.actor_id',true),'');
 email_address text;
 prior admin_command_receipts%ROWTYPE;
 entry subscription_plans%ROWTYPE;
 result jsonb;
BEGIN
 IF actor IS NULL OR NOT app_private.is_super_admin(actor)
  OR p_plan IS DISTINCT FROM 'plan_kitchen_pro'
  OR p_key IS NULL OR p_key !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  OR p_data IS NULL OR jsonb_typeof(p_data)<>'object' OR p_data='{}'::jsonb
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_data) AS k(value)
            WHERE value NOT IN ('displayName','sortOrder','isActive'))
  OR (p_data ? 'displayName' AND
      (jsonb_typeof(p_data->'displayName')<>'string' OR
       length(btrim(p_data->>'displayName')) NOT BETWEEN 2 AND 100))
  OR (p_data ? 'sortOrder' AND
      (jsonb_typeof(p_data->'sortOrder')<>'number' OR
       p_data->>'sortOrder' !~ '^[0-9]{1,6}$'))
  OR (p_data ? 'isActive' AND jsonb_typeof(p_data->'isActive')<>'boolean')
 THEN RAISE EXCEPTION 'Invalid Kitchen catalog update' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(actor||':'||p_key,0));
 SELECT * INTO prior FROM admin_command_receipts
 WHERE actor_id=actor AND request_key=p_key;
 IF FOUND THEN
  IF prior.action<>'billing.plan.update' OR prior.target_id<>p_plan OR prior.payload<>p_data
  THEN RAISE EXCEPTION 'Administrative request key conflict' USING ERRCODE='23505'; END IF;
  RETURN prior.result;
 END IF;
 IF NOT app_private.require_step_up() THEN
  RAISE EXCEPTION 'Confirm a recent privileged action at /account/security first'
   USING ERRCODE='42501'; END IF;
 SELECT * INTO entry FROM subscription_plans WHERE id=p_plan FOR UPDATE;
 IF NOT FOUND OR entry.name<>'kitchen_pro' THEN
  RAISE EXCEPTION 'Unknown Kitchen catalog entry' USING ERRCODE='22023'; END IF;
 IF (p_data->>'isActive')::boolean IS TRUE THEN
  IF NOT app_private.kitchen_commerce_enabled() THEN
   RAISE EXCEPTION 'Kitchen Pro global commercial release is not approved'
   USING ERRCODE='42501'; END IF;
  IF entry.monthly_price_paise<>49900 THEN
   RAISE EXCEPTION 'Kitchen Pro price differs from reviewed payment catalog'
   USING ERRCODE='22023'; END IF;
 END IF;
 UPDATE subscription_plans SET
  display_name=coalesce(btrim(p_data->>'displayName'),display_name),
  sort_order=coalesce((p_data->>'sortOrder')::int,sort_order),
  is_active=coalesce((p_data->>'isActive')::boolean,is_active)
 WHERE id=p_plan;
 SELECT email INTO email_address FROM users WHERE id=actor;
 result:=jsonb_build_object('id',p_plan,'success',true,
  'isActive',(SELECT is_active FROM subscription_plans WHERE id=p_plan));
 INSERT INTO admin_audit_logs(id,actor_id,actor_email,action,target_type,target_id,details)
 VALUES(gen_random_uuid()::text,actor,email_address,'billing.plan.update','billing',p_plan,p_data);
 INSERT INTO admin_command_receipts(actor_id,request_key,action,target_id,payload,result)
 VALUES(actor,p_key,'billing.plan.update',p_plan,p_data,result);
 RETURN result;
END $fn$;
REVOKE ALL ON FUNCTION app_private.kitchen_catalog_update(text,jsonb,text)
 FROM PUBLIC,menuminute_worker,menuminute_billing;
GRANT EXECUTE ON FUNCTION app_private.kitchen_catalog_update(text,jsonb,text)
 TO menuminute_app;
