import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { requestActor, errorResponse } from "@/lib/request-context";
import { conversationInput } from "@/modules/intelligence/store";
import { availabilityOptions } from "@/modules/intelligence/actions";
export async function GET(req: Request) {
  try {
    const actor = await requestActor(req);
    if (!env.AI_ASSISTANT_ACTIONS_ENABLED || !env.AI_ASSISTANT_READ_ONLY_ENABLED)
      return NextResponse.json({ message: "Action previews are disabled" }, { status: 503 });
    const scope = conversationInput
      .omit({ key: true })
      .parse(Object.fromEntries(new URL(req.url).searchParams));
    return NextResponse.json(await availabilityOptions({ ...scope, actor }), {
      headers: { "cache-control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
