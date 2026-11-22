import type { Metadata } from "next";
import { verifySuperAdmin } from "@/lib/admin-guard";
import { EditorialEditor } from "../editor";
import { newEditorialDraft } from "@/modules/food-encyclopedia/editorial-template";
import { catalogueCandidates, draftFromCandidate } from "@/modules/food-encyclopedia/catalogue";
export const metadata:Metadata={title:"New food guide | Editorial Studio",robots:{index:false}};
export default async function NewFoodGuidePage({searchParams}:{searchParams:Promise<{candidate?:string}>}){
 await verifySuperAdmin();
 const params=await searchParams;
 const candidate=catalogueCandidates.find(x=>x.id===params.candidate);
 return <EditorialEditor initial={candidate?draftFromCandidate(candidate):newEditorialDraft()} id={null} version={0} status="draft" versions={[]} publishedRevisionId={null}/>;
}
