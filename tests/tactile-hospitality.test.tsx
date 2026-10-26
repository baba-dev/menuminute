import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  RubberStamp,
  ChefStickyNote,
  MiseEnPlaceEmpty,
  TableWelcome,
} from "@/components/ui/tactile-elements";
import { getServicePeriodText, outletHour } from "@/lib/service-period";
import { getGuestOrderNote, getOrderStampVariant } from "@/lib/hospitality-order-status";
import { The86Board } from "@/components/dashboard/eight-six-board";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("Hospitality production-safe presentation", () => {
  it("shows a status stamp with escaped content and appropriate style", () => {
    const html = renderToStaticMarkup(<RubberStamp text="86'd" variant="sold-out" />);
    expect(html).toContain("stamp-badge--sold-out");
    expect(html).toContain("86&#x27;d");
    expect(html).toContain('aria-label="Status: 86&#x27;d"');
    expect(renderToStaticMarkup(<RubberStamp text="SERVED" variant="complete" />)).toContain("stamp-badge--complete");
  });

  it("renders compact, reusable hospitality elements", () => {
    const note = renderToStaticMarkup(<ChefStickyNote text="Chef-reported message" />);
    expect(note).toContain("Chef-reported message");
    expect(note).toContain("tape-strip");
    const empty = renderToStaticMarkup(<MiseEnPlaceEmpty title="No menus" description="Publish your first menu" />);
    expect(empty).toContain("Publish your first menu");
  });

  it("does not invent a table for a pickup counter", () => {
    const html = renderToStaticMarkup(<TableWelcome outletName="Cafe" pointLabel="Pickup Counter" />);
    expect(html).toContain("Pickup Counter");
    expect(html).not.toContain("TABLE Pickup Counter");
    expect(renderToStaticMarkup(<TableWelcome outletName="Cafe" tableNumber="7" />)).toContain("TABLE 7");
  });

  it("derives service period from the outlet timezone without asserting occupancy", () => {
    expect(outletHour("Asia/Kolkata", new Date("2026-10-27T05:15:00Z"))).toBe(10);
    expect(outletHour("America/Los_Angeles", new Date("2026-10-27T05:15:00Z"))).toBe(22);
    expect(getServicePeriodText(8).period).toBe("Morning");
    expect(getServicePeriodText(13).period).toBe("Midday");
    expect(getServicePeriodText(16).period).toBe("Afternoon");
    expect(getServicePeriodText(19).period).toBe("Evening");
    expect(getServicePeriodText(23).period).toBe("After hours");
    for (const hour of [8, 13, 16, 19, 23]) {
      expect(getServicePeriodText(hour).subtext).not.toMatch(/dining room full|all stations working|tickets on the rail/i);
    }
  });

  it("keeps payment independent from ticket status and rejects misleading terminal copy", () => {
    expect(getOrderStampVariant("ready")).toBe("confirmed");
    expect(getOrderStampVariant("served")).toBe("complete");
    expect(getOrderStampVariant("rejected")).toBe("sold-out");
    for (const status of ["rejected", "cancelled", "expired"]) {
      const note = getGuestOrderNote(status, "dine_in", "Table 4");
      expect(note).not.toMatch(/delicious|completed meal|hope every bite/i);
      expect(note).toMatch(/restaurant|order|request/i);
    }
    expect(getGuestOrderNote("ready", "pickup", null)).toMatch(/pickup/i);
    expect(getGuestOrderNote("pending", "dine_in", "Table 4")).toMatch(/not accepted/i);
  });

  it("never treats absent published data as an all-clear availability signal", () => {
    const none = renderToStaticMarkup(<The86Board items={null} outletId="test" canManage={false} />);
    expect(none).toContain("Publish a versioned menu");
    expect(none).not.toContain("ALL STATIONS CLEAR");
    const available = renderToStaticMarkup(<The86Board items={[]} outletId="test" canManage={false} />);
    expect(available).toContain("No published dishes");
    const soldOut = renderToStaticMarkup(<The86Board
      outletId="test"
      canManage={false}
      items={[{ id: "d1", menuId: "m1", name: "Chilli Paneer", category: "Starters", soldOut: true }]}
    />);
    expect(soldOut).toContain("Chilli Paneer");
    expect(soldOut).toContain("SOLD OUT");
  });
});
