-- PR 1 / O-2: remove the per-submission scan of an outlet's order history.
-- Migration owner only. Applied as one transaction by scripts/migration-runner.ts.
-- Preserve counters that are already higher than the persisted historical maximum.
-- Serialize with writes while taking the one-time history snapshot.
SET LOCAL lock_timeout = '5s';
LOCK TABLE app_private.order_counters IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.orders IN SHARE ROW EXCLUSIVE MODE;

INSERT INTO app_private.order_counters (restaurant_id, business_date, last_order_number)
SELECT restaurant_id, business_date, MAX(order_number)
FROM public.orders
WHERE business_date IS NOT NULL
GROUP BY restaurant_id, business_date
ON CONFLICT (restaurant_id, business_date) DO UPDATE
SET last_order_number = GREATEST(
  app_private.order_counters.last_order_number,
  EXCLUDED.last_order_number
);

CREATE OR REPLACE FUNCTION app_private.next_order_number(
  p_restaurant_id text,
  p_business_date date
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_num integer;
BEGIN
  IF p_restaurant_id IS NULL OR p_business_date IS NULL THEN
    RAISE EXCEPTION 'Invalid order sequence scope' USING ERRCODE = '22023';
  END IF;
  INSERT INTO app_private.order_counters (
    restaurant_id, business_date, last_order_number
  )
  VALUES (p_restaurant_id, p_business_date, 1)
  ON CONFLICT (restaurant_id, business_date)
  DO UPDATE SET last_order_number = app_private.order_counters.last_order_number + 1
  RETURNING last_order_number INTO v_num;
  RETURN v_num;
END
$$;
REVOKE ALL ON FUNCTION app_private.next_order_number(text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.next_order_number(text, date) TO menuminute_app;
