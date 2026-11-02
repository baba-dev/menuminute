-- Ember: allow a confirmed "floor.signals" action request, so the owner can ask Ember to turn the optional
-- live table signals on or off (they still confirm first; the domain command keeps its own permission
-- check). Widening a CHECK only; no data changes. Rollback: a later forward migration restoring the
-- previous list once no 'floor.signals' rows exist.
ALTER TABLE assistant_action_requests DROP CONSTRAINT assistant_action_requests_kind_check;
ALTER TABLE assistant_action_requests ADD CONSTRAINT assistant_action_requests_kind_check CHECK(kind IN (
 'service_request.acknowledge','service_request.resolve','order.transition',
 'kitchen.work','menu.price','menu.description','menu.publish','support.ticket','floor.signals'));
