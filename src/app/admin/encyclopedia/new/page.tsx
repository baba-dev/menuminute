import type { Metadata } from "next";
import { verifySuperAdmin } from "@/lib/admin-guard";
import { EditorialEditor } from "../editor";
import { newEditorialDraft } from "@/modules/food-encyclopedia/editorial-template";
export const metadata:Metadata={title:"New food guide | Editorial Studio",robots:{index:false}};
export default async function NewFoodGuidePage(){
 await verifySuperAdmin();
 return <EditorialEditor initial={newEditorialDraft()} id={null} version={0} status="draft" versions={[]} publishedRevisionId={null} />;
}
