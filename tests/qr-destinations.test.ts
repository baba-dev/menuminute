import { it, expect } from "vitest";
import { fixture, admin } from "./helpers";
import { getPublicMenu } from "../src/modules/restaurants/service";
import { generateMenuQrCode } from "../src/modules/qr/service";
it("preserves printed QR identity through renames and revokes explicitly", async () => {
  const { outlet } = await fixture();
  const qr = await generateMenuQrCode(outlet.publicId);
  expect(qr.destinationUrl).toBe(`http://localhost:3000/m/${outlet.publicId}`);
  expect(qr.svgData).toContain("<svg");
  await admin(async (_db, pool) => {
    await pool.query(
      "update restaurants set name='Renamed',slug='changed-'||id,is_published=true where id=$1",
      [outlet.id]
    );
  });
  expect((await getPublicMenu(outlet.publicId))?.restaurant.name).toBe("Renamed");
  await admin(async (_db, pool) => {
    await pool.query("update qr_codes set is_active=false where restaurant_id=$1", [outlet.id]);
  });
  expect(await getPublicMenu(outlet.publicId)).toBeNull();
});
