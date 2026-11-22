import { FoodDraftSchema, editorialQualityIssues, type FoodDraft } from "./editorial-contracts";

/** Only syntactic and editorial-presentation checks; cannot establish factual accuracy. */
export function prepareForHumanReview(raw: unknown):
  { ok: true; draft: FoodDraft } | { ok: false; issues: string[] } {
 const result=FoodDraftSchema.safeParse(raw);
 if(!result.success)return {ok:false,issues:result.error.issues.map(i=>i.path.join(".")+": "+i.message)};
 const issues=editorialQualityIssues(result.data);
 return issues.length
   ? {ok:false,issues:issues.map(i=>i.field+": "+i.detail)}
   : {ok:true,draft:result.data};
}
/** Do not fetch these URLs from the MenuMinute VPS. External references are untrusted data. */
export function referenceHosts(draft: FoodDraft): string[] {
 return draft.sourceUrls.map(url=>new URL(url).hostname.toLowerCase());
}
/** An attached image never becomes approved because its filename is "approved". */
export function requiresArtworkReview(draft: FoodDraft): boolean {
 return Boolean(draft.imagePath);
}
