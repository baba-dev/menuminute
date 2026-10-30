-- POS #142 E: read-only fiscal preparation contract; NEVER authorizes invoice issuance.
-- Existing permanent pos_jurisdiction_guard remains unchanged and fail-closed.
CREATE FUNCTION app_private.pos_fiscal_readiness(p_outlet text,p_sale text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_sale pos_sales%ROWTYPE;v_bill pos_bills%ROWTYPE;
 v_gate pos_finance_gates%ROWTYPE;v_seller pos_seller_profiles%ROWTYPE;
 v_restaurant restaurants%ROWTYPE;
BEGIN
 IF NOT app_private.pos_access(p_outlet,'document')
   OR current_setting('app.outlet_id',true) IS DISTINCT FROM p_outlet
 THEN RAISE EXCEPTION 'Fiscal review access denied' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_sale FROM pos_sales WHERE outlet_id=p_outlet AND id=p_sale;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sale unavailable' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_bill FROM pos_bills WHERE outlet_id=p_outlet AND sale_id=p_sale;
 SELECT * INTO v_gate FROM pos_finance_gates WHERE outlet_id=p_outlet;
 SELECT * INTO v_seller FROM pos_seller_profiles WHERE outlet_id=p_outlet;
 SELECT * INTO v_restaurant FROM restaurants WHERE id=p_outlet AND is_active;
 IF NOT FOUND THEN RAISE EXCEPTION 'Outlet unavailable' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object(
  'saleId',p_sale,'outletId',p_outlet,
  'country',v_restaurant.country,'currency',v_sale.currency,
  'sellerCountry',COALESCE(v_seller.country,''),
  'sellerRegime',COALESCE(v_seller.tax_regime,'unconfigured'),
  'sellerName',COALESCE(v_bill.seller_snapshot->>'legalName',v_seller.legal_name,''),
  'sellerAddress',COALESCE(v_bill.seller_snapshot->>'registeredAddress',v_seller.registered_address,''),
  'sellerTaxRegistration',COALESCE(v_bill.seller_snapshot->>'taxRegistration',v_seller.tax_registration,''),
  'customer',COALESCE(v_bill.customer_snapshot,'{}'::jsonb),
  'lines',COALESCE(v_bill.line_snapshot,'[]'::jsonb),
  'billFrozen',v_bill.sale_id IS NOT NULL,
  'billCurrency',v_bill.currency,
  'billTaxMode',v_bill.tax_mode,
  'taxMinor',COALESCE(v_bill.tax_minor,0)::text,
  'taxableBaseMinor',COALESCE(v_bill.taxable_base_minor,0)::text,
  'totalMinor',COALESCE(v_bill.total_minor,0)::text,
  'taxProfileRevision',v_bill.tax_profile_revision,
  'jurisdictionPolicy',COALESCE(v_gate.jurisdiction_policy,'non_registered_receipt_v1'),
  'operatorFiscalApproved',COALESCE(v_gate.fiscal_approved,false),
  'operatorDocumentsEnabled',COALESCE(v_gate.documents_enabled,false),
  'externalAdapterInstalled',false,
  'irpIntegrationVerified',false,
  'statutoryIssuanceAllowed',false
 );
END $$;
REVOKE ALL ON FUNCTION app_private.pos_fiscal_readiness(text,text) FROM PUBLIC,menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.pos_fiscal_readiness(text,text) TO menuminute_app;
