// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DishTasteProfile } from "../src/components/menu-product/dish-taste-profile";

afterEach(cleanup);

describe("public dish taste card", () => {
  it("renders a genuine five-chilli heat meter and existing merchant flavor/serving data", () => {
    const { container, rerender } = render(
      <DishTasteProfile culinary={{
        spiceLevel: 4,
        flavorNotes: ["Smoky", "Creamy"],
        servingTemp: "hot",
      }} />
    );
    expect(screen.getByRole("img", { name: "Heat: 4 of 5 chillies (Extra fiery)" })).toBeTruthy();
    expect(container.querySelectorAll(".dining-chilli")).toHaveLength(5);
    expect(container.querySelectorAll(".dining-chilli.is-active")).toHaveLength(4);
    expect(screen.getByText("Hot")).toBeTruthy();
    expect(screen.getByText("Smoky")).toBeTruthy();

    rerender(<DishTasteProfile culinary={{ spiceLevel: 5 }} />);
    expect(screen.getByRole("img", { name: "Heat: 5 of 5 chillies (Scorching)" })).toBeTruthy();
    expect(container.querySelectorAll(".dining-chilli.is-active")).toHaveLength(5);
    expect(screen.queryByText("Smoky")).toBeNull();
  });

  it("does not fabricate a zero-heat claim or display unknown profile metadata", () => {
    const { container, rerender } = render(<DishTasteProfile culinary={{ spiceLevel: 0 }} />);
    expect(container.firstChild).toBeNull();
    rerender(<DishTasteProfile />);
    expect(container.firstChild).toBeNull();
    rerender(<DishTasteProfile culinary={{ flavorNotes: ["Tangy"] }} />);
    expect(screen.getByText("Tangy")).toBeTruthy();
    expect(screen.queryByText("Spice level")).toBeNull();
  });
});
