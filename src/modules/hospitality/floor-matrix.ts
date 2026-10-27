import { sql } from "drizzle-orm";
import { withOutletRead, type Actor } from "@/modules/tenancy/service";

/**
 * Orders-derived activity, not a claim of physical occupancy. Unsettled
 * orders remain visible without an arbitrary 24-hour cutoff.
 */
export type FloorTable = {
 id:string;tableNumber:string;label:string|null;capacity:number|null;
 activeOrders:number;unpaidOrders:number;dueMinor:string;
 latestOrderId:string|null;latestOrderNumber:number|null;
 latestStatus:string|null;latestCreatedAt:string|null;
};
export async function getOutletFloorMatrix(actor:Actor,organizationId:string,outletId:string):Promise<FloorTable[]>{
 return withOutletRead(actor,outletId,"orders.read",async tx=>{
  const org=await tx.execute<{matched:boolean}>(sql
    `select exists(select 1 from restaurants
     where id=${outletId} and organization_id=${organizationId} and is_active) as matched`);
  if(!org.rows[0]?.matched) throw new Error("Outlet scope mismatch");
  const data=await tx.execute<FloorTable>(sql`
   WITH service_orders AS (
      SELECT o.* FROM orders o
      WHERE o.restaurant_id=${outletId} AND o.table_id IS NOT NULL
        AND (o.status IN ('pending','accepted','preparing','ready')
          OR (o.payment_status='unpaid' AND o.status IN ('served','collected','delivered')))
   ),
   table_totals AS (
      SELECT table_id,
        count(*) FILTER(WHERE status IN ('pending','accepted','preparing','ready'))::int AS active,
        count(*) FILTER(WHERE payment_status='unpaid')::int AS unpaid,
        coalesce(sum(total_minor) FILTER(WHERE payment_status='unpaid'),0)::bigint::text AS due_minor
      FROM service_orders GROUP BY table_id
   )
   SELECT t.id,t.table_number AS "tableNumber",t.label,t.capacity,
     coalesce(a.active,0)::int AS "activeOrders",
     coalesce(a.unpaid,0)::int AS "unpaidOrders",
     coalesce(a.due_minor,'0') AS "dueMinor",
     latest.id AS "latestOrderId",latest.order_number AS "latestOrderNumber",
     latest.status AS "latestStatus",latest.created_at AS "latestCreatedAt"
   FROM restaurant_tables t
   LEFT JOIN table_totals a ON a.table_id=t.id
   LEFT JOIN LATERAL (
     SELECT id,order_number,status,created_at
     FROM service_orders o
     WHERE o.table_id=t.id ORDER BY created_at DESC,id DESC LIMIT 1
   ) latest ON true
   WHERE t.restaurant_id=${outletId} AND t.is_active=true
   ORDER BY t.table_number LIMIT 200
  `);
  return data.rows;
 });
}
