import { describe, expect, it } from "vitest";
import {
  dashboardSetup,
  dashboardSummary,
  preferredMenuQr,
} from "@/modules/menu-product/dashboard-summary";

const codes = [
  { isActive: true, purpose: "menu", tableId: "table-1", destinationToken: "table-token" },
  { isActive: true, purpose: "menu", tableId: null, destinationToken: "main-token" },
  { isActive: false, purpose: "menu", tableId: null, destinationToken: "revoked-token" },
  { isActive: true, purpose: "order", tableId: "table-2", destinationToken: "order-token" },
];

describe("merchant dashboard published-source summary", () => {
  it("prefers the active canonical menu QR and never chooses revoked/order links", () => {
    expect(preferredMenuQr(codes)?.destinationToken).toBe("main-token");
    expect(preferredMenuQr(codes.filter((q) => q.tableId !== null))?.destinationToken).toBe(
      "table-token"
    );
    expect(preferredMenuQr(codes.filter((q) => !q.isActive))).toBeNull();
  });

  it("never treats saved draft contents or active QR identity as a published guest menu", () => {
    const summary = dashboardSummary(
      [{ archived: false, revision: 2, publishedRevision: null }],
      codes,
      { menus: [] }
    );
    expect(summary).toEqual({
      draftCount: 1,
      publishedMenuCount: 0,
      publishedCategoryCount: 0,
      publishedDishCount: 0,
      activeQrCount: 2,
      hasPublicMenu: false,
    });
  });

  it("does not treat stock-only overrides as unpublished menu edits", () => {
    const rows = [
      { archived: false, revision: 6, publishedRevision: 2, hasUnpublishedChanges: false },
    ];
    expect(dashboardSummary(rows, codes, { menus: [] }).draftCount).toBe(0);
    expect(dashboardSummary(
      [{ ...rows[0]!, hasUnpublishedChanges: true }], codes, { menus: [] }
    ).draftCount).toBe(1);
  });

  it("counts only nonarchived content of immutable public releases", () => {
    const summary = dashboardSummary(
      [
        { archived: false, revision: 3, publishedRevision: 2 },
        { archived: false, revision: 2, publishedRevision: 2 },
        { archived: true, revision: 4, publishedRevision: null },
      ],
      codes,
      {
        menus: [
          {
            document: {
              categories: [
                { items: [{}, { archived: true }, {}] },
                { archived: true, items: [{}] },
              ],
            },
          },
        ],
      }
    );
    expect(summary).toMatchObject({
      draftCount: 1,
      publishedMenuCount: 1,
      publishedCategoryCount: 1,
      publishedDishCount: 2,
      hasPublicMenu: true,
    });
    expect(
      dashboardSummary(
        [],
        codes.map((q) => ({ ...q, isActive: false })),
        {
          menus: [{ document: { categories: [{ items: [{}] }] } }],
        }
      ).hasPublicMenu
    ).toBe(false);
  });
});

describe("editorial dashboard setup truthfulness", () => {
  it("reports only verified completion states", () => {
    expect(
      dashboardSetup({
        hasOutlet: true,
        hasSavedMenu: true,
        hasPublicMenu: false,
        hasActiveQr: true,
      })
    ).toMatchObject({ completed: 3, total: 4, percent: 75 });
    expect(
      dashboardSetup({
        hasOutlet: false,
        hasSavedMenu: false,
        hasPublicMenu: false,
        hasActiveQr: false,
      })
    ).toMatchObject({ completed: 0, total: 4, percent: 0 });
    expect(
      dashboardSetup({
        hasOutlet: true,
        hasSavedMenu: true,
        hasPublicMenu: true,
        hasActiveQr: true,
      })
    ).toMatchObject({ completed: 4, total: 4, percent: 100 });
  });
});
