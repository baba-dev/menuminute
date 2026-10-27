-- Timezone correctness: the JavaScript ICU list is not authority for PostgreSQL
-- order-day aggregation. Never change historic orders or business_date snapshots.
-- Only a known-equivalent legacy alias is repaired; unknown zones stop deployment.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.restaurants WHERE timezone = 'Asia/Calcutta') THEN
    -- Ensure the replacement works on this running PostgreSQL before writing anything.
    PERFORM clock_timestamp() AT TIME ZONE 'Asia/Kolkata';
    UPDATE public.restaurants
      SET timezone = 'Asia/Kolkata', updated_at = clock_timestamp()
      WHERE timezone = 'Asia/Calcutta';
  END IF;
END $$;

DO $$
DECLARE outlet_row record;
BEGIN
  FOR outlet_row IN SELECT timezone FROM public.restaurants LOOP
    BEGIN
      PERFORM clock_timestamp() AT TIME ZONE outlet_row.timezone;
    EXCEPTION WHEN invalid_parameter_value THEN
      RAISE EXCEPTION 'Unsupported existing outlet timezone. Review outlet data before installing guard.'
        USING ERRCODE = '22023';
    END;
  END LOOP;
END $$;

CREATE FUNCTION app_private.enforce_restaurant_timezone()
RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NEW.timezone IS NULL OR length(NEW.timezone) > 100
    OR NEW.timezone IN ('Asia/Calcutta', 'Europe/Kiev', 'US/Eastern', 'US/Pacific')
  THEN
    RAISE EXCEPTION 'Unsupported or legacy outlet timezone' USING ERRCODE = '22023';
  END IF;
  BEGIN
    PERFORM clock_timestamp() AT TIME ZONE NEW.timezone;
  EXCEPTION WHEN invalid_parameter_value THEN
    RAISE EXCEPTION 'Unsupported outlet timezone' USING ERRCODE = '22023';
  END;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION app_private.enforce_restaurant_timezone() FROM PUBLIC;
CREATE TRIGGER restaurants_valid_timezone
  BEFORE INSERT OR UPDATE OF timezone ON public.restaurants
  FOR EACH ROW EXECUTE FUNCTION app_private.enforce_restaurant_timezone();
