-- Support desk: operators raise requests (from Ember or the app); platform admins work them.
-- Lightweight by design: two tables, denormalized display fields so the admin queue is a single
-- indexed read, soft-delete (archive) instead of destructive delete, and one SECURITY DEFINER
-- function per write so web roles hold SELECT only.
--
-- Access: an operator sees only their own tickets and the public replies on them; a platform admin
-- (users.is_super_admin) sees everything. Platform admins are separately required to have 2FA by the
-- admin guard. Routine ticket handling deliberately does not demand per-action step-up.
-- The demo tenant cannot raise tickets. Rollback: forward migration dropping both tables.
CREATE TABLE support_tickets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 ticket_number integer GENERATED ALWAYS AS IDENTITY UNIQUE,
 organization_id text NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
 outlet_id text NOT NULL,
 requester_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 -- Snapshots taken when raised, so the admin queue never joins tenant tables.
 requester_name text NOT NULL DEFAULT '',
 requester_email text NOT NULL DEFAULT '',
 organization_name text NOT NULL DEFAULT '',
 outlet_name text NOT NULL DEFAULT '',
 subject text NOT NULL CHECK(length(btrim(subject)) BETWEEN 3 AND 120),
 body text NOT NULL CHECK(length(btrim(body)) BETWEEN 1 AND 4000),
 category text NOT NULL DEFAULT 'question'
  CHECK(category IN ('question','bug','billing','menu','orders','kitchen','other')),
 priority text NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent')),
 status text NOT NULL DEFAULT 'open'
  CHECK(status IN ('open','in_progress','waiting','resolved','closed')),
 assignee_id text REFERENCES users(id) ON DELETE SET NULL,
 source text NOT NULL DEFAULT 'ember' CHECK(source IN ('ember','app')),
 archived_at timestamptz,
 resolved_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,outlet_id) REFERENCES restaurants(organization_id,id) ON DELETE RESTRICT,
 CHECK((status IN ('resolved','closed')) = (resolved_at IS NOT NULL))
);
CREATE INDEX support_tickets_queue ON support_tickets(status,created_at DESC,id)
 WHERE archived_at IS NULL;
CREATE INDEX support_tickets_recent ON support_tickets(created_at DESC,id) WHERE archived_at IS NULL;
CREATE INDEX support_tickets_requester ON support_tickets(requester_id,created_at DESC);

CREATE TABLE support_ticket_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
 author_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 author_name text NOT NULL DEFAULT '',
 internal boolean NOT NULL DEFAULT false,
 body text NOT NULL CHECK(length(btrim(body)) BETWEEN 1 AND 4000),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_ticket_messages_thread ON support_ticket_messages(ticket_id,created_at,id);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets FORCE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_messages FORCE ROW LEVEL SECURITY;
CREATE POLICY support_tickets_read ON support_tickets FOR SELECT TO menuminute_app USING (
 app_private.is_super_admin(NULLIF(current_setting('app.actor_id',true),''))
 OR (requester_id=NULLIF(current_setting('app.actor_id',true),'') AND archived_at IS NULL));
CREATE POLICY support_messages_read ON support_ticket_messages FOR SELECT TO menuminute_app USING (
 app_private.is_super_admin(NULLIF(current_setting('app.actor_id',true),''))
 OR (NOT internal AND EXISTS(SELECT 1 FROM support_tickets t WHERE t.id=ticket_id
     AND t.requester_id=NULLIF(current_setting('app.actor_id',true),'') AND t.archived_at IS NULL)));
-- SECURITY DEFINER functions run as the migration owner; see 0064 for why it needs its own policy.
CREATE POLICY support_tickets_definer ON support_tickets FOR ALL TO CURRENT_USER USING (true) WITH CHECK (true);
CREATE POLICY support_messages_definer ON support_ticket_messages FOR ALL TO CURRENT_USER USING (true) WITH CHECK (true);
REVOKE ALL ON support_tickets,support_ticket_messages FROM PUBLIC,menuminute_app,menuminute_worker;
GRANT SELECT ON support_tickets,support_ticket_messages TO menuminute_app;

