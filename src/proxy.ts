import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  // Reject caller-supplied identities; provide one correlation ID per API request.
  const id = crypto.randomUUID();
  const headers = new Headers(request.headers);
  headers.set("x-request-id", id);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("x-request-id", id);
  return response;
}

export const config = { matcher: "/api/:path*" };
