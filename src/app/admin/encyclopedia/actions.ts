"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { verifySuperAdmin } from "@/lib/admin-guard";
import {
  FoodDraftSchema,
  FoodEditorialActionSchema,
  type FoodDraft,
} from "@/modules/food-encyclopedia/editorial-contracts";
import { runEditorialCommand } from "@/modules/food-encyclopedia/editorial-service";

const requestSchema = z
  .object({
    action: z.union([FoodEditorialActionSchema, z.literal("media.approve"), z.literal("import")]),
    target: z.string().max(100).min(1),
    expectedVersion: z.number().int().min(0).optional(),
    content: FoodDraftSchema.optional(),
    revisionId: z.string().uuid().optional(),
    path: z.string().max(240).optional(),
    license: z.enum(["owned", "commissioned", "cc0", "cc-by", "licensed"]).optional(),
    attribution: z.string().max(240).optional(),
    requestKey: z.string().uuid(),
  })
  .strict();
export type EditorialActionRequest = z.infer<typeof requestSchema>;
export type EditorialActionResponse =
  { ok: true; id: string; status?: string; version?: number } | { ok: false; error: string };

export async function submitEditorialAction(
  input: EditorialActionRequest
): Promise<EditorialActionResponse> {
  const actor = await verifySuperAdmin();
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "Invalid editorial fields. Review the form and retry." };
  const p = parsed.data;
  try {
    const receipt = await runEditorialCommand(
      actor,
      p.action,
      p.target,
      {
        ...(p.content ? { content: p.content } : {}),
        ...(p.expectedVersion !== undefined ? { expectedVersion: p.expectedVersion } : {}),
        ...(p.revisionId ? { revisionId: p.revisionId } : {}),
        ...(p.path ? { path: p.path } : {}),
        ...(p.license ? { license: p.license } : {}),
        ...(p.attribution !== undefined ? { attribution: p.attribution } : {}),
      },
      p.requestKey
    );
    revalidatePath("/admin/encyclopedia");
    revalidatePath("/explore");
    revalidatePath("/explore/browse");
    revalidatePath("/explore/search");
    revalidatePath("/sitemap.xml");
    if (p.content) revalidatePath("/explore/" + p.content.kind + "/" + p.content.slug);
    return { ok: true, id: receipt.id, status: receipt.status, version: receipt.version };
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === "42501")
      return {
        ok: false,
        error:
          "Administrator verification or a fresh password/TOTP step-up is required; a different person must approve authored revisions.",
      };
    if (code === "40001" || code === "23505")
      return {
        ok: false,
        error: "The entry changed or the request key conflicts. Reload before retrying.",
      };
    if (code === "22023")
      return {
        ok: false,
        error:
          "Editorial rules blocked this action. Review source, length, and workflow requirements.",
      };
    return {
      ok: false,
      error: "The editorial request could not be completed. No changes were published.",
    };
  }
}
