"use server";
import { verifySuperAdmin } from "@/lib/admin-guard";
import { revalidatePath } from "next/cache";
import { importCandidateQueue } from "@/modules/food-encyclopedia/catalogue";
export async function queueExistingDishCatalogue(
  key: string
): Promise<{ ok: boolean; message: string }> {
  const actor = await verifySuperAdmin();
  if (!/^[0-9a-f-]{36}$/.test(key)) return { ok: false, message: "Invalid request key." };
  try {
    const result = await importCandidateQueue(actor, key);
    revalidatePath("/admin/encyclopedia/import");
    return {
      ok: true,
      message: `${result.imported} new candidates queued (${result.total} considered). No article has been published.`,
    };
  } catch {
    return {
      ok: false,
      message:
        "The import could not be recorded. Verify step-up, migration and database permissions.",
    };
  }
}
