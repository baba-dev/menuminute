import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/request-context";
import { verifiedOrderSource } from "@/modules/orders/rate-limit";
import { publicWeek } from "@/modules/tiffin/service";
import {
  reserveTiffinPublicSource,
  reserveTiffinPublicToken,
  tiffinRoutesEnabled,
} from "@/modules/tiffin/rate-limit";

const tokenSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
const querySchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((v) => {
      const d = new Date(`${v}T00:00:00Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
    }, "Invalid date")
    .optional(),
  days: z
    .string()
    .regex(/^\d{1,2}$/)
    .transform(Number)
    // The public route serves at most 7 days per request (the SQL function accepts 1-14).
    .pipe(z.number().int().min(1).max(7))
    .optional(),
});
const noStore = { "cache-control": "no-store" };
// Identical for flag off, malformed, unknown, revoked and unpublished tokens.
const notFound = () =>
  NextResponse.json({ message: "Menu unavailable" }, { status: 404, headers: noStore });

async function observed_GET(
  req: Request,
  { params }: { params: Promise<{ publicMenuId: string }> }
) {
  try {
    if (!tiffinRoutesEnabled()) return notFound();
    let source: string;
    try {
      source = verifiedOrderSource(req);
      if (!(await reserveTiffinPublicSource("week", source))) {
        return NextResponse.json(
          { message: "Too many requests. Please try again shortly." },
          { status: 429, headers: noStore }
        );
      }
    } catch {
      return NextResponse.json(
        { message: "Menu temporarily unavailable" },
        { status: 503, headers: noStore }
      );
    }
    const token = tokenSchema.safeParse((await params).publicMenuId);
    if (!token.success) return notFound();
    try {
      if (!(await reserveTiffinPublicToken("week", source, token.data))) {
        return NextResponse.json(
          { message: "Too many requests. Please try again shortly." },
          { status: 429, headers: noStore }
        );
      }
    } catch {
      return NextResponse.json(
        { message: "Menu temporarily unavailable" },
        { status: 503, headers: noStore }
      );
    }
    const search = new URL(req.url).searchParams;
    const query = querySchema.parse({
      from: search.get("from") ?? undefined,
      days: search.get("days") ?? undefined,
    });
    const week = await publicWeek(token.data, query.from, query.days);
    if (!week) return notFound();
    return NextResponse.json(week, { headers: noStore });
  } catch (err) {
    const res = errorResponse(err, req);
    res.headers.set("cache-control", "no-store");
    return res;
  }
}

export const GET = observedRoute(observed_GET);
