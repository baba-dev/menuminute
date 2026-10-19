-- Additive: existing identities are NEVER silently marked verified.
-- Existing users can verify through the normal email link; no account deletion or session reset.
CREATE FUNCTION app_private.require_verified_member() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF NEW.is_active AND NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND email_verified=true) THEN
  RAISE EXCEPTION 'Verified email required before membership activation' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app_private.require_verified_member() FROM PUBLIC;
CREATE TRIGGER verify_member_insert BEFORE INSERT ON organization_members
 FOR EACH ROW EXECUTE FUNCTION app_private.require_verified_member();
CREATE TRIGGER verify_member_update BEFORE UPDATE OF user_id,role,is_active ON organization_members
 FOR EACH ROW WHEN (NEW.is_active) EXECUTE FUNCTION app_private.require_verified_member();
-- Existing members keep their stored rows. Authentication and all new role grants require verification.
-- Inventory to run before rollout (no writes):
-- SELECT m.role, count(*) FROM organization_members m JOIN users u ON u.id=m.user_id
-- WHERE m.is_active AND NOT u.email_verified GROUP BY m.role;
