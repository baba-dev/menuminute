import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GuestsWorkspace } from "../src/app/(dashboard)/dashboard/guests/guests-workspace";
import type { GuestList } from "../src/modules/crm/service";

const props = {
  organizationId: "organization_demo",
  outletId: "outlet_demo",
  outletName: "Baba Bakery",
};

function render(initial: GuestList) {
  return renderToStaticMarkup(<GuestsWorkspace {...props} initial={initial} />);
}

describe("guest directory presentation", () => {
  it("keeps the primary action, summary and searchable directory on the page", () => {
    const html = render({ total: 0, items: [] });

    expect(html).toContain("Know your guests.");
    expect(html).toContain("Baba Bakery · Private guest directory");
    expect(html).toContain("Add guest");
    expect(html).toContain("Search by name or phone");
    expect(html).toContain("Your guest book starts here");
  });

  it("keeps every table field in the markup for desktop and mobile layouts", () => {
    const html = render({
      total: 12,
      items: [
        {
          id: "guest_1",
          name: "Mira",
          phone: "9876543210",
          visits: 3,
          lastVisit: "2026-10-31T12:00:00.000Z",
        },
      ],
    });

    expect(html).toContain('data-label="Guest"');
    expect(html).toContain('data-label="Mobile"');
    expect(html).toContain('data-label="Visits here"');
    expect(html).toContain('data-label="Last visit"');
    expect(html).toContain('aria-label="View profile for Mira"');
    expect(html).toContain("RETURNING GUESTS SHOWN");
    expect(html).toContain("among ");
    expect(html).not.toContain("9876543210");
  });
});
