import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { verifySuperAdmin } from "@/lib/admin-guard";
import { getEditorialDetail } from "@/modules/food-encyclopedia/editorial-service";
import { newEditorialDraft } from "@/modules/food-encyclopedia/editorial-template";
import { EditorialEditor } from "../editor";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Edit food guide | Editorial Studio",
  robots: { index: false },
};
export default async function FoodEditorialPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await verifySuperAdmin();
  const { id } = await params;
  const entry = await getEditorialDetail(actor, id);
  if (!entry) notFound();
  return (
    <EditorialEditor
      initial={entry.draft ?? newEditorialDraft(entry.kind, entry.slug)}
      id={id}
      version={entry.version}
      status={entry.status}
      versions={entry.versions}
      publishedRevisionId={entry.publishedRevisionId}
    />
  );
}
