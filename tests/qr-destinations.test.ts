import { describe, it, expect } from "vitest";
import { generateMenuQrCode } from "../src/modules/qr/service";
import { getRestaurantByPublicId } from "../src/modules/restaurants/service";
import { getDb } from "../src/db";
import { restaurants } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

describe("Stable Public-Menu QR Destinations", () => {
  it("should generate valid SVG and PNG data URL for destination token", async () => {
    const token = "demo-spice-route-kitchen-v1";
    const result = await generateMenuQrCode(token);

    expect(result.destinationUrl).toContain(`/m/${token}`);
    expect(result.svgData).toContain("<svg");
    expect(result.dataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it("should ensure QR resolution remains intact when restaurant name/slug changes", () => {
    const db = getDb();
    const originalPublicId = `stable-qr-token-${nanoid(8)}`;
    const originalSlug = `original-cafe-${nanoid(4)}`;

    // Create restaurant
    const rest = db
      .insert(restaurants)
      .values({
        id: nanoid(),
        publicId: originalPublicId,
        name: "Original Cafe Name",
        slug: originalSlug,
        currency: "INR",
      })
      .returning()
      .get();

    // 1. Initial resolution by publicId succeeds
    const foundInitial = getRestaurantByPublicId(originalPublicId);
    expect(foundInitial?.id).toBe(rest.id);
    expect(foundInitial?.name).toBe("Original Cafe Name");

    // 2. Restaurant rebrands: updates name and slug
    db.update(restaurants)
      .set({
        name: "Rebranded Grand Bistro",
        slug: `rebranded-bistro-${nanoid(4)}`,
      })
      .where(eq(restaurants.id, rest.id))
      .run();

    // 3. QR code with original opaque token STILL resolves to the same restaurant
    const foundAfterRebrand = getRestaurantByPublicId(originalPublicId);
    expect(foundAfterRebrand?.id).toBe(rest.id);
    expect(foundAfterRebrand?.name).toBe("Rebranded Grand Bistro");
  });
});
