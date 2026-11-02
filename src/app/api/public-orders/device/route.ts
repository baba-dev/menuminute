import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { env } from "@/lib/config/env";
import { boundedBytes } from "@/lib/bounded-input";
import { errorResponse } from "@/lib/request-context";
import { reserveOrderSource, verifiedOrderSource } from "@/modules/orders/rate-limit";
import {
  DEVICE_COOKIE,
  DEVICE_COOKIE_MAX_AGE_SECONDS,
  forgetDevice,
  lookupSavedContact,
  maskPhone,
  rememberDevice,
} from "@/modules/guest-device/service";

const noStore = { "cache-control": "private, no-store", vary: "Cookie" };
const tokenSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);

function disabled() {
  return NextResponse.json({ enabled: false }, { status: 404, headers: noStore });
}
async function limited(req: Request) {
  // Device calls share the guest tracking allowance: bounded per edge identity, fail closed.
  try {
    return !(await reserveOrderSource("tracking", verifiedOrderSource(req)));
  } catch {
    return null;
  }
}
function sameOrigin(req: Request) {
  return req.headers.get("origin") === new URL(env.APP_URL).origin;
}

async function observed_GET(req: Request) {
  try {
    if (!env.PUBLIC_DINER_DEVICE_ENABLED) return disabled();
    const tooMany = await limited(req);
    if (tooMany === null)
      return NextResponse.json({ message: "Temporarily unavailable" }, { status: 503 });
    if (tooMany)
      return NextResponse.json({ message: "Limit reached" }, { status: 429, headers: noStore });
    const token = tokenSchema.parse(new URL(req.url).searchParams.get("token"));
    const saved = await lookupSavedContact(token, (await cookies()).get(DEVICE_COOKIE)?.value);
    return NextResponse.json(
      saved
        ? { enabled: true, remembered: true, name: saved.name, phoneMasked: maskPhone(saved.phone) }
        : { enabled: true, remembered: false },
      { headers: noStore }
    );
  } catch (error) {
    return errorResponse(error, req);
  }
}

async function observed_POST(req: Request) {
  try {
    if (!env.PUBLIC_DINER_DEVICE_ENABLED) return disabled();
    if (!sameOrigin(req))
      return NextResponse.json({ message: "Invalid request origin" }, { status: 403 });
    if (!req.headers.get("content-type")?.startsWith("application/json"))
      return NextResponse.json({ message: "JSON required" }, { status: 415 });
    const tooMany = await limited(req);
    if (tooMany === null)
      return NextResponse.json({ message: "Temporarily unavailable" }, { status: 503 });
    if (tooMany)
      return NextResponse.json({ message: "Limit reached" }, { status: 429, headers: noStore });
    const body = JSON.parse((await boundedBytes(req, 4096)).toString("utf8"));
    const jar = await cookies();
    const { cookieToken } = await rememberDevice(body, jar.get(DEVICE_COOKIE)?.value);
    const response = NextResponse.json({ remembered: true }, { headers: noStore });
    response.cookies.set(DEVICE_COOKIE, cookieToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: DEVICE_COOKIE_MAX_AGE_SECONDS,
    });
    return response;
  } catch (error) {
    return errorResponse(error, req);
  }
}

async function observed_DELETE(req: Request) {
  try {
    if (!sameOrigin(req))
      return NextResponse.json({ message: "Invalid request origin" }, { status: 403 });
    const tooMany = await limited(req);
    if (tooMany === null)
      return NextResponse.json({ message: "Temporarily unavailable" }, { status: 503 });
    if (tooMany)
      return NextResponse.json({ message: "Limit reached" }, { status: 429, headers: noStore });
    const jar = await cookies();
    await forgetDevice(jar.get(DEVICE_COOKIE)?.value);
    const response = NextResponse.json({ remembered: false }, { headers: noStore });
    // Always clear the cookie, even with the feature switched off, so a withdrawn device stays gone.
    response.cookies.set(DEVICE_COOKIE, "", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    return errorResponse(error, req);
  }
}

export const GET = observedRoute(observed_GET);
export const POST = observedRoute(observed_POST);
export const DELETE = observedRoute(observed_DELETE);
