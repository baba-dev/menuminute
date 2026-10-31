import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { requestContext, errorResponse } from "@/lib/request-context";
import {
  getReservations,
  createReservation,
  updateReservationStatus,
} from "@/modules/hospitality/floor-service";
import { createReservationInputSchema } from "@/modules/hospitality/floor-contracts";
import { z } from "zod";

async function observed_GET(req: Request) {
  try {
    const { actor, restaurant } = await requestContext(req);
    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date");
    const targetDate = dateParam ? z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(dateParam) : undefined;
    const rows = await getReservations(actor, restaurant.id, targetDate);
    return NextResponse.json(rows);
  } catch (e) {
    return errorResponse(e, req);
  }
}

async function observed_POST(req: Request) {
  try {
    const { actor, restaurant } = await requestContext(req, true);
    const body = await req.json();
    const input = createReservationInputSchema.parse(body);
    const created = await createReservation(actor, restaurant.id, input);
    return NextResponse.json(created);
  } catch (e) {
    return errorResponse(e, req);
  }
}

async function observed_PATCH(req: Request) {
  try {
    const { actor, restaurant } = await requestContext(req, true);
    const body = await req.json();
    const { reservationId, status } = z
      .object({
        reservationId: z.string().min(1),
        status: z.enum(["confirmed", "seated", "completed", "cancelled", "no_show"]),
      })
      .parse(body);

    await updateReservationStatus(actor, restaurant.id, reservationId, status);
    return NextResponse.json({ success: true, reservationId, status });
  } catch (e) {
    return errorResponse(e, req);
  }
}

export const GET = observedRoute(observed_GET);
export const POST = observedRoute(observed_POST);
export const PATCH = observedRoute(observed_PATCH);
