-- 0106 India GST statutory document ledger foundation, NOT commercial activation.
-- A prior 0052 readiness diagnostic and PR #318 remain informational only.
-- This migration creates no payable document and does not change POS staff workflows.
-- Sensitive legal issuance tables are private, RLS-enabled, with no app/worker/billing grants.
CREATE TABLE app_private.india_gst_operator_releases (
  organization_id text NOT NULL,
  outlet_id text PRIMARY KEY,
  supplier_gstin text NOT NULL CHECK (supplier_gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  legal_signoff boolean NOT NULL DEFAULT false,
  finance_signoff boolean NOT NULL DEFAULT false,
  jurisdiction_verified boolean NOT NULL DEFAULT false,
  irp_applicability_verified boolean NOT NULL DEFAULT false,
  adapter_verified boolean NOT NULL DEFAULT false,
  signing_verified boolean NOT NULL DEFAULT false,
  printer_acceptance boolean NOT NULL DEFAULT false,
  release_enabled boolean NOT NULL DEFAULT false,
  approved_at timestamptz,
  approved_by text REFERENCES users(id),
  policy_revision integer NOT NULL DEFAULT 1 CHECK (policy_revision > 0),
  FOREIGN KEY(organization_id,outlet_id) REFERENCES restaurants(organization_id,id),
  CONSTRAINT india_gst_requires_complete_release CHECK (
    NOT release_enabled OR (
      legal_signoff AND finance_signoff AND jurisdiction_verified
      AND irp_applicability_verified AND adapter_verified AND signing_verified
      AND printer_acceptance AND approved_at IS NOT NULL AND approved_by IS NOT NULL
    )
  )
);
CREATE UNIQUE INDEX india_gst_release_gstin_scope
  ON app_private.india_gst_operator_releases(outlet_id,supplier_gstin);
COMMENT ON TABLE app_private.india_gst_operator_releases IS
 'Operator-held legal/fiscal release conditions; merchant roles cannot change them. Default off.';

-- One sequence across EVERY outlet using the same GSTIN and invoice series.
-- Fiscal years begin on April 1 in India. The registered entity, not the outlet,
-- determines the identity of a statutory numbering series.
CREATE TABLE app_private.india_gst_serial_counters (
  supplier_gstin text NOT NULL CHECK (supplier_gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  fiscal_year_start integer NOT NULL CHECK(fiscal_year_start BETWEEN 2017 AND 2100),
  series_prefix text NOT NULL CHECK (series_prefix ~ '^[A-Z0-9]{1,6}$'),
  last_serial integer NOT NULL DEFAULT 0 CHECK(last_serial BETWEEN 0 AND 999999),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(supplier_gstin,fiscal_year_start,series_prefix)
);
COMMENT ON TABLE app_private.india_gst_serial_counters IS
 'Cross-outlet GSTIN/FY/series serialized allocator; no app role can invoke it.';

CREATE TABLE app_private.india_gst_statutory_records (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL,
  outlet_id text NOT NULL,
  sale_id text NOT NULL,
  supplier_gstin text NOT NULL CHECK (supplier_gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  fiscal_year_start integer NOT NULL CHECK (fiscal_year_start BETWEEN 2017 AND 2100),
  series_prefix text NOT NULL CHECK(series_prefix ~ '^[A-Z0-9]{1,6}$'),
  serial integer NOT NULL CHECK(serial BETWEEN 1 AND 999999),
  document_number text NOT NULL CHECK (
    length(document_number) BETWEEN 7 AND 16
    AND document_number ~ '^[A-Z0-9/-]{7,16}$'
  ),
  kind text NOT NULL CHECK(kind IN ('tax_invoice','bill_of_supply','credit_note','debit_note')),
  source_document_id text,
  currency text NOT NULL DEFAULT 'INR' CHECK(currency='INR'),
  taxable_minor bigint NOT NULL CHECK(taxable_minor BETWEEN 0 AND 2147483647),
  tax_minor bigint NOT NULL CHECK(tax_minor BETWEEN 0 AND 2147483647),
  total_minor bigint NOT NULL CHECK(total_minor BETWEEN 0 AND 2147483647),
  policy_revision integer NOT NULL CHECK(policy_revision > 0),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot)='object'),
  snapshot_sha256 text NOT NULL CHECK(snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  irp_required boolean NOT NULL,
  irn text,
  irp_acknowledged_at timestamptz,
  irp_signed_evidence_hash text,
  issued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  issued_by text NOT NULL REFERENCES users(id),
  FOREIGN KEY(organization_id,outlet_id) REFERENCES restaurants(organization_id,id),
  FOREIGN KEY(outlet_id,sale_id) REFERENCES pos_sales(outlet_id,id),
  FOREIGN KEY(outlet_id,source_document_id) REFERENCES app_private.india_gst_statutory_records(outlet_id,id),
  FOREIGN KEY(supplier_gstin,fiscal_year_start,series_prefix)
    REFERENCES app_private.india_gst_serial_counters(supplier_gstin,fiscal_year_start,series_prefix),
  UNIQUE(outlet_id,id),
  UNIQUE(supplier_gstin,id),
  UNIQUE(supplier_gstin,fiscal_year_start,document_number),
  UNIQUE(supplier_gstin,fiscal_year_start,series_prefix,serial),
  CONSTRAINT india_gst_note_requires_origin CHECK (
     (kind IN ('tax_invoice','bill_of_supply') AND source_document_id IS NULL)
     OR (kind IN ('credit_note','debit_note') AND source_document_id IS NOT NULL)
  ),
  CONSTRAINT india_gst_balance CHECK (taxable_minor+tax_minor=total_minor),
  CONSTRAINT india_gst_bill_of_supply_no_gst CHECK(kind<>'bill_of_supply' OR tax_minor=0),
  CONSTRAINT india_gst_irp_fields CHECK(
    (irp_required AND irn ~ '^[a-fA-F0-9]{64}$'
      AND irp_acknowledged_at IS NOT NULL
      AND irp_signed_evidence_hash ~ '^[0-9a-f]{64}$')
    OR (NOT irp_required AND irn IS NULL AND irp_acknowledged_at IS NULL
       AND irp_signed_evidence_hash IS NULL)
  )
);
CREATE UNIQUE INDEX india_gst_one_original_per_sale
  ON app_private.india_gst_statutory_records(outlet_id,sale_id)
  WHERE kind IN ('tax_invoice','bill_of_supply');
CREATE INDEX india_gst_records_issued_at
  ON app_private.india_gst_statutory_records(outlet_id,issued_at DESC);
CREATE INDEX india_gst_records_source
  ON app_private.india_gst_statutory_records(outlet_id,source_document_id)
  WHERE source_document_id IS NOT NULL;

-- IRP attempts are append-only for audited, uncertain network outcomes.
-- An attempt may not be represented as an acknowledgement by an app user.
CREATE TABLE app_private.india_gst_irp_audit (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  document_id text NOT NULL,
  supplier_gstin text NOT NULL,
  attempt_key text NOT NULL CHECK(attempt_key ~ '^[0-9a-f]{64}$'),
  event_kind text NOT NULL CHECK(event_kind IN (
     'prepared','submitted','uncertain','rejected','verified_ack','cancelled'
  )),
  request_digest text NOT NULL CHECK(request_digest ~ '^[0-9a-f]{64}$'),
  response_digest text CHECK(response_digest ~ '^[0-9a-f]{64}$'),
  verified_signature boolean NOT NULL DEFAULT false,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(supplier_gstin,document_id)
    REFERENCES app_private.india_gst_statutory_records(supplier_gstin,id),
  UNIQUE(document_id,attempt_key,event_kind),
  CONSTRAINT india_gst_no_unverified_ack CHECK(event_kind<>'verified_ack' OR
    (verified_signature AND response_digest IS NOT NULL))
);
CREATE INDEX india_gst_irp_doc_time ON app_private.india_gst_irp_audit(document_id,occurred_at,id);

-- Definer-only denial at the final financial boundary. Activation MUST be
-- separately approved; changing a merchant configuration never grants issue rights.
CREATE FUNCTION app_private.india_gst_record_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE g app_private.india_gst_operator_releases%ROWTYPE;
  orig app_private.india_gst_statutory_records%ROWTYPE;
  v_frozen pos_bills%ROWTYPE;
  v_date date := (clock_timestamp() AT TIME ZONE 'Asia/Kolkata')::date;
  v_fy integer := CASE WHEN extract(month FROM (clock_timestamp() AT TIME ZONE 'Asia/Kolkata')) >= 4
    THEN extract(year FROM (clock_timestamp() AT TIME ZONE 'Asia/Kolkata'))::integer
    ELSE extract(year FROM (clock_timestamp() AT TIME ZONE 'Asia/Kolkata'))::integer-1 END;
BEGIN
 IF TG_OP <> 'INSERT' THEN
   RAISE EXCEPTION 'GST statutory records are immutable' USING ERRCODE='42501';
 END IF;
 SELECT * INTO g FROM app_private.india_gst_operator_releases
  WHERE outlet_id=NEW.outlet_id AND organization_id=NEW.organization_id
    AND supplier_gstin=NEW.supplier_gstin AND release_enabled FOR SHARE;
 IF NOT FOUND OR NOT g.legal_signoff OR NOT g.finance_signoff
   OR NOT g.jurisdiction_verified OR NOT g.irp_applicability_verified
   OR NOT g.adapter_verified OR NOT g.signing_verified OR NOT g.printer_acceptance
 THEN RAISE EXCEPTION 'GST statutory issuance is not approved' USING ERRCODE='42501'; END IF;
 IF NEW.fiscal_year_start<>v_fy OR
   NEW.document_number IS DISTINCT FROM
     (NEW.series_prefix||'/'||right(NEW.fiscal_year_start::text,2)||'/'||lpad(NEW.serial::text,6,'0'))
 THEN RAISE EXCEPTION 'Invalid Indian financial-year serial' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_frozen FROM pos_bills
   WHERE outlet_id=NEW.outlet_id AND sale_id=NEW.sale_id;
 IF NOT FOUND OR v_frozen.currency<>'INR'
    OR NEW.kind IN ('tax_invoice','bill_of_supply') AND
       (v_frozen.taxable_base_minor<>NEW.taxable_minor
        OR v_frozen.tax_minor<>NEW.tax_minor
        OR v_frozen.total_minor<>NEW.total_minor
        OR v_frozen.tax_profile_revision<>NEW.policy_revision)
 THEN RAISE EXCEPTION 'Frozen bill does not match statutory record' USING ERRCODE='22023'; END IF;
 IF NEW.kind IN ('credit_note','debit_note') THEN
   SELECT * INTO orig FROM app_private.india_gst_statutory_records
    WHERE id=NEW.source_document_id AND outlet_id=NEW.outlet_id
      AND supplier_gstin=NEW.supplier_gstin FOR UPDATE;
   -- Serialize every credit linked to the original document, so concurrent
   -- cashiers cannot collectively credit more than the original liability.
   IF NOT FOUND OR orig.kind NOT IN ('tax_invoice','bill_of_supply') OR
     orig.sale_id<>NEW.sale_id
   THEN RAISE EXCEPTION 'Invalid original statutory document'
      USING ERRCODE='22023'; END IF;
   IF NEW.kind='credit_note' AND
      COALESCE((SELECT sum(total_minor)
        FROM app_private.india_gst_statutory_records
        WHERE source_document_id=orig.id AND kind='credit_note'),0)
      + NEW.total_minor > orig.total_minor
   THEN RAISE EXCEPTION 'Cumulative credit exceeds original statutory value'
      USING ERRCODE='22023'; END IF;
 END IF;
 -- Issuer must explicitly reconcile the fiscal source, not infer legitimacy
 -- merely from an ordinary POS receipt or customer cash attestation.
 IF NOT EXISTS(SELECT 1 FROM pos_seller_profiles
      WHERE outlet_id=NEW.outlet_id AND country='IN'
      AND tax_regime='requires_review' AND tax_registration=NEW.supplier_gstin)
 THEN RAISE EXCEPTION 'GST supplier identity unverified' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER india_gst_record_insert_guard
 BEFORE INSERT OR UPDATE OR DELETE ON app_private.india_gst_statutory_records
 FOR EACH ROW EXECUTE FUNCTION app_private.india_gst_record_guard();

CREATE FUNCTION app_private.india_gst_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN RAISE EXCEPTION 'GST legal audit records are immutable' USING ERRCODE='42501'; END $$;
CREATE TRIGGER india_gst_irp_audit_immutable BEFORE UPDATE OR DELETE
  ON app_private.india_gst_irp_audit
  FOR EACH ROW EXECUTE FUNCTION app_private.india_gst_immutable();

CREATE FUNCTION app_private.india_gst_fy_start(p_date date)
RETURNS integer LANGUAGE sql IMMUTABLE STRICT
SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT CASE WHEN extract(month FROM p_date)>=4
   THEN extract(year FROM p_date)::integer
   ELSE extract(year FROM p_date)::integer-1 END
$$;

-- No menuminute role receives EXECUTE. This is NOT a public API; a future,
-- reviewed, trusted issuer must call this inside the same transaction as
-- the statutory record insert and verified IRP evidence persistence.
CREATE FUNCTION app_private.india_gst_allocate_serial(
  p_outlet text,p_gstin text,p_prefix text,p_issue_date date
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE gate app_private.india_gst_operator_releases%ROWTYPE;
 v_fy integer; v_serial integer;
BEGIN
 SELECT * INTO gate FROM app_private.india_gst_operator_releases
 WHERE outlet_id=p_outlet AND supplier_gstin=p_gstin AND release_enabled FOR SHARE;
 IF NOT FOUND OR NOT (gate.legal_signoff AND gate.finance_signoff
    AND gate.jurisdiction_verified AND gate.irp_applicability_verified
    AND gate.adapter_verified AND gate.signing_verified AND gate.printer_acceptance)
 THEN RAISE EXCEPTION 'GST allocation is not approved' USING ERRCODE='42501'; END IF;
 IF p_prefix !~ '^[A-Z0-9]{1,6}$' OR p_issue_date IS DISTINCT FROM
    (clock_timestamp() AT TIME ZONE 'Asia/Kolkata')::date
 THEN RAISE EXCEPTION 'Invalid fiscal series or backdated allocation'
  USING ERRCODE='22023'; END IF;
 v_fy := app_private.india_gst_fy_start(p_issue_date);
 INSERT INTO app_private.india_gst_serial_counters(
   supplier_gstin,fiscal_year_start,series_prefix,last_serial)
 VALUES(p_gstin,v_fy,p_prefix,1)
 ON CONFLICT(supplier_gstin,fiscal_year_start,series_prefix)
 DO UPDATE SET last_serial=app_private.india_gst_serial_counters.last_serial+1,
               updated_at=clock_timestamp()
 WHERE app_private.india_gst_serial_counters.last_serial<999999
 RETURNING last_serial INTO v_serial;
 IF v_serial IS NULL THEN RAISE EXCEPTION 'GST invoice series exhausted' USING ERRCODE='22003'; END IF;
 RETURN jsonb_build_object('supplierGstin',p_gstin,
 'fiscalYearStart',v_fy,'seriesPrefix',p_prefix,'serial',v_serial,
 'documentNumber',p_prefix||'/'||right(v_fy::text,2)||'/'||lpad(v_serial::text,6,'0'));
END $$;

-- An operator-only, read-only readiness view never claims issuance activation.
CREATE FUNCTION app_private.india_gst_ledger_readiness(p_outlet text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE g app_private.india_gst_operator_releases%ROWTYPE;
BEGIN
 IF NOT app_private.pos_access(p_outlet,'document') OR
   current_setting('app.outlet_id',true) IS DISTINCT FROM p_outlet
 THEN RAISE EXCEPTION 'Fiscal ledger access denied' USING ERRCODE='42501'; END IF;
 SELECT * INTO g FROM app_private.india_gst_operator_releases WHERE outlet_id=p_outlet;
 RETURN jsonb_build_object(
   'jurisdiction','IN',
   'policyRevision',COALESCE(g.policy_revision,0),
   'registeredOperatorRelease',COALESCE(g.release_enabled,false),
   'legalSignoff',COALESCE(g.legal_signoff,false),
   'financeSignoff',COALESCE(g.finance_signoff,false),
   'jurisdictionVerified',COALESCE(g.jurisdiction_verified,false),
   'irpApplicabilityVerified',COALESCE(g.irp_applicability_verified,false),
   'adapterVerified',COALESCE(g.adapter_verified,false),
   'signatureVerified',COALESCE(g.signing_verified,false),
   'printerAccepted',COALESCE(g.printer_acceptance,false),
   'statutoryIssuanceAvailable',false,
   'invoiceCount', (SELECT count(*) FROM app_private.india_gst_statutory_records
      WHERE outlet_id=p_outlet),
   'reviewOnly',true
 );
END $$;

-- No generic table-level grants. Only the guarded read-only diagnostic can
-- run under the app role. All mutable SQL remains operator-only.
DO $$DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY[
  'india_gst_operator_releases','india_gst_serial_counters',
  'india_gst_statutory_records','india_gst_irp_audit'
 ] LOOP
  EXECUTE format('ALTER TABLE app_private.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON app_private.%I FROM PUBLIC,menuminute_app,menuminute_worker,menuminute_billing',t);
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION
  app_private.india_gst_record_guard(),
  app_private.india_gst_immutable(),
  app_private.india_gst_fy_start(date),
  app_private.india_gst_allocate_serial(text,text,text,date),
  app_private.india_gst_ledger_readiness(text)
 FROM PUBLIC,menuminute_app,menuminute_worker,menuminute_billing;
GRANT EXECUTE ON FUNCTION app_private.india_gst_ledger_readiness(text) TO menuminute_app;
