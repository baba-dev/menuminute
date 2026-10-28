import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  // This is the public trust boundary: never let a client choose a log correlation identity.
  const id = crypto.randomUUID();
  const headers = new Headers(request.headers);
  headers.set("x-request-id", id);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("x-request-id", id);
  return response;
}

export const proxy = middleware;

export const config = { matcher: "/api/:path*" };
