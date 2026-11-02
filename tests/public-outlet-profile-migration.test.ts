import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationDir = path.resolve("src/db/migrations");
const migration = readFileSync(path.join(migrationDir, "0084_public_outlet_profile.sql"), "utf8");
const journal = JSON.parse(readFileSync(path.join(migrationDir, "meta/_journal.json"), "utf8")) as {
  entries: Array<{ tag: string }>;
};

describe("public restaurant profile deployment contract", () => {
  it("registers the profile migration in the actual migration runner journal", () => {
    expect(journal.entries.some(({ tag }) => tag === "0084_public_outlet_profile")).toBe(true);
  });

  it("preserves plan-based menu projection and the active QR/outlet authorization gates", () => {
    expect(migration).toContain("app_private.plan_filter_document(r.id,rel.document)");
    expect(migration).toContain("q.destination_token=p_token AND q.is_active");
    expect(migration).toContain("r.is_active AND r.is_published AND org.is_active");
  });

  it("publishes only guest-facing profile fields and never operational contacts", () => {
    expect(migration).toContain("'profile',jsonb_build_object(");
    for (const field of ["r.phone", "r.email", "r.website", "r.latitude", "r.longitude"]) {
      expect(migration).toContain(field);
    }
    for (const secret of [
      "r.operations_contact_name",
      "r.operations_contact_phone",
      "r.operations_contact_email",
    ]) {
      expect(migration).not.toContain(secret);
    }
  });
});