-- Raise a ticket as the signed-in operator (callers set app.actor_id and app.outlet_id).
CREATE FUNCTION app_private.support_create_ticket(
 p_org text,p_outlet text,p_subject text,p_body text,p_category text,p_priority text,p_source text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE actor text:=NULLIF(current_setting('app.actor_id',true),''); t support_tickets%ROWTYPE;
 u users%ROWTYPE; org_name text; outlet_name text; demo boolean;
BEGIN
 IF actor IS NULL OR p_outlet IS DISTINCT FROM NULLIF(current_setting('app.outlet_id',true),'')
    OR NOT (app_private.can_outlet(p_outlet,'orders.read') OR app_private.can_outlet(p_outlet,'menu.read'))
 THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT r.name,o.name,r.is_demo_data INTO outlet_name,org_name,demo FROM restaurants r
   JOIN organizations o ON o.id=r.organization_id
   WHERE r.id=p_outlet AND r.organization_id=p_org AND r.is_active AND o.is_active;
 IF NOT FOUND THEN RAISE EXCEPTION 'Outlet unavailable' USING ERRCODE='42501'; END IF;
 IF demo THEN RAISE EXCEPTION 'Support requests are not available in the demo' USING ERRCODE='42501'; END IF;
 IF p_category NOT IN ('question','bug','billing','menu','orders','kitchen','other')
    OR p_priority NOT IN ('low','normal','high','urgent') OR p_source NOT IN ('ember','app')
    OR length(btrim(coalesce(p_subject,''))) NOT BETWEEN 3 AND 120
    OR length(btrim(coalesce(p_body,''))) NOT BETWEEN 1 AND 4000
 THEN RAISE EXCEPTION 'Invalid support request' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('support-create:'||actor,0));
 IF (SELECT count(*) FROM support_tickets WHERE requester_id=actor AND created_at>=now()-interval '24 hours')>=10
 THEN RAISE EXCEPTION 'Daily support request limit reached' USING ERRCODE='22023'; END IF;
 IF (SELECT count(*) FROM support_tickets WHERE organization_id=p_org
     AND status IN ('open','in_progress','waiting') AND archived_at IS NULL)>=50
 THEN RAISE EXCEPTION 'Too many open support requests' USING ERRCODE='22023'; END IF;
 SELECT * INTO u FROM users WHERE id=actor;
 INSERT INTO support_tickets(organization_id,outlet_id,requester_id,requester_name,requester_email,
   organization_name,outlet_name,subject,body,category,priority,source)
 VALUES(p_org,p_outlet,actor,left(coalesce(u.name,''),120),left(coalesce(u.email,''),254),
   left(org_name,120),left(outlet_name,120),btrim(p_subject),btrim(p_body),p_category,p_priority,p_source)
 RETURNING * INTO t;
 RETURN jsonb_build_object('id',t.id,'ticketNumber',t.ticket_number,'status',t.status,'createdAt',t.created_at);
END $$;
REVOKE ALL ON FUNCTION app_private.support_create_ticket(text,text,text,text,text,text,text) FROM PUBLIC,menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.support_create_ticket(text,text,text,text,text,text,text) TO menuminute_app;

