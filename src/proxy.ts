import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  // Reject caller-supplied identities; provide one correlation ID per API request.
  const id = crypto.randomUUID();
  const headers = new Headers(request.headers);
  headers.set("x-request-id", id);
  headers.set("x-trace-id", id);
  headers.set("x-request-start", String(Date.now()));
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("x-request-id", id);
  response.headers.set("x-trace-id", id);
  return response;
}

export const config = { matcher: "/api/:path*" };
