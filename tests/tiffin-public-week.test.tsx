// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import {
  PublicWeek,
  formatDayHeading,
  formatMinute,
  formatPublicMinor,
} from "../src/components/tiffin/public-week";
import type { PublicWeek as Week } from "../src/modules/tiffin/service";

afterEach(cleanup);

const thali = {
  id: "c1",
  name: "Home thali",
  description: "Cooked fresh at home",
  priceMinor: "12000",
  items: [
    { label: "Dal", quantity: 1 },
    { label: "Roti", quantity: 3 },
  ],
  addons: [{ id: "a1", label: "Raita", priceMinor: "2500" }],
};
const snack = { ...thali, id: "c2", name: "Snack box", description: "", addons: [] };
const week = (over: Partial<Week["outlet"]> = {}): Week => ({
  outlet: { id: "o", name: "Asha's Kitchen", currency: "INR", timezone: "Asia/Kolkata", ...over },
  today: "2026-11-22",
  days: [
    {
      localDate: "2026-11-22",
      weekday: 0,
      slots: {
        lunch: {
          kind: "lunch",
          startMinute: 690,
          endMinute: 870,
          open: true,
          closed: false,
          combos: [thali, snack],
        },
        dinner: {
          kind: "dinner",
          startMinute: 1170,
          endMinute: 1440,
          open: false,
          closed: true,
          combos: [],
        },
      },
    },
    {
      localDate: "2026-11-23",
      weekday: 1,
      slots: {
        lunch: {
          kind: "lunch",
          startMinute: 690,
          endMinute: 870,
          open: false,
          closed: false,
          combos: [],
        },
      },
    },
  ],
});

describe("PublicWeek", () => {
  it("renders the heading structure, notice, combos, items and add-ons", () => {
    const { container } = render(<PublicWeek week={week()} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Asha's Kitchen");
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Sunday 22 November",
      "Monday 23 November",
    ]);
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(3);
    expect(container.textContent).toContain(
      "Booking opens soon. For now, this is a preview of what is planned."
    );
    const lunch = screen.getAllByRole("heading", { level: 3 })[0]!.parentElement!;
    expect(lunch.textContent).toContain("11:30–14:30");
    expect(within(lunch).getByText("Home thali")).toBeTruthy();
    expect(lunch.textContent).toContain("120.00");
    expect(lunch.textContent).toContain("Cooked fresh at home");
    expect(lunch.textContent).toContain("Dal x1");
    expect(lunch.textContent).toContain("Roti x3");
    expect(lunch.textContent).toContain("Raita");
    expect(lunch.textContent).toContain("25.00");
  });

  it("shows Closed and Nothing planned yet, and 24:00 for an end-of-day window", () => {
    const { container } = render(<PublicWeek week={week()} />);
    expect(container.textContent).toContain("Closed");
    expect(container.textContent).toContain("19:30–24:00");
    expect(container.textContent).toContain("Nothing planned yet");
  });

  it("formats prices by currency exponent", () => {
    expect(formatPublicMinor("12000", "INR")).toContain("120.00");
    expect(formatPublicMinor(1250, "OMR")).toContain("1.250");
    expect(formatPublicMinor("500", "JPY")).toContain("500");
    expect(formatPublicMinor("500", "JPY")).not.toContain(".");
    expect(formatPublicMinor("5", "ZZZ")).toBe("5 ZZZ");
  });

  it("formats windows and dates independent of the runner timezone", () => {
    expect(formatMinute(690)).toBe("11:30");
    expect(formatMinute(870)).toBe("14:30");
    expect(formatMinute(1440)).toBe("24:00");
    expect(formatDayHeading("2026-11-22")).toBe("Sunday 22 November");
    expect(formatDayHeading("2026-03-01")).toBe("Sunday 1 March");
  });

  it("makes no allergen, dietary or delivery claims in its own copy", () => {
    const { container } = render(<PublicWeek week={week()} />);
    const text = container.textContent!.toLowerCase();
    for (const term of [
      "allergen",
      "vegan",
      "vegetarian",
      "gluten",
      "halal",
      "nut-free",
      "deliver",
      "subscri",
      "in stock",
    ])
      expect(text).not.toContain(term);
  });

  it("escapes hostile owner text", () => {
    const w = week();
    w.days[0]!.slots.lunch!.combos[0]!.name = "<script>alert(1)</script>";
    const { container } = render(<PublicWeek week={w} />);
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("<script>alert(1)</script>");
  });
});
