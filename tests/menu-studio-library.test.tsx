import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  StudioMenuGallery,
  libraryMenus,
  menuLibraryStatus,
  type MenuLibraryEntry,
} from "@/components/menu-product/studio-menu-gallery";
import { StudioMenuSelector } from "@/components/menu-product/studio-menu-selector";
import { menuDocumentSchema } from "@/modules/menu-product/contracts";

function menu(name: string, id: string, options?: { archived?: boolean; published?: boolean }) {
  const document = menuDocumentSchema.parse({
    name,
    currency: "INR",
    categories: [
      {
        id: "mains",
        name: "Main Dish",
        items: [
          { id: id + "-dish", name: "Paneer Tikka", description: "Spiced paneer", priceMinor: 3100 },
          { id: id + "-removed", name: "Hidden dish", priceMinor: 4000, archived: true },
        ],
      },
      { id: "removed-category", name: "Archived section", archived: true,
        items: [{ id: "old-dish", name: "Do not show", priceMinor: 100 }] },
    ],
  });
  return {
    id,
    document,
    archived: options?.archived ?? false,
    publishedRevision: options?.published ? 2 : null,
    revision: options?.published ? 2 : 1,
  } satisfies MenuLibraryEntry;
}

const noAction = async () => true;

describe("Menu Library gallery and selector", () => {
  it("parses saved menu documents and distinguishes live, draft, and recoverable menus", () => {
    const active = menu("Our menu", "active", { published: true });
    const draft = menu("Breakfast", "draft");
    const archived = menu("Old selection", "archived", { archived: true });
    expect(libraryMenus([active])[0]?.title).toBe("Our menu");
    expect(menuLibraryStatus(active)).toBe("Live");
    expect(menuLibraryStatus({ ...active, revision: 3 })).toBe("Live + draft");
    expect(menuLibraryStatus(draft)).toBe("Private draft");
    expect(menuLibraryStatus(archived)).toBe("Recently deleted");
    expect(libraryMenus([{ ...active, document: {} }])[0]?.parsed).toBeNull();
  });

  it("renders authorized saved dish cards without archived dishes or categories", () => {
    const html = renderToStaticMarkup(
      <StudioMenuGallery
        open
        menus={[menu("Our menu", "active", { published: true })]}
        currentMenuId="active"
        currency="INR"
        busy={false}
        error=""
        onClose={() => {}}
        onCreate={noAction}
        onOpenMenu={async () => true}
        onPreviewMenu={async () => true}
        onManage={async () => true}
      />
    );
    expect(html).toContain("Paneer Tikka");
    expect(html).toContain("Spiced paneer");
    expect(html).toContain("Our menu");
    expect(html).toContain("Menu actions");
    expect(html).not.toContain("Hidden dish");
    expect(html).not.toContain("Do not show");
    expect(html).toContain("Preview draft");
  });

  it("keeps recoverable menus out of the active selector unless selected", () => {
    const entries = [menu("Our menu", "active"), menu("Deleted menu", "archived", { archived: true })];
    const active = renderToStaticMarkup(
      <StudioMenuSelector
        menus={entries}
        selectedId="active"
        disabled={false}
        onSelect={() => {}}
      />
    );
    expect(active).toContain("Our menu");
    expect(active).not.toContain("Deleted menu");
    const recovery = renderToStaticMarkup(
      <StudioMenuSelector
        menus={entries}
        selectedId="archived"
        disabled={false}
        onSelect={() => {}}
      />
    );
    expect(recovery).toContain("Deleted menu");
    expect(recovery).toContain("Recently deleted");
  });
});
