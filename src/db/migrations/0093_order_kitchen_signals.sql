-- Live table signals, slice 4: order, kitchen and payment signals. Forward-only, after 0092.
-- Every order status change already writes order_status_events (orders, kitchen, POS and expo paths),
-- so one trigger there covers all producers atomically without touching their code. A second trigger
-- records payment. Both write the ledger only while the outlet opted in (and the relevant source is on),
-- only for orders at a table, and idempotently. Nothing about orders, kitchen or POS behaviour changes.
-- Rollback: drop the two triggers; ledger rows expire on their own.

CREATE FUNCTION app_private.order_status_signal() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE k text; src text; o orders%ROWTYPE; s floor_signal_settings%ROWTYPE;
BEGIN
  k:=CASE NEW.to_status
    WHEN 'pending' THEN 'order_placed'
    WHEN 'accepted' THEN 'order_accepted'
    WHEN 'preparing' THEN 'kitchen_preparing'
    WHEN 'ready' THEN 'kitchen_ready'
    WHEN 'served' THEN 'order_served'
    WHEN 'delivered' THEN 'order_served'
    WHEN 'collected' THEN 'order_served'
  END;
  IF k IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO o FROM orders WHERE id=NEW.order_id AND restaurant_id=NEW.restaurant_id;
  IF NOT FOUND OR o.table_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO s FROM floor_signal_settings WHERE outlet_id=NEW.restaurant_id;
  IF NOT FOUND OR NOT s.enabled OR (k IN ('kitchen_preparing','kitchen_ready') AND NOT s.show_kitchen) THEN
    RETURN NEW;
  END IF;
  src:=CASE WHEN k LIKE 'kitchen_%' THEN 'kitchen' ELSE 'orders' END;
  INSERT INTO table_signal_events(id,outlet_id,table_id,kind,source,ref_id,dedupe_key,occurred_at)
  VALUES(gen_random_uuid()::text,NEW.restaurant_id,o.table_id,k,src,NEW.order_id,
         'ord:'||NEW.order_id||':'||k,NEW.created_at)
  ON CONFLICT (outlet_id,dedupe_key) DO NOTHING;
  RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION app_private.order_status_signal() FROM PUBLIC;
CREATE TRIGGER order_status_events_signal AFTER INSERT ON order_status_events
  FOR EACH ROW EXECUTE FUNCTION app_private.order_status_signal();

CREATE FUNCTION app_private.order_paid_signal() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE s floor_signal_settings%ROWTYPE;
BEGIN
  IF NEW.table_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO s FROM floor_signal_settings WHERE outlet_id=NEW.restaurant_id;
  IF NOT FOUND OR NOT s.enabled OR NOT s.show_pos_bill THEN RETURN NEW; END IF;
  INSERT INTO table_signal_events(id,outlet_id,table_id,kind,source,ref_id,dedupe_key)
  VALUES(gen_random_uuid()::text,NEW.restaurant_id,NEW.table_id,'paid','pos',NEW.id,'ord:'||NEW.id||':paid')
  ON CONFLICT (outlet_id,dedupe_key) DO NOTHING;
  RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION app_private.order_paid_signal() FROM PUBLIC;
CREATE TRIGGER orders_paid_signal AFTER UPDATE OF payment_status ON orders
  FOR EACH ROW WHEN (NEW.payment_status='paid' AND OLD.payment_status IS DISTINCT FROM 'paid')
  EXECUTE FUNCTION app_private.order_paid_signal();
