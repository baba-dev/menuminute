-- Standard POS is included with an active Ordering/Kitchen entitlement (or Community Edition).
-- Automatic activation is deliberately separate from pos_finance_gates: it cannot enable
-- gateway collection, statutory document issuance, or operator fiscal approval.
-- Existing outlets are backfilled by 0099 after the shift separation has been installed.
CREATE FUNCTION app_private.pos_standard_entitled(p_org text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT app_private.is_community_edition() OR EXISTS (
   SELECT 1 FROM entitlement_grants g
   WHERE g.organization_id=p_org AND g.capability IN ('ordering.new','kitchen.new')
     AND g.revoked_at IS NULL AND g.starts_at<=statement_timestamp()
     AND g.ends_at>statement_timestamp()
 )
$$;
REVOKE ALL ON FUNCTION app_private.pos_standard_entitled(text) FROM PUBLIC,menuminute_app,menuminute_worker;

-- An active grant is authoritative, not an HTTP claim. UPSERT only a disabled or
-- missing setting, preserving revision and manually entered seller identity.
CREATE FUNCTION app_private.pos_activate_entitled_outlets(p_org text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF NOT app_private.pos_standard_entitled(p_org) THEN RETURN; END IF;
 INSERT INTO pos_outlet_settings(organization_id,outlet_id,enabled,revision)
 SELECT r.organization_id,r.id,true,1
 FROM restaurants r JOIN organizations o ON o.id=r.organization_id AND o.is_active
 WHERE r.organization_id=p_org AND r.is_active AND NOT r.is_demo_data
 ON CONFLICT (outlet_id) DO UPDATE
 SET enabled=true,revision=pos_outlet_settings.revision+1,updated_at=clock_timestamp()
 WHERE NOT pos_outlet_settings.enabled;
END $$;
REVOKE ALL ON FUNCTION app_private.pos_activate_entitled_outlets(text) FROM PUBLIC,menuminute_app,menuminute_worker;

-- New paid subscriptions/trials and renewals automatically provision their outlets.
-- No trigger on revocation: historical POS/receipt access remains intact.
CREATE FUNCTION app_private.pos_on_entitlement_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF NEW.capability IN ('ordering.new','kitchen.new') THEN
   PERFORM app_private.pos_activate_entitled_outlets(NEW.organization_id);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app_private.pos_on_entitlement_change() FROM PUBLIC,menuminute_app,menuminute_worker;
CREATE TRIGGER pos_entitlement_activation
AFTER INSERT OR UPDATE OF starts_at,ends_at,revoked_at ON entitlement_grants
FOR EACH ROW EXECUTE FUNCTION app_private.pos_on_entitlement_change();

-- An organization with an existing paid entitlement may create another outlet later.
CREATE FUNCTION app_private.pos_on_outlet_create() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF NEW.is_active AND NOT NEW.is_demo_data THEN
   PERFORM app_private.pos_activate_entitled_outlets(NEW.organization_id);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app_private.pos_on_outlet_create() FROM PUBLIC,menuminute_app,menuminute_worker;
CREATE TRIGGER pos_outlet_activation
AFTER INSERT ON restaurants FOR EACH ROW
EXECUTE FUNCTION app_private.pos_on_outlet_create();