-- Platform-admin updates. NULL means "leave unchanged"; p_unassign clears the assignee.
CREATE FUNCTION app_private.support_admin_update(
 p_ticket uuid,p_status text,p_priority text,p_assignee text,p_unassign boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE actor text:=NULLIF(current_setting('app.actor_id',true),''); t support_tickets%ROWTYPE; new_status text;
BEGIN
 IF actor IS NULL OR NOT app_private.is_super_admin(actor) THEN
  RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 IF (p_status IS NOT NULL AND p_status NOT IN ('open','in_progress','waiting','resolved','closed'))
    OR (p_priority IS NOT NULL AND p_priority NOT IN ('low','normal','high','urgent'))
    OR (p_assignee IS NOT NULL AND NOT app_private.is_super_admin(p_assignee))
 THEN RAISE EXCEPTION 'Invalid support update' USING ERRCODE='22023'; END IF;
 SELECT * INTO t FROM support_tickets WHERE id=p_ticket FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Ticket unavailable' USING ERRCODE='42501'; END IF;
 new_status:=coalesce(p_status,t.status);
 UPDATE support_tickets SET status=new_status,priority=coalesce(p_priority,priority),
   assignee_id=CASE WHEN p_unassign THEN NULL ELSE coalesce(p_assignee,assignee_id) END,
   resolved_at=CASE WHEN new_status IN ('resolved','closed') THEN coalesce(resolved_at,now()) ELSE NULL END,
   updated_at=now() WHERE id=t.id RETURNING * INTO t;
 RETURN jsonb_build_object('id',t.id,'status',t.status,'priority',t.priority,'assigneeId',t.assignee_id);
END $$;
REVOKE ALL ON FUNCTION app_private.support_admin_update(uuid,text,text,text,boolean) FROM PUBLIC,menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.support_admin_update(uuid,text,text,text,boolean) TO menuminute_app;

-- Add a reply (visible to the operator) or an internal note. A visible reply to an open ticket
-- moves it to "waiting" (ball is with the operator) unless the admin chooses a status.
CREATE FUNCTION app_private.support_admin_reply(p_ticket uuid,p_body text,p_internal boolean,p_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE actor text:=NULLIF(current_setting('app.actor_id',true),''); t support_tickets%ROWTYPE;
 m support_ticket_messages%ROWTYPE; author text; new_status text;
BEGIN
 IF actor IS NULL OR NOT app_private.is_super_admin(actor) THEN
  RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 IF length(btrim(coalesce(p_body,''))) NOT BETWEEN 1 AND 4000
    OR (p_status IS NOT NULL AND p_status NOT IN ('open','in_progress','waiting','resolved','closed'))
 THEN RAISE EXCEPTION 'Invalid reply' USING ERRCODE='22023'; END IF;
 SELECT * INTO t FROM support_tickets WHERE id=p_ticket FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Ticket unavailable' USING ERRCODE='42501'; END IF;
 SELECT left(coalesce(name,''),120) INTO author FROM users WHERE id=actor;
 INSERT INTO support_ticket_messages(ticket_id,author_id,author_name,internal,body)
 VALUES(t.id,actor,coalesce(author,''),coalesce(p_internal,false),btrim(p_body)) RETURNING * INTO m;
 new_status:=coalesce(p_status,CASE WHEN NOT coalesce(p_internal,false) AND t.status IN ('open','in_progress')
   THEN 'waiting' ELSE t.status END);
 UPDATE support_tickets SET status=new_status,
   resolved_at=CASE WHEN new_status IN ('resolved','closed') THEN coalesce(resolved_at,now()) ELSE NULL END,
   assignee_id=coalesce(assignee_id,actor),updated_at=now() WHERE id=t.id;
 RETURN jsonb_build_object('id',m.id,'ticketId',t.id,'internal',m.internal,'status',new_status,'createdAt',m.created_at);
END $$;
REVOKE ALL ON FUNCTION app_private.support_admin_reply(uuid,text,boolean,text) FROM PUBLIC,menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.support_admin_reply(uuid,text,boolean,text) TO menuminute_app;

-- Archive (soft delete) or restore. Rows are never destroyed through the application.
CREATE FUNCTION app_private.support_admin_archive(p_ticket uuid,p_archived boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE actor text:=NULLIF(current_setting('app.actor_id',true),''); t support_tickets%ROWTYPE;
BEGIN
 IF actor IS NULL OR NOT app_private.is_super_admin(actor) OR p_archived IS NULL THEN
  RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 UPDATE support_tickets SET archived_at=CASE WHEN p_archived THEN coalesce(archived_at,now()) ELSE NULL END,
   updated_at=now() WHERE id=p_ticket RETURNING * INTO t;
 IF NOT FOUND THEN RAISE EXCEPTION 'Ticket unavailable' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('id',t.id,'archived',t.archived_at IS NOT NULL);
END $$;
REVOKE ALL ON FUNCTION app_private.support_admin_archive(uuid,boolean) FROM PUBLIC,menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.support_admin_archive(uuid,boolean) TO menuminute_app;

-- Let Ember prepare a support request for confirmation (widens the 0065 kind list).
ALTER TABLE assistant_action_requests DROP CONSTRAINT assistant_action_requests_kind_check;
ALTER TABLE assistant_action_requests ADD CONSTRAINT assistant_action_requests_kind_check CHECK(kind IN (
 'service_request.acknowledge','service_request.resolve','order.transition',
 'kitchen.work','menu.price','menu.description','support.ticket'));
