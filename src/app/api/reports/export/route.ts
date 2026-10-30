import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ForbiddenError } from "@/lib/errors";
import { reportQuerySchema } from "@/modules/reports/contracts";
import { exportReportCsv } from "@/modules/reports/service";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const outlet = await getDefaultOrActiveRestaurant(session.user.id, session.activeOutletId);

  if (!outlet) {
    return new NextResponse("Outlet not found", { status: 404 });
  }

  const parsedQuery = reportQuerySchema.safeParse({
    range: searchParams.get("range") ?? "today",
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    fulfillmentMode: searchParams.get("fulfillmentMode") ?? "all",
    tab: searchParams.get("tab") ?? "overview",
  });

  if (!parsedQuery.success) {
    return new NextResponse("Invalid query parameters", { status: 400 });
  }

  try {
    const actor = { userId: session.user.id, sessionId: session.session?.id };
    const { filename, content } = await exportReportCsv(
      actor,
      outlet.id,
      parsedQuery.data.tab,
      parsedQuery.data
    );

    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    console.error("[reports] Export failed", err);
    return new NextResponse("Failed to generate report export", { status: 500 });
  }
}
