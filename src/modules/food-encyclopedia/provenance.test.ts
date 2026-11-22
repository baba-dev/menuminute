import { describe, it, expect } from "vitest";
import { prepareForHumanReview, referenceHosts, requiresArtworkReview } from "./provenance";
import { newEditorialDraft } from "./editorial-template";
describe("Food Encyclopedia editorial provenance", () => {
  it("requires citations before a guide can enter human review", () => {
    const draft = newEditorialDraft();
    const result = prepareForHumanReview(draft);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some((i) => i.includes("sourceUrls"))).toBe(true);
  });
  it("rejects embedded credentials and HTTP sources", () => {
    const draft = {
      ...newEditorialDraft(),
      sourceUrls: ["https://user:pass@example.com/source", "http://example.org/page"],
    };
    expect(prepareForHumanReview(draft).ok).toBe(false);
  });
  it("checks hostnames without performing a network request", () => {
    const draft = {
      ...newEditorialDraft(),
      sourceUrls: ["https://www.fao.org/foo", "https://fdc.nal.usda.gov/bar"],
    };
    expect(referenceHosts(draft)).toEqual(["www.fao.org", "fdc.nal.usda.gov"]);
  });
  it("never infers media rights from a local asset path", () => {
    const draft = {
      ...newEditorialDraft(),
      imagePath: "/assets/food/dishes/indian/paneer-tikka.png",
    };
    expect(requiresArtworkReview(draft)).toBe(true);
  });
});
