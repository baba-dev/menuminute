-- Manager-scoped kitchen operations analytics; no runtime direct table grants.
CREATE FUNCTION app_private.reports_kitchen_snapshot(p_outlet text,p_from date,p_to date,p_mode text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_timezone text;
BEGIN
 IF current_setting('app.outlet_id',true) IS DISTINCT FROM p_outlet OR
   NOT app_private.can_outlet(p_outlet,'orders.read') OR p_from IS NULL OR p_to IS NULL OR
   p_to<p_from OR p_to-p_from>366 OR p_mode NOT IN ('all','dine_in','pickup')
 THEN RAISE EXCEPTION 'Invalid kitchen reporting scope' USING ERRCODE='42501'; END IF;
 IF NOT app_private.can_outlet(p_outlet,'outlet.manage') THEN
   RETURN jsonb_build_object('available',false);
 END IF;
 SELECT timezone INTO v_timezone FROM restaurants WHERE id=p_outlet AND is_active;
 IF v_timezone IS NULL THEN RAISE EXCEPTION 'Outlet unavailable' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object(
  'available',true,
  'totalTickets',(
    SELECT count(DISTINCT w.order_id)::int FROM kitchen_work w JOIN orders o
      ON o.id=w.order_id AND o.restaurant_id=w.outlet_id
    WHERE w.outlet_id=p_outlet AND w.status='complete'
      AND (w.created_at AT TIME ZONE v_timezone)::date BETWEEN p_from AND p_to
      AND (p_mode='all' OR o.fulfillment_mode=p_mode)
  ),
  'summary',COALESCE((
    SELECT row_to_json(q)::jsonb FROM (
      SELECT count(*)::int work_units,
        COALESCE(round(avg(extract(epoch FROM (w.updated_at-w.created_at))/60.0)::numeric,1),0) avg_prep,
        COALESCE(round((percentile_cont(0.5) WITHIN GROUP
          (ORDER BY extract(epoch FROM (w.updated_at-w.created_at))/60.0))::numeric,1),0) median_prep,
        count(*) FILTER (WHERE extract(epoch FROM (w.updated_at-w.created_at))<720)::int fast_count,
        count(*) FILTER (WHERE extract(epoch FROM (w.updated_at-w.created_at))>=720 AND extract(epoch FROM (w.updated_at-w.created_at))<=1320)::int standard_count,
        count(*) FILTER (WHERE extract(epoch FROM (w.updated_at-w.created_at))>1320)::int delayed_count
      FROM kitchen_work w JOIN orders o ON o.id=w.order_id AND o.restaurant_id=w.outlet_id
      WHERE w.outlet_id=p_outlet AND w.status='complete'
       AND (w.created_at AT TIME ZONE v_timezone)::date BETWEEN p_from AND p_to
       AND (p_mode='all' OR o.fulfillment_mode=p_mode)
    ) q
  ),'{}'::jsonb),
  'stations',COALESCE((
    SELECT jsonb_agg(jsonb_build_object('stationId',q.station_id,'stationName',q.name,
      'ticketsHandled',q.work_units,'avgPrepMinutes',q.avg_minutes) ORDER BY q.name)
    FROM (
      SELECT w.station_id,COALESCE(s.name,'Former station') name,count(*)::int work_units,
       round(avg(extract(epoch FROM (w.updated_at-w.created_at))/60.0)::numeric,1) avg_minutes
      FROM kitchen_work w JOIN orders o ON o.id=w.order_id AND o.restaurant_id=w.outlet_id
       LEFT JOIN kitchen_stations s ON s.id=w.station_id AND s.outlet_id=w.outlet_id
      WHERE w.outlet_id=p_outlet AND w.status='complete'
       AND (w.created_at AT TIME ZONE v_timezone)::date BETWEEN p_from AND p_to
       AND (p_mode='all' OR o.fulfillment_mode=p_mode)
      GROUP BY w.station_id,s.name
    ) q
  ),'[]'::jsonb),
  'hourlyBottlenecks',COALESCE((
    SELECT jsonb_agg(jsonb_build_object('hour',q.hr,'label',lpad(q.hr::text,2,'0')||':00',
      'ticketCount',q.ticket_count,'avgPrepMinutes',q.avg_minutes) ORDER BY q.hr)
    FROM (
      SELECT extract(hour from (w.created_at AT TIME ZONE v_timezone))::int hr,
        count(DISTINCT w.order_id)::int ticket_count,
        round(avg(extract(epoch FROM (w.updated_at-w.created_at))/60.0)::numeric,1) avg_minutes
      FROM kitchen_work w JOIN orders o ON o.id=w.order_id AND o.restaurant_id=w.outlet_id
      WHERE w.outlet_id=p_outlet AND w.status='complete'
       AND (w.created_at AT TIME ZONE v_timezone)::date BETWEEN p_from AND p_to
       AND (p_mode='all' OR o.fulfillment_mode=p_mode)
      GROUP BY hr
    ) q
  ),'[]'::jsonb)
 );
END $$;
REVOKE ALL ON FUNCTION app_private.reports_kitchen_snapshot(text,date,date,text) FROM PUBLIC,menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.reports_kitchen_snapshot(text,date,date,text) TO menuminute_app;
