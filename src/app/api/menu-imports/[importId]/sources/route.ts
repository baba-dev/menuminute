import { NextResponse } from "next/server";
import { requestContext, errorResponse } from "@/lib/request-context";
import { env } from "@/lib/config/env";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import { boundedBytes } from "@/lib/bounded-input";
import { addImportSource } from "@/modules/menu-import/service";
type C = { params: Promise<{ importId: string }> };
export async function POST(req: Request, c: C) {
  try {
    if (req.headers.get("origin") !== new URL(env.APP_URL).origin) throw new ForbiddenError();
    if (!["image/jpeg", "image/png", "image/webp"].includes(req.headers.get("content-type") ?? ""))
      throw new ValidationError("Choose a JPEG, PNG or WebP source image");
    const { actor, restaurant } = await requestContext(req);
    const { importId } = await c.params;
    const result = await addImportSource(
      actor,
      restaurant.id,
      importId,
      {
        id: req.headers.get("x-import-source-id"),
        pageIndex: req.headers.get("x-import-page-index"),
      },
      await boundedBytes(req, 5242880)
    );
    return NextResponse.json(result, {
      status: result.duplicate ? 200 : 201,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error, req);
  }
}
