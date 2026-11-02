import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { JourneyStrip, relativeTime } from "../src/components/dashboard/floor/journey-strip";
import { buildJourney, DEFAULT_SIGNAL_SETTINGS } from "../src/modules/hospitality/floor-signals";

const NOW = Date.parse("2026-11-02T12:10:00.000Z");

describe("JourneyStrip", () => {
  it("spells out every state in text and never exposes a system id", () => {
    const journey = buildJourney({
      settings: { ...DEFAULT_SIGNAL_SETTINGS, enabled: true },
      events: [{ kind: "water_served", occurredAt: "2026-11-02T12:08:00.000Z" }],
      order: {
        status: "preparing",
        paymentStatus: "unpaid",
        createdAt: "2026-11-02T12:00:00.000Z",
        updatedAt: "2026-11-02T12:05:00.000Z",
        dishCount: 2,
      },
    })!;
    const html = renderToStaticMarkup(
      <JourneyStrip journey={journey} now={NOW} tableName="Table Big" />
    );
    expect(html).toContain("Guest journey for Table Big");
    expect(html).toContain("Order sent, 2 dishes · 10m ago");
    expect(html).toContain('data-state="active"');
    expect(html).toContain("Water served, Served · 2m ago");
    expect(html).toContain("QR not scanned");
  });

  it("formats relative times", () => {
    expect(relativeTime(null, NOW)).toBeNull();
    expect(relativeTime("2026-11-02T12:09:50.000Z", NOW)).toBe("just now");
    expect(relativeTime("2026-11-02T10:00:00.000Z", NOW)).toBe("2h ago");
  });
});
