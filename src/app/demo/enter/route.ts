import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { authServer } from "@/lib/auth";
import { env } from "@/lib/config/env";
import { getPool } from "@/db";
import { DEMO_IDS, demoModeEnabled } from "@/modules/demo/ids";
import { demoPassword } from "@/modules/demo/credential";
import { allowDemoEntry } from "@/modules/demo/entry-limit";

export const dynamic = "force-dynamic";
const SESSION_HOURS = 2;
const back = (reason: string) =>
  NextResponse.redirect(new URL(`/demo?entry=${reason}`, env.APP_URL), 303);

/** One-click entry. POST only (a GET prefetch or crawler must never mint a session). */
export async function POST(req: Request) {
  if (!demoModeEnabled()) return back("unavailable");
  if (req.headers.get("origin") !== new URL(env.APP_URL).origin) return back("denied");
  if (!(await allowDemoEntry(req))) return back("busy");
  try {
    const result = await authServer.api.signInEmail({
      body: {
        email: DEMO_IDS.userEmail,
        password: demoPassword(env.AUTH_SECRET),
        rememberMe: false,
      },
      headers: req.headers,
    });
    // Bound the shared session server-side regardless of cookie lifetime, and prune stale ones.
    await getPool().query(
      "update sessions set expires_at=now()+make_interval(hours=>$2) where token=$1 and user_id=$3",
      [result.token, SESSION_HOURS, DEMO_IDS.userId]
    );
    await getPool().query("delete from sessions where user_id=$1 and expires_at<now()", [
      DEMO_IDS.userId,
    ]);
    (await cookies()).set("menuminute.outlet", DEMO_IDS.outletId, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_HOURS * 3600,
    });
    return NextResponse.redirect(new URL("/dashboard", env.APP_URL), 303);
  } catch {
    return back("error");
  }
}

export function GET() {
  return NextResponse.redirect(new URL("/demo", env.APP_URL), 303);
}
