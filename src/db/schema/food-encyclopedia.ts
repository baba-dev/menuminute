// Platform-owned editorial storage; no merchant tenancy scope or runtime table grants.
// Migration 0117 is authoritative; access only through narrow SECURITY DEFINER functions.
import { sql } from "drizzle-orm";
import {
  boolean, check, index, integer, jsonb, pgTable, text, timestamp, unique,
} from "drizzle-orm/pg-core";
const clock = () => timestamp("created_at",{withTimezone:true}).notNull().default(sql`clock_timestamp()`);
export const foodEntries = pgTable("food_entries",{
  id:text("id").primaryKey().default(sql`gen_random_uuid()::text`),
  kind:text("kind").notNull(), slug:text("slug").notNull(),
  status:text("status").notNull().default("draft"),
  version:integer("version").notNull().default(0),
  draftRevisionId:text("draft_revision_id"), reviewRevisionId:text("review_revision_id"),
  approvedRevisionId:text("approved_revision_id"), publishedRevisionId:text("published_revision_id"),
  publishedAt:timestamp("published_at",{withTimezone:true}),
  searchText:text("search_text").notNull().default(""),
  createdBy:text("created_by").notNull(), updatedBy:text("updated_by").notNull(),
  createdAt:clock(), updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().default(sql`clock_timestamp()`),
},(t)=>[unique("food_entries_kind_slug_key").on(t.kind,t.slug),
  check("food_entries_published_pointer_check",sql`(${t.publishedRevisionId} IS NULL) = (${t.publishedAt} IS NULL)`)
]);
export const foodRevisions=pgTable("food_revisions",{
 id:text("id").primaryKey().default(sql`gen_random_uuid()::text`),
 entryId:text("entry_id").notNull(),version:integer("version").notNull(),
 content:jsonb("content").$type<Record<string,unknown>>().notNull(),
 digest:text("digest").notNull(),authorId:text("author_id").notNull(),
 approved:boolean("approved").notNull().default(false),
 reviewedBy:text("reviewed_by"),reviewedAt:timestamp("reviewed_at",{withTimezone:true}),
 createdAt:clock(),
},(t)=>[unique("food_revisions_entry_version_key").on(t.entryId,t.version),
 unique("food_revisions_entry_id_key").on(t.entryId,t.id)]);
export const foodSources=pgTable("food_sources",{
 id:text("id").primaryKey().default(sql`gen_random_uuid()::text`),
 url:text("url").notNull().unique(), title:text("title").notNull().default(""),
 publisher:text("publisher").notNull().default(""),
 retrievedAt:timestamp("retrieved_at",{withTimezone:true}),createdAt:clock(),
});
export const foodEntrySources=pgTable("food_entry_sources",{
 revisionId:text("revision_id").notNull(),sourceId:text("source_id").notNull(),
 sectionId:text("section_id").notNull().default(""),
});
export const foodAliases=pgTable("food_aliases",{
 entryId:text("entry_id").notNull(),alias:text("alias").notNull(),
 normalized:text("normalized").notNull(),
});
export const foodRelations=pgTable("food_relations",{
 entryId:text("entry_id").notNull(),relatedEntryId:text("related_entry_id").notNull(),
 relation:text("relation").notNull().default("related"),
});
export const foodMedia=pgTable("food_media",{
 id:text("id").primaryKey().default(sql`gen_random_uuid()::text`),
 entryId:text("entry_id").notNull(),path:text("path").notNull(),altText:text("alt_text").notNull(),
 license:text("license").notNull().default("pending"),
 attribution:text("attribution").notNull().default(""),
 rightsApproved:boolean("rights_approved").notNull().default(false),
 verifiedBy:text("verified_by"),verifiedAt:timestamp("verified_at",{withTimezone:true}),createdAt:clock(),
});
export const foodEditorialEvents=pgTable("food_editorial_events",{
 id:text("id").primaryKey().default(sql`gen_random_uuid()::text`),
 entryId:text("entry_id").notNull(),revisionId:text("revision_id"),
 action:text("action").notNull(),actorId:text("actor_id").notNull(),
 details:jsonb("details").$type<Record<string,unknown>>().notNull().default({}),createdAt:clock(),
},(t)=>[index("food_editorial_events_entry_idx").on(t.entryId,t.createdAt)]);
export const foodRedirects=pgTable("food_redirects",{
 kind:text("kind").notNull(),oldSlug:text("old_slug").notNull(),entryId:text("entry_id").notNull(),
});
