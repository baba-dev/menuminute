import { describe, expect, it } from "vitest";
import { admin, fixture } from "./helpers";
import { publicOrderOutlet } from "../src/modules/orders/rate-limit";

describe("public ordering outlet resolution through restricted app role", () => {
  it("resolves only active, published and authorized public QR destinations", async () => {
    const { outlet } = await fixture();
    expect(await publicOrderOutlet(outlet.publicId)).toBeNull();
    await admin(async (_, pool) => {
      await pool.query("update restaurants set is_published=true where id=$1", [outlet.id]);
    });
    expect(await publicOrderOutlet(outlet.publicId)).toBe(outlet.id);
    expect(await publicOrderOutlet("an-invalid-qr-token")).toBeNull();
    await admin(async (_, pool) => {
      await pool.query("update qr_codes set is_active=false where destination_token=$1", [
        outlet.publicId,
      ]);
    });
    expect(await publicOrderOutlet(outlet.publicId)).toBeNull();
  });
});
