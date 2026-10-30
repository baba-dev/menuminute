import { describe, expect, it } from "vitest";
import {
  groundedMerchantAnswer,
  type MerchantEvidence,
} from "../src/modules/intelligence/grounded-answer";
const evidence = (tool: string, data: unknown): MerchantEvidence[] => [
  {
    tool,
    source: "private fixture",
    capturedAt: "2026-10-30T00:00:00Z",
    data,
  },
];
describe("Ember grounded merchant answers", () => {
  it("responds to a published dish with a readable status table", () => {
    const result = groundedMerchantAnswer(
      "Do I sell Chole Bhature?",
      evidence("menu.findDish", {
        query: "Chole Bhature",
        truncated: false,
        definitiveNotFound: false,
        matches: [
          {
            dish: "Chole Bhature",
            menu: "Lunch",
            category: "Mains",
            soldOut: false,
            availableNow: true,
            currency: "INR",
            priceMinor: 25000,
          },
        ],
      })
    );
    expect(result).toContain("Chole Bhature");
    expect(result).toContain("Available now");
    expect(result).toContain("₹250.00");
    expect(result).toContain("| Dish | Published menu | Status | Price |");
  });
  it("does not say an unscanned menu is missing the dish", () => {
    const result = groundedMerchantAnswer(
      "Do I sell Chole?",
      evidence("menu.findDish", {
        query: "Chole",
        matches: [],
        definitiveNotFound: false,
        truncated: true,
      })
    );
    expect(result).toContain("search was incomplete");
  });
  it("separates order value from received and settled money", () => {
    const result = groundedMerchantAnswer(
      "How much sale this week?",
      evidence("reports.summary", {
        period: { from: "2026-10-26", to: "2026-10-30", label: "This week" },
        currency: "INR",
        orderValueMinor: 120500,
        orderCount: 12,
        completedOrderCount: 9,
        cancelledOrderCount: 1,
        paymentEvidenceAvailable: true,
        operatorRecordedCollectedMinor: 85000,
        topSellingDishes: [{ dish: "Samosa", quantity: 14, orderValueMinor: 28000 }],
      })
    );
    expect(result).toContain("₹1,205.00");
    expect(result).toContain("Staff-recorded collections");
    expect(result).toContain("₹850.00");
    expect(result).toContain("not the same as verified paid revenue");
    expect(result).toContain("| Samosa | 14 |");
  });
  it("never translates arbitrary tool content or financial strings into trusted results", () => {
    expect(
      groundedMerchantAnswer(
        "How much sale?",
        evidence("reports.summary", {
          currency: "INR",
          orderValueMinor: "Not a number",
        })
      )
    ).toBeNull();
    expect(
      groundedMerchantAnswer(
        "Do I sell Chole?",
        evidence("menu.findDish", {
          matches: [{ dish: "<img onerror=alert(1)>", menu: "Lunch", soldOut: false }],
        })
      )
    ).toBeNull();
    expect(groundedMerchantAnswer("Do I sell?", evidence("orders.pulse", {}))).toBeNull();
  });
});
