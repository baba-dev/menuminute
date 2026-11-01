import type { FloorOverview } from "@/modules/hospitality/floor-contracts";

/** Thin typed client for the floor routes. Throws Error(message) with the server's friendly text. */
export async function floorRequest<T = unknown>(
  outletId: string,
  path: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET",
  body?: unknown
): Promise<T> {
  const response = await fetch(`/api/floor${path}`, {
    method,
    // The server rejects any mutation without a JSON content type, including body-less DELETEs.
    headers: { "x-outlet-id": outletId, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    throw new FloorRequestError(
      payload.message ?? "Something went wrong. Please try again.",
      response.status
    );
  }
  return (await response.json()) as T;
}

export class FloorRequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

export const fetchOverview = (outletId: string) => floorRequest<FloorOverview>(outletId, "");
