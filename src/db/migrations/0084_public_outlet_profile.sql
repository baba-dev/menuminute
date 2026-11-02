-- Repair the guest profile projection missed by PR #296: its earlier 0079 SQL file
-- was not registered in the migration journal and therefore never executed.
-- Keep the 0081 plan_filter_document policy intact. This is append-only and safe
-- for existing web/worker releases; never expose private operations contacts.
CREATE OR REPLACE FUNCTION app_private.free_menu_public(p_token text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT jsonb_build_object('outlet',jsonb_build_object('id',r.id,'name',r.name,'currency',r.currency,'timezone',r.timezone,'outletType',r.outlet_type,'fulfillmentModes',r.fulfillment_modes,'isDemoData',r.is_demo_data,'versioned',r.free_menu_enabled,'profile',jsonb_build_object('description',NULLIF(btrim(r.description),''),'phone',NULLIF(btrim(r.phone),''),'email',NULLIF(btrim(r.email),''),'website',NULLIF(btrim(r.website),''),'addressLine1',NULLIF(btrim(r.address_line1),''),'addressLine2',NULLIF(btrim(r.address_line2),''),'city',NULLIF(btrim(r.city),''),'state',NULLIF(btrim(r.state),''),'postalCode',NULLIF(btrim(r.postal_code),''),'country',r.country,'latitude',r.latitude::double precision,'longitude',r.longitude::double precision,'primaryColor',r.primary_color,'secondaryColor',r.secondary_color)),'point',t.label,'now',statement_timestamp(),
 'menus',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',m.id,'revision',rel.revision,'document',app_private.plan_filter_document(r.id,rel.document),'brand',b.name,'overrides',COALESCE((SELECT jsonb_agg(jsonb_build_object('dishId',o.dish_id,'priceMinor',o.price_minor,'soldOut',o.sold_out)) FROM menu_overrides o WHERE o.menu_id=m.id AND o.outlet_id=r.id),'[]'::jsonb))) FROM menu_assignments a JOIN menus m ON m.id=a.menu_id JOIN menu_releases rel ON rel.menu_id=m.id AND rel.revision=m.published_revision LEFT JOIN brands b ON b.id=a.brand_id WHERE a.outlet_id=r.id AND NOT m.archived),'[]'::jsonb))
 FROM qr_codes q JOIN restaurants r ON r.id=q.restaurant_id JOIN organizations org ON org.id=r.organization_id LEFT JOIN restaurant_tables t ON t.id=q.table_id AND t.restaurant_id=r.id
 WHERE q.destination_token=p_token AND q.is_active AND r.is_active AND r.is_published AND org.is_active LIMIT 1
$$;
REVOKE ALL ON FUNCTION app_private.free_menu_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.free_menu_public(text) TO menuminute_app;
