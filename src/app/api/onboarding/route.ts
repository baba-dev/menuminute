import { observedRoute } from "@/lib/observed-route";
import { auth } from "@/lib/auth";
import { requestActor, errorResponse } from "@/lib/request-context";
import { saveOnboarding, onboardingState, provisionOnboarding } from "@/modules/onboarding/service";
import { NextResponse } from "next/server";
import { UnauthorizedError } from "@/lib/errors";
async function observed_GET(req: Request) {
  try {
    const session = await auth();
    if (!session) throw new UnauthorizedError();
    const state = await onboardingState({ userId: session.user.id });
    return NextResponse.json({ ...state, userId: session.user.id });
  } catch (e) {
    return errorResponse(e, req);
  }
}
async function observed_PATCH(req: Request) {
  try {
    return NextResponse.json(await saveOnboarding(await requestActor(req, true), await req.json()));
  } catch (e) {
    return errorResponse(e, req);
  }
}
async function observed_POST(req: Request) {
  try {
    return NextResponse.json(await provisionOnboarding(await requestActor(req, true)));
  } catch (e) {
    return errorResponse(e, req);
  }
}

export const GET = observedRoute(observed_GET);
export const PATCH = observedRoute(observed_PATCH);
export const POST = observedRoute(observed_POST);
