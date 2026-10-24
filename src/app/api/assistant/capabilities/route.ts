import { NextResponse } from "next/server";
import { requestActor, errorResponse } from "@/lib/request-context";
import { env } from "@/lib/config/env";
import { conversationInput } from "@/modules/intelligence/store";
import { authorizedToolDefinitions } from "@/modules/intelligence/read-tools";
import { withActor } from "@/modules/tenancy/service";
import { sql } from "drizzle-orm";
import { navigationForPermissions } from "@/modules/intelligence/navigation";
export async function GET(req: Request) {
  try {
    const actor = await requestActor(req);
    const scope = conversationInput
      .omit({ key: true })
      .parse(Object.fromEntries(new URL(req.url).searchParams));
    const s = { ...scope, actor };
    const tools = await authorizedToolDefinitions(s);
    const menuWrite = await withActor(actor, async (tx) => {
      await tx.execute(sql`select set_config('app.outlet_id',${scope.outletId},true)`);
      const r = await tx.execute<{ allowed: boolean }>(
        sql`select app_private.can_outlet(${scope.outletId},'menu.write') as allowed`
      );
      return r.rows[0]?.allowed === true;
    });
    return NextResponse.json(
      {
        enabled: env.AI_ASSISTANT_READ_ONLY_ENABLED,
        actionsEnabled:
          env.AI_ASSISTANT_READ_ONLY_ENABLED && env.AI_ASSISTANT_ACTIONS_ENABLED && menuWrite,
        tools: tools.map((t) => t.name),
        navigation: navigationForPermissions({
          menuRead: tools.some((t) => t.name === "menu.summary"),
          ordersRead: tools.some((t) => t.name === "orders.pulse"),
          menuWrite,
        }),
      },
      { headers: { "cache-control": "private, no-store" } }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
