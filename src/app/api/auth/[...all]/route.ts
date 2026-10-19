import { toNextJsHandler } from "better-auth/next-js";
import { authServer } from "@/lib/auth";
import { allowAuthRequest } from "@/lib/auth-abuse";
const handler = toNextJsHandler(authServer);
export const GET = handler.GET;
export async function POST(request: Request) {
  try {
    if (!(await allowAuthRequest(request)))
      return Response.json(
        { message: "Too many authentication requests" },
        { status: 429, headers: { "cache-control": "no-store" } }
      );
  } catch {
    return Response.json(
      { message: "Authentication temporarily unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } }
    );
  }
  return handler.POST(request);
}
