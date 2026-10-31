-- Ember: allow a confirmed "publish menu" action request (the 0065/0066 kind list already holds the
-- draft price/description kinds). Widening a CHECK only; no data changes. Rollback: a later forward
-- migration restoring the previous list once no 'menu.publish' rows exist.
ALTER TABLE assistant_action_requests DROP CONSTRAINT assistant_action_requests_kind_check;
ALTER TABLE assistant_action_requests ADD CONSTRAINT assistant_action_requests_kind_check CHECK(kind IN (
 'service_request.acknowledge','service_request.resolve','order.transition',
 'kitchen.work','menu.price','menu.description','menu.publish','support.ticket'));
