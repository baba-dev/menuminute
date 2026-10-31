-- Ember: SECURITY DEFINER settlement/proposal functions must see their own tables.
--
-- assistant_conversations/turns/attempts/action_proposals use FORCE ROW LEVEL SECURITY with
-- policies written only TO menuminute_app. A SECURITY DEFINER function runs as its owner (the
-- migration owner). When that owner is a plain NOSUPERUSER/NOBYPASSRLS role, FORCE RLS applies
-- to it, no policy matches, and every function lookup sees zero rows:
-- ai_settle_model_spend() returned false ("Attempt already settled or inaccessible") after the
-- paid provider call, and the proposal functions could not find their conversations. CI uses a
-- superuser owner, which bypasses RLS, so tests did not catch it.
--
-- Grant the migration owner (CURRENT_USER while this file runs) a policy on exactly these four
-- tables. Web/worker roles are unaffected: no policy is added for them and their grants are
-- unchanged. Each function still enforces its own explicit organization/outlet/actor checks.
-- Rollback: DROP POLICY ai_definer_<table> ON <table> for each table (forward-only ledger;
-- ship a new migration to do so).
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY[
    'assistant_conversations','assistant_turns','assistant_attempts','assistant_action_proposals'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I','ai_definer_'||t,t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO CURRENT_USER USING (true) WITH CHECK (true)',
      'ai_definer_'||t,t);
  END LOOP;
END $$;
