-- Report-specific indexes support outlet-scoped aggregation without widening any RLS grants.
-- Small, additive B-tree indexes; never modify a previous applied migration.
CREATE INDEX IF NOT EXISTS orders_outlet_business_date_report_idx
  ON orders(restaurant_id,business_date) WHERE business_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS pos_tenders_outlet_time_report_idx
  ON pos_tenders(outlet_id,created_at);
CREATE INDEX IF NOT EXISTS pos_refunds_outlet_time_report_idx
  ON pos_refunds(outlet_id,created_at);
CREATE INDEX IF NOT EXISTS kitchen_work_outlet_completed_report_idx
  ON kitchen_work(outlet_id,created_at) WHERE status='complete';
