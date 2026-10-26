import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  RubberStamp,
  ChefStickyNote,
  MiseEnPlaceEmpty,
  TableWelcome,
  getServicePeriodText,
} from "@/components/ui/tactile-elements";

describe("Hospitality Tactile & Physical Craft Elements", () => {
  it("renders RubberStamp with appropriate variant and accessible label", () => {
    const htmlSoldOut = renderToStaticMarkup(
      <RubberStamp text="86'd" variant="sold-out" />
    );
    expect(htmlSoldOut).toContain("stamp-badge--sold-out");
    expect(htmlSoldOut).toContain("86'd");
    expect(htmlSoldOut).toContain('aria-label="Status: 86&#x27;d"');

    const htmlPaid = renderToStaticMarkup(
      <RubberStamp text="PAID" variant="paid" />
    );
    expect(htmlPaid).toContain("stamp-badge--paid");
    expect(htmlPaid).toContain("PAID");
  });

  it("renders ChefStickyNote with handwriting class and tape strip", () => {
    const html = renderToStaticMarkup(
      <ChefStickyNote
        author="Chef Marco"
        text="Fresh dough rested for 48 hours."
        pinStyle="tape"
      />
    );
    expect(html).toContain("Chef Marco");
    expect(html).toContain("Fresh dough rested for 48 hours.");
    expect(html).toContain("font-handwriting");
    expect(html).toContain("tape-strip");
  });

  it("renders MiseEnPlaceEmpty with warm hospitality framing", () => {
    const html = renderToStaticMarkup(
      <MiseEnPlaceEmpty
        title="Standing by for Table 1"
        description="The prep line is clean and knives are sharp."
        action={<button type="button">Fire Test Order</button>}
      />
    );
    expect(html).toContain("Standing by for Table 1");
    expect(html).toContain("The prep line is clean and knives are sharp.");
    expect(html).toContain("Fire Test Order");
  });

  it("renders TableWelcome with table number and service period", () => {
    const html = renderToStaticMarkup(
      <TableWelcome
        outletName="Trattoria Napoli"
        tableNumber="7"
        servicePeriod="Dinner Service"
      />
    );
    expect(html).toContain("Trattoria Napoli");
    expect(html).toContain("TABLE 7");
    expect(html).toContain("Dinner Service");
  });

  it("computes appropriate service periods and greetings throughout the day", () => {
    const morning = getServicePeriodText(8);
    expect(morning.period).toBe("Morning Prep");
    expect(morning.greeting).toContain("morning");

    const lunch = getServicePeriodText(13);
    expect(lunch.period).toBe("Lunch Rush");

    const afternoon = getServicePeriodText(16);
    expect(afternoon.period).toBe("Afternoon Prep");

    const dinner = getServicePeriodText(19);
    expect(dinner.period).toBe("Dinner Service");

    const late = getServicePeriodText(23);
    expect(late.period).toBe("Service Wrap");
  });
});
