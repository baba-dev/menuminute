import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { admin, fixture } from "./helpers";

// No request scope in tests: admission control is exercised by security-phase-f's source check.
vi.mock("../src/modules/menu-product/public-ssr-admission", () => ({
  admitPublicMenuRender: async () => true,
}));

import WeekPage, { generateMetadata } from "../src/app/(public-menu)/m/[publicMenuId]/week/page";
import MenuPage from "../src/app/(public-menu)/m/[publicMenuId]/page";

beforeEach(() => {
  vi.stubEnv("TIFFIN_ENABLED", "true");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

async function outlet(type: "tiffin" | "restaurant") {
  const f = await fixture();
  await admin(async (_db, pool) => {
    await pool.query("update restaurants set outlet_type=$2,is_published=true where id=$1", [
      f.outlet.id,
      type,
    ]);
  });
  return f.outlet.publicId;
}
const digest = async (work: Promise<unknown>) => {
  try {
    await work;
  } catch (e) {
    return String((e as { digest?: string }).digest ?? e);
  }
  return null;
};
const weekProps = (id: string) => ({ params: Promise.resolve({ publicMenuId: id }) });
const menuProps = (id: string) => ({
  params: Promise.resolve({ publicMenuId: id }),
  searchParams: Promise.resolve({}),
});

describe("public weekly menu page", () => {
  it("renders the week for a published tiffin outlet with the flag on", async () => {
    const id = await outlet("tiffin");
    const el = await WeekPage(weekProps(id));
    expect(el).toBeTruthy();
    expect(el.props.week.outlet.name).toBe("Fixture Kitchen");
    expect(el.props.week.days).toHaveLength(7);
    const meta = await generateMetadata(weekProps(id));
    expect(meta.title).toBe("Fixture Kitchen — This week's menu");
    expect(meta.alternates?.canonical).toBe(`/m/${id}/week`);
  });

  it("is not found for flag off, unknown token and restaurant outlets", async () => {
    const id = await outlet("tiffin");
    const restaurant = await outlet("restaurant");
    vi.stubEnv("TIFFIN_ENABLED", "false");
    expect(await digest(WeekPage(weekProps(id)))).toContain("404");
    vi.stubEnv("TIFFIN_ENABLED", "true");
    expect(await digest(WeekPage(weekProps(restaurant)))).toContain("404");
    expect(await digest(WeekPage(weekProps("nosuchtokenxxxxxxxxxxxx")))).toContain("404");
    const meta = await generateMetadata(weekProps(restaurant));
    expect(meta.robots).toEqual({ index: false, follow: false });
  });

  it("redirects the menu page to the week only for a tiffin outlet with the flag on", async () => {
    const tiffin = await outlet("tiffin");
    const restaurant = await outlet("restaurant");
    const redirected = await digest(MenuPage(menuProps(tiffin)));
    expect(redirected).toContain("NEXT_REDIRECT");
    expect(redirected).toContain(`/m/${tiffin}/week`);
    expect(await digest(MenuPage(menuProps(restaurant)))).toBeNull();
    vi.stubEnv("TIFFIN_ENABLED", "false");
    expect(await digest(MenuPage(menuProps(tiffin)))).toBeNull();
    vi.stubEnv("TIFFIN_ENABLED", "garbage");
    expect(await digest(MenuPage(menuProps(tiffin)))).toBeNull();
  });
});
