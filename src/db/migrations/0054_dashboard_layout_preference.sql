-- Dashboard delight: per-account overview layout (order, hidden, pinned widgets).
-- Expand-only. A presentation preference, never an authorization input. Existing
-- row-level security (user_id = app.actor_id) and table grants already cover the column.
ALTER TABLE account_workspace_preferences
  ADD COLUMN IF NOT EXISTS dashboard_layout jsonb;
ALTER TABLE account_workspace_preferences
  DROP CONSTRAINT IF EXISTS account_preferences_dashboard_layout_shape;
ALTER TABLE account_workspace_preferences
  ADD CONSTRAINT account_preferences_dashboard_layout_shape CHECK (
    dashboard_layout IS NULL
    OR (jsonb_typeof(dashboard_layout) = 'object' AND pg_column_size(dashboard_layout) <= 2048)
  );
