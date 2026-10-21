-- Selection is only a hint. Fresh authorization is mandatory on EVERY read.
CREATE TABLE account_workspace_preferences (
 user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 organization_id text,
 outlet_id text,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (organization_id IS NULL OR length(organization_id) BETWEEN 1 AND 128),
 CHECK (outlet_id IS NULL OR length(outlet_id) BETWEEN 1 AND 128)
);
ALTER TABLE account_workspace_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_workspace_preferences FORCE ROW LEVEL SECURITY;
CREATE POLICY account_preferences_select ON account_workspace_preferences FOR SELECT TO menuminute_app
 USING (user_id = NULLIF(current_setting('app.actor_id',true),''));
CREATE POLICY account_preferences_insert ON account_workspace_preferences FOR INSERT TO menuminute_app
 WITH CHECK (user_id = NULLIF(current_setting('app.actor_id',true),''));
CREATE POLICY account_preferences_update ON account_workspace_preferences FOR UPDATE TO menuminute_app
 USING (user_id = NULLIF(current_setting('app.actor_id',true),''))
 WITH CHECK (user_id = NULLIF(current_setting('app.actor_id',true),''));
GRANT SELECT,INSERT,UPDATE ON account_workspace_preferences TO menuminute_app;
REVOKE ALL ON account_workspace_preferences FROM PUBLIC,menuminute_worker;
