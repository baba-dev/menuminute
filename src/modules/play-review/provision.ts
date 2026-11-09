import QRCode from "qrcode";
import type { PoolClient } from "pg";
import { PLAY_REVIEW, PLAY_REVIEW_TABLES, buildPlayReviewMenu, buildPlayReviewOrders } from "./fixture";

/**
 * Production-only operator command. This is NOT an HTTP route and never runs
 * during normal app deployment. Requires a migration-owner connection.
 * The public demo is unrelated and remains reset/guarded independently.
 */
export async function provisionPlayReviewer(
  c: PoolClient,
  email: string,
  passwordHash: string,
  rotatePassword = false
): Promise<{ restaurant: string; dishes: number; orders: number; tables: number }> {
  const { userId, userName, outletId, organizationId, memberId, menuId, publicId, outletName } =
    PLAY_REVIEW;
  const menu = buildPlayReviewMenu();
  const orders = buildPlayReviewOrders();
  const svg = await QRCode.toString(`https://food.bababuilds.com/m/${publicId}`, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
  });
  const allDishes = menu.categories.flatMap((category) => category.items);
  await c.query("BEGIN");
  try {
    await c.query("SET LOCAL lock_timeout = '5000ms'");
    await c.query("SET LOCAL statement_timeout = '120000ms'");
    await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
      "play-reviewer-the-droid-pie-v1",
    ]);

    const identity = await c.query<{ id: string; name: string; email: string }>(
      "SELECT id, name, email FROM users WHERE id=$1 OR lower(email)=lower($2)",
      [userId, email]
    );
    if (
      identity.rows.some(
        (row) => row.id !== userId || row.name !== userName || row.email !== email
      )
    ) {
      throw new Error("Reviewer identity conflict: refusing to take over an existing account");
    }
    await c.query(
      `INSERT INTO users(id,name,email,email_verified,is_demo_data)
       VALUES ($1,$2,$3,true,false) ON CONFLICT(id) DO NOTHING`,
      [userId, userName, email]
    );
    await c.query(
      `INSERT INTO accounts(id,user_id,provider_id,account_id,password)
       VALUES ($1,$2,'credential',$2,$3) ON CONFLICT(id) DO NOTHING`,
      ["play-reviewer-credential-v1", userId, passwordHash]
    );
    const account = await c.query<{ id: string; user_id: string }>(
      "SELECT id,user_id FROM accounts WHERE provider_id='credential' AND account_id=$1",
      [userId]
    );
    if (
      account.rows.length !== 1 ||
      account.rows[0]!.id !== "play-reviewer-credential-v1" ||
      account.rows[0]!.user_id !== userId
    ) {
      throw new Error("Reviewer credential conflict: refusing to alter an unrelated account");
    }
    if (rotatePassword) {
      await c.query("UPDATE accounts SET password=$1,updated_at=now() WHERE id=$2", [
        passwordHash,
        "play-reviewer-credential-v1",
      ]);
    }

    const existing = await c.query<{ user_id: string }>(
      `SELECT m.user_id FROM organization_members m
       JOIN restaurants r ON r.organization_id=m.organization_id
       WHERE r.id=$1 AND m.role='owner'`,
      [outletId]
    );
    if (existing.rows.some((row) => row.user_id !== userId))
      throw new Error("Reviewer outlet ownership conflict");

    if (!existing.rowCount) {
      await c.query("SELECT set_config('app.actor_id',$1,true)", [userId]);
      await c.query("SELECT app_private.provision_organization($1,$2,$3::jsonb)", [
        outletId,
        publicId,
        JSON.stringify({
          name: outletName,
          country: "IN",
          currency: "INR",
          timezone: "Asia/Kolkata",
          outletType: "restaurant",
          fulfillmentModes: ["dine_in", "pickup"],
          city: "Sample City",
          description: "Play Store review restaurant. All orders, guests and payments are fictional.",
          svgData: svg,
        }),
      ]);
    }

    // Lower MFA requirements for this isolated reviewer organization only.
    // The reviewer is a REAL role-scoped owner (never the shared public-demo identity).
    await c.query(
      "UPDATE organizations SET mfa_required=false WHERE id=$1 AND name=$2",
      [organizationId, outletName]
    );
    const outlet = await c.query<{ organization_id: string; public_id: string }>(
      "SELECT organization_id,public_id FROM restaurants WHERE id=$1",
      [outletId]
    );
    if (
      outlet.rows.length !== 1 ||
      outlet.rows[0]!.organization_id !== organizationId ||
      outlet.rows[0]!.public_id !== publicId
    ) throw new Error("Reviewer outlet identity conflict");

    await c.query(
      `UPDATE restaurants SET free_menu_enabled=true,is_published=true
       WHERE id=$1 AND organization_id=$2 AND is_demo_data=false`,
      [outletId, organizationId]
    );

    // Do not overwrite edits made by Google during a later re-run.
    const currentMenu = await c.query<{ published_revision: number | null }>(
      "SELECT published_revision FROM menus WHERE id=$1 AND organization_id=$2 FOR UPDATE",
      [menuId, organizationId]
    );
    if (currentMenu.rows.length !== 1) throw new Error("Reviewer menu missing");
    if (currentMenu.rows[0]!.published_revision === null) {
      await c.query(
        "UPDATE menus SET document=$1::jsonb,published_revision=revision,updated_at=now() WHERE id=$2",
        [JSON.stringify(menu), menuId]
      );
      await c.query(
        `INSERT INTO menu_releases(menu_id,revision,organization_id,document,published_by)
         SELECT id,revision,organization_id,document,$1 FROM menus WHERE id=$2
         ON CONFLICT (menu_id,revision) DO NOTHING`,
        [userId, menuId]
      );
    }

    for (const t of PLAY_REVIEW_TABLES) {
      await c.query(
        `INSERT INTO restaurant_tables(id,restaurant_id,table_number,label,capacity)
         VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING`,
        [t.id, outletId, t.number, t.label, t.capacity]
      );
    }

    for (const [id, name, position] of [
      ["play-review-st-pizza", "Pizza & Oven", 1],
      ["play-review-st-grill", "Grill & Starters", 2],
      ["play-review-st-cold", "Desserts & Drinks", 3],
    ] as const) {
      await c.query(
        `INSERT INTO kitchen_stations(id,outlet_id,name,position)
         VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING`,
        [id, outletId, name, position]
      );
      await c.query(
        `INSERT INTO kitchen_station_members(outlet_id,station_id,member_id,organization_id)
         VALUES($1,$2,$3,$4) ON CONFLICT(station_id,member_id) DO NOTHING`,
        [outletId, id, memberId, organizationId]
      );
    }

    for (const category of menu.categories) {
      const station =
        category.id === "cat-desserts"
          ? "play-review-st-cold"
          : category.id === "cat-italian"
            ? "play-review-st-pizza"
            : "play-review-st-grill";
      for (const dish of category.items) {
        await c.query(
          `INSERT INTO kitchen_routes(outlet_id,dish_id,station_id)
           VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,
          [outletId, dish.id, station]
        );
      }
    }

    // Review-only non-billable demonstration access. These are NOT payment
    // records and never impersonate a Google Play/Razorpay purchase.
    for (const [capability, id] of [
      ["ordering.new", "play-review-grant-ordering-v1"],
      ["kitchen.new", "play-review-grant-kitchen-v1"],
    ] as const) {
      await c.query(
        `INSERT INTO entitlement_grants
         (id,organization_id,capability,billing_currency,starts_at,ends_at,operator,reason,request_key)
         VALUES($1,$2,$3,'INR',now()-interval '1 day',now()+interval '180 days',
                'play-reviewer-fixture','Non-billable Google Play review tenant',$1)
         ON CONFLICT(id) DO NOTHING`,
        [id, organizationId, capability]
      );
    }
    await c.query(
      `INSERT INTO kitchen_outlet_settings(outlet_id,enabled)
       VALUES($1,true) ON CONFLICT(outlet_id) DO NOTHING`,
      [outletId]
    );

    const guests = [
      ["+12025550101", "Alex Sample"],
      ["+12025550102", "Jordan Sample"],
      ["+12025550103", "Taylor Sample"],
      ["+12025550104", "Morgan Sample"],
      ["+12025550105", "Casey Sample"],
    ];
    for (const [phone, name] of guests) {
      await c.query(
        `INSERT INTO crm_guests(organization_id,phone_e164,display_name)
         VALUES($1,$2,$3) ON CONFLICT(organization_id,phone_e164) DO NOTHING`,
        [organizationId, phone, name]
      );
    }

    const reservations = [
      ["play-review-res-1", 2, "Alex Sample", 3, "confirmed", 60],
      ["play-review-res-2", 4, "Jordan Sample", 4, "confirmed", 120],
      ["play-review-res-3", 9, "Taylor Sample", 2, "seated", -20],
    ] as const;
    for (const [id, table, name, people, status, minutes] of reservations) {
      await c.query(
        `INSERT INTO dining_reservations
         (id,outlet_id,table_id,guest_name,party_size,reservation_time,status,notes)
         VALUES ($1,$2,$3,$4,$5,now()+($6::int*interval '1 minute'),$7,$8)
         ON CONFLICT (id) DO NOTHING`,
        [
          id,
          outletId,
          PLAY_REVIEW_TABLES[table - 1]!.id,
          name,
          people,
          minutes,
          status,
          "Fictional demonstration booking — no real guest information",
        ]
      );
    }

    for (const order of orders) {
      const createdAt = new Date(Date.now() - order.minutesAgo * 60_000);
      const amounts = order.items.reduce(
        (sum, item) => sum + item.quantity * item.unitPriceMinor,
        0
      );
      const created = await c.query<{ id: string }>(
        `INSERT INTO orders
         (id,restaurant_id,table_id,customer_name,fulfillment_mode,status,payment_status,currency,
          subtotal_minor,tax_minor,total_minor,subtotal_paise,tax_paise,total_paise,order_number,
          created_at,updated_at,tracking_token,expires_at,business_date,intake_source,notes,version)
         VALUES($1,$2,$3,$4,$5,$6,$7,'INR',$8,0,$8,$8,0,$8,$9,$10,$10,$11,
                $12,($10::timestamptz AT TIME ZONE 'Asia/Kolkata')::date,'guest_menu',$13,1)
         ON CONFLICT(id) DO NOTHING RETURNING id`,
        [
          order.id,
          outletId,
          order.tableId,
          order.customerName,
          order.mode,
          order.live ? "pending" : order.status,
          order.live ? "unpaid" : order.paymentStatus,
          amounts,
          order.number,
          createdAt,
          `play-review-track-${order.id}`,
          order.live ? new Date(Date.now() + 35 * 86400000) : new Date(createdAt.getTime() + 7200000),
          "Synthetic demonstration order; never collected from a real customer",
        ]
      );
      if (!created.rowCount) continue;

      for (const [index, item] of order.items.entries()) {
        await c.query(
          `INSERT INTO order_items
           (id,order_id,restaurant_id,dish_id,item_name,variant_id,variant_name,selected_options,
            unit_price_minor,total_minor,unit_price_paise,total_paise,quantity)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$9,$10,$11)`,
          [
            `${order.id}-item-${index}`,
            order.id,
            outletId,
            item.dishId,
            item.dishName,
            item.variantId,
            item.variantName,
            JSON.stringify(item.selectedOptions),
            item.unitPriceMinor,
            item.quantity * item.unitPriceMinor,
            item.quantity,
          ]
        );
      }
      await c.query(
        `INSERT INTO order_status_events
         (id,order_id,restaurant_id,to_status,status,actor_type,created_at,note)
         VALUES($1,$2,$3,'pending','pending','guest',$4,'Sample order placed')`,
        [`${order.id}-event-pending`, order.id, outletId, createdAt]
      );
      if (order.live) {
        let previous = "pending";
        for (const [index, status] of (order.liveSteps ?? []).entries()) {
          await c.query(
            "UPDATE orders SET status=$1,version=version+1,updated_at=now() WHERE id=$2",
            [status, order.id]
          );
          await c.query(
            `INSERT INTO order_status_events
             (id,order_id,restaurant_id,from_status,to_status,status,actor_type,actor_id,note)
             VALUES($1,$2,$3,$4,$5,$5,'staff',$6,'Sample kitchen progression')`,
            [`${order.id}-event-${index}`, order.id, outletId, previous, status, userId]
          );
          previous = status;
        }
      } else {
        await c.query(
          `INSERT INTO order_status_events
           (id,order_id,restaurant_id,from_status,to_status,status,actor_type,actor_id,created_at,note)
           VALUES($1,$2,$3,'pending',$4,$4,'staff',$5,$6,'Synthetic historical status')`,
          [`${order.id}-event-final`, order.id, outletId, order.status, userId, createdAt]
        );
      }
      await c.query(
        `INSERT INTO app_private.order_counters(restaurant_id,business_date,last_order_number)
         VALUES($1,($2::timestamptz AT TIME ZONE 'Asia/Kolkata')::date,$3)
         ON CONFLICT(restaurant_id,business_date) DO UPDATE
         SET last_order_number=GREATEST(app_private.order_counters.last_order_number,excluded.last_order_number)`,
        [outletId, createdAt, order.number]
      );
    }

    const verification = await c.query<{
      items: string;
      order_count: string;
      tables: string;
      grants: string;
      member_count: string;
    }>(
      `SELECT
        (SELECT count(*)::text
         FROM jsonb_array_elements((SELECT document FROM menus WHERE id=$1)->'categories') AS cat(value)
         CROSS JOIN LATERAL jsonb_array_elements(cat.value->'items') AS dish(item)) AS items,
        (SELECT count(*)::text FROM orders WHERE restaurant_id=$2) AS order_count,
        (SELECT count(*)::text FROM restaurant_tables WHERE restaurant_id=$2) AS tables,
        (SELECT count(*)::text FROM entitlement_grants WHERE organization_id=$3
         AND operator='play-reviewer-fixture' AND revoked_at IS NULL) AS grants,
        (SELECT count(*)::text FROM organization_members
         WHERE organization_id=$3 AND user_id=$4 AND role='owner' AND is_active) AS member_count`,
      [menuId, outletId, organizationId, userId]
    );
    const status = verification.rows[0]!;
    if (
      Number(status.items) < 30 ||
      Number(status.order_count) < 10 ||
      Number(status.tables) < 8 ||
      Number(status.grants) !== 2 ||
      Number(status.member_count) !== 1
    ) throw new Error("Reviewer fixture failed its data integrity checks");
    await c.query("COMMIT");
    return {
      restaurant: outletName,
      dishes: Number(status.items),
      orders: Number(status.order_count),
      tables: Number(status.tables),
    };
  } catch (error) {
    await c.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}
