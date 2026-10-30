-- POS #142 G: protected, bounded, tenant-scoped Ledger pagination.
-- No direct table grants, order changes, or finance activation.
CREATE FUNCTION app_private.pos_ledger_page(
  p_outlet text,p_cursor_at timestamptz DEFAULT NULL,
  p_cursor_id text DEFAULT NULL,p_limit integer DEFAULT 50
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_result jsonb;v_has_more boolean;v_next_at timestamptz;v_next_id text;v_count integer;
BEGIN
 IF NOT app_private.pos_access(p_outlet,'ledger')
    OR current_setting('app.outlet_id',true) IS DISTINCT FROM p_outlet
 THEN RAISE EXCEPTION 'Ledger access denied' USING ERRCODE='42501'; END IF;
 IF p_limit IS NULL OR p_limit<1 OR p_limit>100
    OR (p_cursor_at IS NULL) <> (p_cursor_id IS NULL)
    OR (p_cursor_id IS NOT NULL AND length(p_cursor_id)>128)
 THEN RAISE EXCEPTION 'Invalid ledger page' USING ERRCODE='22023'; END IF;
 WITH candidates AS MATERIALIZED (
  SELECT id,created_at FROM pos_sales s WHERE s.outlet_id=p_outlet
    AND (p_cursor_at IS NULL OR (s.created_at,s.id)<(p_cursor_at,p_cursor_id))
  ORDER BY s.created_at DESC,s.id DESC LIMIT (p_limit+1)
 ), page AS MATERIALIZED (
  SELECT * FROM candidates ORDER BY created_at DESC,id DESC LIMIT p_limit
 ), rows AS (
  SELECT s.id,s.created_at,jsonb_build_object(
    'saleId',s.id,'orderId',s.order_id,'currency',s.currency,
    'subtotalMinor',s.subtotal_minor::text,
    'totalMinor',b.total_minor::text,'taxMinor',b.tax_minor::text,
    'paidMinor',(COALESCE(a.amount_minor,0)+COALESCE((
      SELECT sum(t.amount_minor) FROM pos_tenders t
      WHERE t.outlet_id=p_outlet AND t.sale_id=s.id
    ),0))::text,
    'refundedMinor',(COALESCE(sf.amount_minor,0)+COALESCE((
      SELECT sum(f.amount_minor) FROM pos_refunds f
      WHERE f.outlet_id=p_outlet AND f.sale_id=s.id
    ),0))::text,
    'paymentEvidence',CASE WHEN a.sale_id IS NOT NULL THEN 'staff_recorded'
      WHEN EXISTS (SELECT 1 FROM pos_tenders t WHERE t.outlet_id=p_outlet
        AND t.sale_id=s.id AND t.evidence='provider_confirmed') THEN 'provider_confirmed'
      WHEN EXISTS(SELECT 1 FROM pos_tenders t WHERE t.outlet_id=p_outlet
        AND t.sale_id=s.id) THEN 'finance_recorded' ELSE 'none' END,
    'staffRefunded',sf.sale_id IS NOT NULL,
    'documentNumber',(SELECT d.document_number FROM pos_documents d
      WHERE d.outlet_id=p_outlet AND d.sale_id=s.id
      AND d.kind IN ('receipt','invoice') LIMIT 1),
    'createdAt',s.created_at
  ) AS data
  FROM page p JOIN pos_sales s ON s.outlet_id=p_outlet AND s.id=p.id
  LEFT JOIN pos_bills b ON b.outlet_id=p_outlet AND b.sale_id=s.id
  LEFT JOIN pos_staff_payment_attestations a ON a.outlet_id=p_outlet AND a.sale_id=s.id
  LEFT JOIN pos_staff_refunds sf ON sf.outlet_id=p_outlet AND sf.sale_id=s.id
 )
 SELECT COALESCE((SELECT jsonb_agg(data ORDER BY created_at DESC,id DESC) FROM rows),'[]'::jsonb),
   EXISTS(SELECT 1 FROM candidates OFFSET p_limit LIMIT 1),
   (SELECT created_at FROM page ORDER BY created_at,id LIMIT 1),
   (SELECT id FROM page ORDER BY created_at,id LIMIT 1),
   (SELECT count(*)::integer FROM page)
 INTO v_result,v_has_more,v_next_at,v_next_id,v_count;
 RETURN jsonb_build_object('items',v_result,'pageCount',v_count,
   'hasMore',v_has_more,
   'nextCursorAt',CASE WHEN v_has_more THEN v_next_at ELSE NULL END,
   'nextCursorId',CASE WHEN v_has_more THEN v_next_id ELSE NULL END,
   'isFullHistoryExport',false);
END $$;
REVOKE ALL ON FUNCTION app_private.pos_ledger_page(text,timestamptz,text,integer)
  FROM PUBLIC,menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.pos_ledger_page(text,timestamptz,text,integer)
  TO menuminute_app;
