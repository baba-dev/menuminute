-- Settings 2.0: narrow, authorized profile update; never grant direct UPDATE to app.
ALTER TABLE restaurants ADD COLUMN profile_version integer NOT NULL DEFAULT 0;
CREATE FUNCTION app_private.update_outlet_profile(p_org text,p_outlet text,p_expected integer,p_data jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE actor text:=NULLIF(current_setting('app.actor_id',true),''); r restaurants%ROWTYPE; field text;
  email_value text; website_value text;
BEGIN
 IF actor IS NULL OR p_expected<0 OR jsonb_typeof(p_data)<>'object' THEN
  RAISE EXCEPTION 'Invalid profile command' USING ERRCODE='22023'; END IF;
 FOR field IN SELECT jsonb_object_keys(p_data) LOOP
  IF field NOT IN ('description','phone','email','website','addressLine1','addressLine2','city','state','postalCode','primaryColor','secondaryColor')
     OR jsonb_typeof(p_data->field) NOT IN ('string','null') THEN
   RAISE EXCEPTION 'Unsupported profile field' USING ERRCODE='22023'; END IF;
 END LOOP;
 IF (SELECT count(*) FROM jsonb_object_keys(p_data))<>11 THEN
   RAISE EXCEPTION 'Complete profile payload required' USING ERRCODE='22023'; END IF;
 PERFORM 1 FROM organizations WHERE id=p_org AND is_active FOR SHARE;
 IF NOT FOUND OR NOT app_private.can_outlet(p_outlet,'outlet.manage') THEN
  RAISE EXCEPTION 'Outlet unavailable' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM restaurants WHERE id=p_outlet AND organization_id=p_org AND is_active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Outlet unavailable' USING ERRCODE='42501'; END IF;
 IF r.profile_version<>p_expected THEN RAISE EXCEPTION 'Profile changed on another device' USING ERRCODE='40001'; END IF;
 IF length(coalesce(p_data->>'description',''))>500 OR length(coalesce(p_data->>'phone',''))>40
 OR length(coalesce(p_data->>'email',''))>254 OR length(coalesce(p_data->>'website',''))>512
 OR length(coalesce(p_data->>'addressLine1',''))>180 OR length(coalesce(p_data->>'addressLine2',''))>180
 OR length(coalesce(p_data->>'city',''))>100 OR length(coalesce(p_data->>'state',''))>100
 OR length(coalesce(p_data->>'postalCode',''))>24 THEN
 RAISE EXCEPTION 'Profile field exceeds limit' USING ERRCODE='22023'; END IF;
 email_value:=NULLIF(trim(p_data->>'email'),''); website_value:=NULLIF(trim(p_data->>'website'),'');
 IF email_value IS NOT NULL AND email_value !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' THEN
 RAISE EXCEPTION 'Invalid email' USING ERRCODE='22023'; END IF;
 IF website_value IS NOT NULL AND website_value !~* '^https?://[^[:space:]]+\.[^[:space:]]+$' THEN
 RAISE EXCEPTION 'Invalid website' USING ERRCODE='22023'; END IF;
 IF (p_data->>'primaryColor') IS NULL OR (p_data->>'secondaryColor') IS NULL
 OR (p_data->>'primaryColor') !~ '^#[0-9a-fA-F]{6}
 RAISE EXCEPTION 'Invalid branding color' USING ERRCODE='22023'; END IF;
 UPDATE restaurants SET description=NULLIF(trim(p_data->>'description'),''),
 phone=NULLIF(trim(p_data->>'phone'),''), email=lower(email_value), website=website_value,
 address_line1=NULLIF(trim(p_data->>'addressLine1'),''),address_line2=NULLIF(trim(p_data->>'addressLine2'),''),
 city=NULLIF(trim(p_data->>'city'),''),state=NULLIF(trim(p_data->>'state'),''),
 postal_code=NULLIF(trim(p_data->>'postalCode'),''),primary_color=p_data->>'primaryColor',
 secondary_color=p_data->>'secondaryColor',profile_version=profile_version+1,updated_at=now()
 WHERE id=p_outlet;
 INSERT INTO audit_logs(id,user_id,restaurant_id,action,resource_type,resource_id)
 VALUES(gen_random_uuid()::text,actor,p_outlet,'settings.profile.update','outlet',p_outlet);
 RETURN p_expected+1;
END $$;
REVOKE ALL ON FUNCTION app_private.update_outlet_profile(text,text,integer,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.update_outlet_profile(text,text,integer,jsonb) TO menuminute_app;
 OR (p_data->>'secondaryColor') !~ '^#[0-9a-fA-F]{6}
 RAISE EXCEPTION 'Invalid branding color' USING ERRCODE='22023'; END IF;
 UPDATE restaurants SET description=NULLIF(trim(p_data->>'description'),''),
 phone=NULLIF(trim(p_data->>'phone'),''), email=lower(email_value), website=website_value,
 address_line1=NULLIF(trim(p_data->>'addressLine1'),''),address_line2=NULLIF(trim(p_data->>'addressLine2'),''),
 city=NULLIF(trim(p_data->>'city'),''),state=NULLIF(trim(p_data->>'state'),''),
 postal_code=NULLIF(trim(p_data->>'postalCode'),''),primary_color=p_data->>'primaryColor',
 secondary_color=p_data->>'secondaryColor',profile_version=profile_version+1,updated_at=now()
 WHERE id=p_outlet;
 INSERT INTO audit_logs(id,user_id,restaurant_id,action,resource_type,resource_id)
 VALUES(gen_random_uuid()::text,actor,p_outlet,'settings.profile.update','outlet',p_outlet);
 RETURN p_expected+1;
END $$;
REVOKE ALL ON FUNCTION app_private.update_outlet_profile(text,text,integer,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.update_outlet_profile(text,text,integer,jsonb) TO menuminute_app;
 THEN
 RAISE EXCEPTION 'Invalid branding color' USING ERRCODE='22023'; END IF;
 UPDATE restaurants SET description=NULLIF(trim(p_data->>'description'),''),
 phone=NULLIF(trim(p_data->>'phone'),''), email=lower(email_value), website=website_value,
 address_line1=NULLIF(trim(p_data->>'addressLine1'),''),address_line2=NULLIF(trim(p_data->>'addressLine2'),''),
 city=NULLIF(trim(p_data->>'city'),''),state=NULLIF(trim(p_data->>'state'),''),
 postal_code=NULLIF(trim(p_data->>'postalCode'),''),primary_color=p_data->>'primaryColor',
 secondary_color=p_data->>'secondaryColor',profile_version=profile_version+1,updated_at=now()
 WHERE id=p_outlet;
 INSERT INTO audit_logs(id,user_id,restaurant_id,action,resource_type,resource_id)
 VALUES(gen_random_uuid()::text,actor,p_outlet,'settings.profile.update','outlet',p_outlet);
 RETURN p_expected+1;
END $$;
REVOKE ALL ON FUNCTION app_private.update_outlet_profile(text,text,integer,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.update_outlet_profile(text,text,integer,jsonb) TO menuminute_app;
