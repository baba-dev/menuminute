-- POS 2.0 A: immutable, trusted intake classification; no finance or kitchen gate changes.
ALTER TABLE orders ADD COLUMN intake_source text NOT NULL DEFAULT 'unknown'
  CHECK(intake_source IN ('unknown','staff_pos','guest_menu','online'));

-- Existing POS sales unambiguously identify staff-entry orders; customer tracking
-- identifies guest-menu submissions. Unprovable legacy origins remain unknown.
UPDATE orders o SET intake_source='staff_pos'
WHERE EXISTS (SELECT 1 FROM pos_sales s WHERE s.outlet_id=o.restaurant_id
  AND s.order_id=o.id AND s.origin='staff');
UPDATE orders SET intake_source='guest_menu'
WHERE intake_source='unknown' AND tracking_token IS NOT NULL;

CREATE FUNCTION app_private.order_trusted_intake_source() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  IF TG_OP='UPDATE' THEN
    IF NEW.intake_source IS DISTINCT FROM OLD.intake_source THEN
      RAISE EXCEPTION 'Order intake source is immutable' USING ERRCODE='42501';
    END IF;
  ELSE
    -- A browser cannot select this value; source derives from trusted server context.
    NEW.intake_source := CASE
      WHEN NEW.tracking_token IS NOT NULL THEN 'guest_menu'
      WHEN NULLIF(current_setting('app.actor_id',true),'') IS NOT NULL THEN 'staff_pos'
      ELSE 'unknown'
    END;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app_private.order_trusted_intake_source() FROM PUBLIC;
CREATE TRIGGER orders_trusted_intake_source
BEFORE INSERT OR UPDATE OF intake_source ON orders
FOR EACH ROW EXECUTE FUNCTION app_private.order_trusted_intake_source();

CREATE INDEX orders_pos_intake_scope ON orders(restaurant_id,intake_source,created_at DESC,id DESC);
