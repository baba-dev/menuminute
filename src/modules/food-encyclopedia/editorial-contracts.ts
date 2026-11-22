import { z } from "zod";
import { foodKinds } from "./contracts";

/** Editorial identity is platform-wide, never a merchant-owned dish or tenancy scope. */
const slug = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(90);
const httpsUrl = z
  .string()
  .url()
  .max(1000)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch {
      return false;
    }
  }, "A public HTTPS source is required");

export const FoodDraftSchema = z
  .object({
    kind: z.enum(foodKinds),
    slug,
    title: z.string().trim().min(3).max(100),
    eyebrow: z.string().trim().min(3).max(120),
    description: z.string().trim().min(35).max(320),
    tint: z.enum(["cream", "sage", "blue", "peach", "lavender"]),
    imagePath: z
      .string()
      .regex(/^\/assets\/food\/dishes\/[a-zA-Z0-9/_-]+\.(?:png|webp|avif)$/)
      .max(240)
      .optional(),
    imageAlt: z.string().trim().max(200).optional(),
    aliases: z.array(z.string().trim().min(2).max(90)).max(20).default([]),
    facts: z
      .array(
        z
          .object({
            label: z.string().trim().min(2).max(40),
            value: z.string().trim().min(2).max(140),
          })
          .strict()
      )
      .min(2)
      .max(8),
    sections: z
      .array(
        z
          .object({
            id: slug,
            eyebrow: z.string().trim().min(3).max(80),
            title: z.string().trim().min(3).max(150),
            body: z.array(z.string().trim().min(25).max(1800)).min(1).max(6),
          })
          .strict()
      )
      .min(2)
      .max(12),
    sourceUrls: z.array(httpsUrl).max(20).default([]),
    relatedSlugs: z.array(slug).max(20).default([]),
    caution: z.string().trim().min(20).max(650).optional(),
  })
  .strict();
export type FoodDraft = z.infer<typeof FoodDraftSchema>;
export const FoodEditorialActionSchema = z.enum([
  "create",
  "save",
  "submit",
  "approve",
  "publish",
  "unpublish",
  "restore",
]);
export type FoodEditorialAction = z.infer<typeof FoodEditorialActionSchema>;
export type FoodWorkflowStatus = "draft" | "in_review" | "approved" | "published" | "archived";
export type FoodEditorialRow = {
  id: string;
  kind: FoodDraft["kind"];
  slug: string;
  title: string;
  status: FoodWorkflowStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  hasPublishedVersion: boolean;
  publishedAt: string | null;
};
export type FoodEditorialDetail = FoodEditorialRow & {
  draft: FoodDraft | null;
  versions: Array<{
    id: string;
    version: number;
    authorId: string;
    reviewedBy: string | null;
    reviewedAt: string | null;
    createdAt: string;
    approved: boolean;
  }>;
  publishedRevisionId: string | null;
  draftRevisionId: string | null;
  reviewRevisionId: string | null;
  approvedRevisionId: string | null;
  events: Array<{ action: string; actorId: string; createdAt: string; revisionId: string | null }>;
};

export type QualityIssue = { field: string; detail: string };
/** Human editorial review is still mandatory even when this local checker is satisfied. */
export function editorialQualityIssues(draft: FoodDraft): QualityIssue[] {
  const issues: QualityIssue[] = [];
  if (draft.sourceUrls.length < 2)
    issues.push({
      field: "sourceUrls",
      detail: "At least two credible independent sources are required",
    });
  if (new Set(draft.sourceUrls).size !== draft.sourceUrls.length)
    issues.push({ field: "sourceUrls", detail: "Duplicate source URLs" });
  if (new Set(draft.sections.map((s) => s.id)).size !== draft.sections.length)
    issues.push({ field: "sections", detail: "Section IDs must be unique" });
  if (new Set(draft.aliases.map((a) => a.toLocaleLowerCase())).size !== draft.aliases.length)
    issues.push({ field: "aliases", detail: "Aliases must be unique" });
  const copy = draft.sections.flatMap((s) => s.body).join(" ");
  if (copy.trim().split(/\s+/u).length < 110)
    issues.push({
      field: "sections",
      detail:
        "Article needs more useful, original explanatory content (110 words minimum for this pilot)",
    });
  if (draft.imagePath && (!draft.imageAlt || draft.imageAlt.length < 15))
    issues.push({
      field: "imageAlt",
      detail: "Meaningful alternative text is required for illustrations",
    });
  return issues;
}

export function transitionAllowed(
  status: FoodWorkflowStatus,
  action: FoodEditorialAction
): boolean {
  if (action === "create") return status === "draft";
  if (action === "save") return true; // creates a NEW revision; never edits an approved one
  if (action === "submit") return status === "draft";
  if (action === "approve") return status === "in_review";
  if (action === "publish") return status === "approved";
  if (action === "unpublish") return status === "published";
  if (action === "restore") return true; // requires a previously approved revision in SQL
  return false;
}
