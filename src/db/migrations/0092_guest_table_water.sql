-- Live table signals, slice 3: the optional guest "Request water" button on table QR menus.
-- Forward-only, after 0091. A table-QR water request has no order yet, so guest_service_requests.order_id
-- becomes nullable (a water refill may exist without an order; other signals still need one).
-- Staff acknowledge/resolve with the existing staff_service_request_action, unchanged.
-- Signals are written by a trigger so they commit atomically with the request and the
-- order-bound and table-bound paths behave identically.
-- Rollback: stop calling the new functions; the trigger only writes while the outlet opted in.

ALTER TABLE guest_service_requests ALTER COLUMN order_id DROP NOT NULL;
ALTER TABLE guest_service_requests ADD COLUMN qr_id text REFERENCES qr_codes(id) ON DELETE SET NULL;
ALTER TABLE guest_service_requests ADD CONSTRAINT guest_service_requests_order_or_water
  CHECK (order_id IS NOT NULL OR signal='water_refill');
CREATE INDEX guest_service_requests_table_water
  ON guest_service_requests(outlet_id,table_id,requested_at DESC) WHERE signal='water_refill';

-- Order-less requests must still reach the staff queue.
CREATE OR REPLACE FUNCTION app_private.staff_service_requests(p_org text,p_outlet text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE result jsonb;
BEGIN
 IF current_setting('app.outlet_id',true) IS DISTINCT FROM p_outlet
 OR NOT app_private.can_outlet(p_outlet,'orders.read')
 OR NOT EXISTS(SELECT 1 FROM restaurants WHERE id=p_outlet AND organization_id=p_org AND is_active) THEN
   RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
 END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'id',q.id,'orderNumber',q.order_number,'tableNumber',q.table_number,
  'signal',q.signal,'status',q.status,'requestedAt',q.requested_at,
  'acknowledgedAt',q.acknowledged_at) ORDER BY q.requested_at DESC),'[]'::jsonb)
 INTO result FROM (
   SELECT s.id,o.order_number,t.table_number,s.signal,s.status,s.requested_at,s.acknowledged_at
   FROM guest_service_requests s
   LEFT JOIN orders o ON o.id=s.order_id AND o.restaurant_id=p_outlet
   JOIN restaurant_tables t ON t.id=s.table_id AND t.restaurant_id=p_outlet
   WHERE s.outlet_id=p_outlet AND s.organization_id=p_org
     AND s.status <> 'resolved'
   ORDER BY s.requested_at ASC LIMIT 100
 ) q;
 RETURN result;
END $fn$;

-- Ledger writer: only while the outlet opted in (and the relevant source is on).
CREATE FUNCTION app_private.guest_service_signal() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE k text; s floor_signal_settings%ROWTYPE;
BEGIN
  IF NEW.signal NOT IN ('water_refill','bill_request') THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' THEN
    k:=CASE NEW.signal WHEN 'water_refill' THEN 'water_requested' ELSE 'bill_requested' END;
  ELSIF NEW.signal='water_refill' AND NEW.status IS DISTINCT FROM OLD.status THEN
    k:=CASE NEW.status WHEN 'acknowledged' THEN 'water_acknowledged' WHEN 'resolved' THEN 'water_served' END;
  END IF;
  IF k IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO s FROM floor_signal_settings WHERE outlet_id=NEW.outlet_id;
  IF NOT FOUND OR NOT s.enabled
     OR (NEW.signal='water_refill' AND NOT s.guest_water_button)
     OR (NEW.signal='bill_request' AND NOT s.show_pos_bill) THEN
    RETURN NEW;
  END IF;
  INSERT INTO table_signal_events(id,outlet_id,table_id,kind,source,ref_id,dedupe_key)
  VALUES(gen_random_uuid()::text,NEW.outlet_id,NEW.table_id,k,
         CASE WHEN k IN ('water_acknowledged','water_served') THEN 'staff' ELSE 'guest' END,
         NEW.id,'svc:'||NEW.id||':'||k)
  ON CONFLICT (outlet_id,dedupe_key) DO NOTHING;
  RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION app_private.guest_service_signal() FROM PUBLIC;
CREATE TRIGGER guest_service_requests_signal AFTER INSERT OR UPDATE OF status ON guest_service_requests
  FOR EACH ROW EXECUTE FUNCTION app_private.guest_service_signal();

