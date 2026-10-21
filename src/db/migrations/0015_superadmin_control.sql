-- Superadmin & Platform Control Plane: additive migration
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS users_super_admin_idx ON users(is_super_admin) WHERE is_super_admin;

-- Automatically mark approved superadmin email
UPDATE users SET is_super_admin = true WHERE email = 'admin@bababuilds.com';

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id text PRIMARY KEY,
  actor_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  actor_email text NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  details jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_actor_idx ON admin_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS admin_audit_action_idx ON admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS admin_audit_created_idx ON admin_audit_logs(created_at);

ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs FORCE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION app_private.is_super_admin(p_user text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM users WHERE id=p_user AND is_super_admin);
$$;

REVOKE ALL ON FUNCTION app_private.is_super_admin(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.is_super_admin(text) TO menuminute_app;

CREATE POLICY admin_audit_read ON admin_audit_logs FOR SELECT USING (
  app_private.is_super_admin(current_setting('app.actor_id', true))
);

CREATE POLICY admin_audit_insert ON admin_audit_logs FOR INSERT WITH CHECK (
  actor_id = current_setting('app.actor_id', true) AND app_private.is_super_admin(current_setting('app.actor_id', true))
);

GRANT SELECT, INSERT ON admin_audit_logs TO menuminute_app;

-- The existing tenant-scoped SELECT policies remain unchanged. Platform operators
-- receive global read visibility only after the server sets an authenticated
-- actor inside a transaction (withActor); an unset actor remains fail-closed.
DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'organizations', 'organization_members', 'brands', 'restaurants',
    'orders', 'entitlement_grants', 'outbox_events', 'domain_projections'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY platform_admin_global_read ON %I FOR SELECT TO menuminute_app USING (app_private.is_super_admin(current_setting(''app.actor_id'', true)))',
      table_name
    );
  END LOOP;
END $$;
