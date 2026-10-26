import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { requestContext, errorResponse } from "@/lib/request-context";
import { boundedJson } from "@/lib/bounded-input";
import { AppError } from "@/lib/errors";
import { withActor } from "@/modules/tenancy/service";
import { domainError } from "@/modules/organizations/service";
import { importId } from "@/modules/menu-import/contracts";
import { importEngineEnabled } from "@/modules/menu-import/nvidia";
type C = { params: Promise<{ importId: string }> };
const command = z
  .object({ expectedRevision: z.number().int().positive(), consent: z.literal(true) })
  .strict();
export async function POST(req: Request, c: C) {
  try {
    const { actor, restaurant } = await requestContext(req, true);
    if (!importEngineEnabled())
      throw new AppError(
        "AI extraction is not enabled for this deployment",
        "IMPORT_ENGINE_DISABLED",
        503
      );
    const id = importId.parse((await c.params).importId),
      input = command.parse(await boundedJson(req));
    let result: { id: string; status: string; revision: number };
    try {
      result = await withActor(
        actor,
        async (tx) =>
          (
            await tx.execute<{ result: typeof result }>(
              sql`select app_private.import_enqueue(${restaurant.id},${id},${input.expectedRevision}) as result`
            )
          ).rows[0]!.result
      );
    } catch (err) {
      domainError(err);
    }
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    return errorResponse(err, req);
  }
}
