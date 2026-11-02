-- Live table signals, slice 5: "bill shown". Forward-only, after 0093.
-- Freezing a bill (pos finance "freeze") inserts the immutable pos_bills row. A trigger there records
-- bill_presented for the sale's table order, only while the outlet opted in and the POS source is on,
-- idempotently. No POS behaviour changes. Payment is already recorded by 0093's orders trigger.
-- Rollback: drop the trigger; ledger rows expire on their own.

CREATE FUNCTION app_private.pos_bill_signal() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE o orders%ROWTYPE; s floor_signal_settings%ROWTYPE;
BEGIN
  SELECT od.* INTO o FROM pos_sales ps
    JOIN orders od ON od.id=ps.order_id AND od.restaurant_id=ps.outlet_id
   WHERE ps.id=NEW.sale_id AND ps.outlet_id=NEW.outlet_id;
  IF NOT FOUND OR o.table_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO s FROM floor_signal_settings WHERE outlet_id=NEW.outlet_id;
  IF NOT FOUND OR NOT s.enabled OR NOT s.show_pos_bill THEN RETURN NEW; END IF;
  INSERT INTO table_signal_events(id,outlet_id,table_id,kind,source,ref_id,dedupe_key,occurred_at)
  VALUES(gen_random_uuid()::text,NEW.outlet_id,o.table_id,'bill_presented','pos',o.id,
         'ord:'||o.id||':bill_presented',NEW.created_at)
  ON CONFLICT (outlet_id,dedupe_key) DO NOTHING;
  RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION app_private.pos_bill_signal() FROM PUBLIC;
CREATE TRIGGER pos_bills_signal AFTER INSERT ON pos_bills
  FOR EACH ROW EXECUTE FUNCTION app_private.pos_bill_signal();
