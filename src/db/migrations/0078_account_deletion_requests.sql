-- Personal account-deletion requests are reversible tickets, not automatic destructive jobs.
-- The Admin Support Desk performs verified deletion after checking business ownership, statutory
-- retention and shared restaurant records. Every requested/cancelled transition is durable.
CREATE TABLE account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  ticket_id uuid NOT NULL UNIQUE REFERENCES support_tickets(id) ON DELETE RESTRICT,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz NOT NULL,
  cancelled_at timestamptz,
  CONSTRAINT deletion_request_time CHECK(due_at > created_at),
  CONSTRAINT deletion_request_cancellation CHECK(cancelled_at IS NULL OR cancelled_at >= created_at)
);
CREATE UNIQUE INDEX account_deletion_one_pending_per_user
  ON account_deletion_requests(user_id) WHERE cancelled_at IS NULL;
CREATE INDEX account_deletion_user_recent ON account_deletion_requests(user_id,created_at DESC);

ALTER TABLE account_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_deletion_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY account_deletion_owner_read ON account_deletion_requests FOR SELECT
  TO menuminute_app USING (
    user_id=NULLIF(current_setting('app.actor_id',true),'')
    OR app_private.is_super_admin(NULLIF(current_setting('app.actor_id',true),''))
  );
CREATE POLICY account_deletion_definer ON account_deletion_requests FOR ALL
  TO CURRENT_USER USING (true) WITH CHECK (true);
REVOKE ALL ON account_deletion_requests FROM PUBLIC,menuminute_app,menuminute_worker;
GRANT SELECT ON account_deletion_requests TO menuminute_app;

CREATE FUNCTION app_private.request_account_deletion(p_org text,p_outlet text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
  actor text:=NULLIF(current_setting('app.actor_id',true),'');
  existing account_deletion_requests%ROWTYPE;
  who users%ROWTYPE;
  org_name text;
  outlet_name text;
  demo boolean;
  ticket support_tickets%ROWTYPE;
  deadline timestamptz;
  ticket_body text;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('account-deletion:'||actor,0));
  SELECT * INTO existing FROM account_deletion_requests
    WHERE user_id=actor AND cancelled_at IS NULL FOR UPDATE;
  IF FOUND THEN
    SELECT * INTO ticket FROM support_tickets WHERE id=existing.ticket_id;
    RETURN jsonb_build_object('ticketNumber',ticket.ticket_number,'createdAt',existing.created_at,
      'dueAt',existing.due_at,'cancelledAt',existing.cancelled_at);
  END IF;
  SELECT * INTO who FROM users WHERE id=actor;
  IF NOT FOUND OR who.is_demo_data THEN
    RAISE EXCEPTION 'Account deletion requests are unavailable for this account'
      USING ERRCODE='42501';
  END IF;
  -- A personal deletion request is allowed even when an owned restaurant is suspended.
  SELECT o.name,r.name,r.is_demo_data INTO org_name,outlet_name,demo
    FROM organizations o JOIN restaurants r ON r.organization_id=o.id
    WHERE o.id=p_org AND r.id=p_outlet
      AND EXISTS (SELECT 1 FROM organization_members m
        WHERE m.organization_id=o.id AND m.user_id=actor AND m.is_active);
  IF NOT FOUND OR demo THEN
    RAISE EXCEPTION 'Organization is unavailable' USING ERRCODE='42501';
  END IF;

  -- Seven weekdays after the request, UTC; the cancellation window remains open
  -- through the seventh weekday. Regional public holidays require manual handling.
  SELECT ((day::date + 1)::timestamp AT TIME ZONE 'UTC') INTO deadline
  FROM generate_series(
    ((now() AT TIME ZONE 'UTC')::date + 1)::timestamp,
    ((now() AT TIME ZONE 'UTC')::date + 20)::timestamp,
    interval '1 day'
  ) AS workdays(day)
  WHERE EXTRACT(ISODOW FROM day) BETWEEN 1 AND 5
  ORDER BY day LIMIT 1 OFFSET 6;
  IF deadline IS NULL THEN RAISE EXCEPTION 'Unable to calculate deadline'; END IF;
  ticket_body:='Personal account deletion requested by the signed-in account holder. '||
    'Ticket is for administrative verification and processing; do not delete '||
    'restaurant financial or shared data without the applicable retention and ownership review. '||
    'Cancellation permitted through the end of the seventh weekday in UTC. '||
    'Scheduled review deadline: '||to_char(deadline AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI')||' UTC.';
  INSERT INTO support_tickets(
    organization_id,outlet_id,requester_id,requester_name,requester_email,
    organization_name,outlet_name,subject,body,category,priority,source
  ) VALUES (
    p_org,p_outlet,actor,left(who.name,120),left(who.email,254),
    left(org_name,120),left(outlet_name,120),'Account deletion request',ticket_body,
    'other','high','app'
  ) RETURNING * INTO ticket;
  INSERT INTO account_deletion_requests(user_id,ticket_id,organization_id,due_at)
    VALUES(actor,ticket.id,p_org,deadline) RETURNING * INTO existing;
  RETURN jsonb_build_object('ticketNumber',ticket.ticket_number,'createdAt',existing.created_at,
    'dueAt',existing.due_at,'cancelledAt',existing.cancelled_at);
END $$;
REVOKE ALL ON FUNCTION app_private.request_account_deletion(text,text)
  FROM PUBLIC,menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.request_account_deletion(text,text) TO menuminute_app;

CREATE FUNCTION app_private.cancel_account_deletion()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
  actor text:=NULLIF(current_setting('app.actor_id',true),'');
  r account_deletion_requests%ROWTYPE;
  ticket support_tickets%ROWTYPE;
  author text;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('account-deletion:'||actor,0));
  SELECT * INTO r FROM account_deletion_requests
    WHERE user_id=actor AND cancelled_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No active account deletion request' USING ERRCODE='22023'; END IF;
  IF now() >= r.due_at THEN
    RAISE EXCEPTION 'The cancellation window has ended; contact support immediately'
      USING ERRCODE='22023';
  END IF;
  UPDATE account_deletion_requests SET cancelled_at=now() WHERE id=r.id RETURNING * INTO r;
  UPDATE support_tickets SET subject='Account deletion request (withdrawn)',status='closed',
    resolved_at=coalesce(resolved_at,now()),updated_at=now()
    WHERE id=r.ticket_id RETURNING * INTO ticket;
  SELECT left(coalesce(name,''),120) INTO author FROM users WHERE id=actor;
  INSERT INTO support_ticket_messages(ticket_id,author_id,author_name,internal,body)
    VALUES(ticket.id,actor,coalesce(author,''),false,
      'The account holder withdrew their account deletion request before the deadline. Do not process this deletion.');
  RETURN jsonb_build_object('ticketNumber',ticket.ticket_number,'createdAt',r.created_at,
    'dueAt',r.due_at,'cancelledAt',r.cancelled_at);
END $$;
REVOKE ALL ON FUNCTION app_private.cancel_account_deletion() FROM PUBLIC,menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.cancel_account_deletion() TO menuminute_app;
