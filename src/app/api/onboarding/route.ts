import { auth } from "@/lib/auth";
import { requestActor, errorResponse } from "@/lib/request-context";
import { saveOnboarding, onboardingState, provisionOnboarding } from "@/modules/onboarding/service";
import { NextResponse } from "next/server";
import { UnauthorizedError } from "@/lib/errors";
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session) throw new UnauthorizedError();
    return NextResponse.json(await onboardingState({ userId: session.user.id }));
  } catch (e) {
    return errorResponse(e, req);
  }
}
export async function PATCH(req: Request) {
  try {
    return NextResponse.json(await saveOnboarding(await requestActor(req, true), await req.json()));
  } catch (e) {
    return errorResponse(e, req);
  }
}
export async function POST(req: Request) {
  try {
    return NextResponse.json(await provisionOnboarding(await requestActor(req, true)));
  } catch (e) {
    return errorResponse(e, req);
  }
}