-- What the menu needs: is the water button on for this QR, and where is the latest request.
CREATE FUNCTION app_private.guest_table_service_state(p_token text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE q qr_codes%ROWTYPE; req guest_service_requests%ROWTYPE;
BEGIN
  IF p_token IS NULL OR char_length(p_token) NOT BETWEEN 12 AND 128 THEN
    RETURN jsonb_build_object('water',false,'request',NULL);
  END IF;
  SELECT c.* INTO q FROM qr_codes c
    JOIN restaurants r ON r.id=c.restaurant_id AND r.is_active
    JOIN organizations o ON o.id=r.organization_id AND o.is_active
   WHERE c.destination_token=p_token AND c.is_active AND c.table_id IS NOT NULL LIMIT 1;
  IF NOT FOUND
     OR NOT EXISTS(SELECT 1 FROM floor_signal_settings s
                    WHERE s.outlet_id=q.restaurant_id AND s.enabled AND s.guest_water_button)
     OR NOT EXISTS(SELECT 1 FROM restaurant_tables t
                    WHERE t.id=q.table_id AND t.restaurant_id=q.restaurant_id AND t.is_active) THEN
    RETURN jsonb_build_object('water',false,'request',NULL);
  END IF;
  SELECT * INTO req FROM guest_service_requests
   WHERE outlet_id=q.restaurant_id AND table_id=q.table_id AND signal='water_refill'
     AND (status<>'resolved' OR resolved_at > clock_timestamp()-interval '3 minutes')
     AND requested_at > clock_timestamp()-interval '30 minutes'
   ORDER BY requested_at DESC LIMIT 1;
  RETURN jsonb_build_object('water',true,'request',
    CASE WHEN FOUND THEN jsonb_build_object('status',req.status,'requestedAt',req.requested_at) END);
END $fn$;
REVOKE ALL ON FUNCTION app_private.guest_table_service_state(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.guest_table_service_state(text) TO menuminute_app;

-- The guest tap. One open request per table; a fresh one is allowed a minute after the last.
CREATE FUNCTION app_private.guest_table_water_request(p_token text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE q qr_codes%ROWTYPE; org text; prev guest_service_requests%ROWTYPE; rid text;
BEGIN
  IF p_token IS NULL OR char_length(p_token) NOT BETWEEN 12 AND 128 THEN
    RAISE EXCEPTION 'Water request unavailable' USING ERRCODE='42501';
  END IF;
  SELECT c.* INTO q FROM qr_codes c
    JOIN restaurants r ON r.id=c.restaurant_id AND r.is_active
    JOIN organizations o ON o.id=r.organization_id AND o.is_active
   WHERE c.destination_token=p_token AND c.is_active AND c.table_id IS NOT NULL LIMIT 1;
  IF NOT FOUND
     OR NOT EXISTS(SELECT 1 FROM floor_signal_settings s
                    WHERE s.outlet_id=q.restaurant_id AND s.enabled AND s.guest_water_button)
     OR NOT EXISTS(SELECT 1 FROM restaurant_tables t
                    WHERE t.id=q.table_id AND t.restaurant_id=q.restaurant_id AND t.is_active) THEN
    RAISE EXCEPTION 'Water request unavailable' USING ERRCODE='42501';
  END IF;
  SELECT organization_id INTO org FROM restaurants WHERE id=q.restaurant_id;
  -- Serialize taps for one table so concurrent requests cannot both insert.
  PERFORM pg_advisory_xact_lock(hashtextextended('water:'||q.table_id,0));
  SELECT * INTO prev FROM guest_service_requests
   WHERE outlet_id=q.restaurant_id AND table_id=q.table_id AND signal='water_refill'
     AND (status IN ('requested','acknowledged') OR requested_at > clock_timestamp()-interval '60 seconds')
   ORDER BY requested_at DESC LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('status',prev.status,'requestedAt',prev.requested_at,'debounced',true);
  END IF;
  rid:=gen_random_uuid()::text;
  INSERT INTO guest_service_requests(id,organization_id,outlet_id,order_id,table_id,signal,qr_id)
  VALUES(rid,org,q.restaurant_id,NULL,q.table_id,'water_refill',q.id);
  RETURN jsonb_build_object('status','requested','requestedAt',clock_timestamp(),'debounced',false);
END $fn$;
REVOKE ALL ON FUNCTION app_private.guest_table_water_request(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.guest_table_water_request(text) TO menuminute_app;
