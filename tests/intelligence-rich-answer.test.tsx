import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EmberRichAnswer } from "../src/components/intelligence/ember-rich-answer";

describe("Ember safe rich answer", () => {
  it("renders text, emphasis, headings, lists and accessible tables", () => {
    const result = renderToStaticMarkup(
      <EmberRichAnswer text={"## Your orders\n\n**2 orders** waiting.\n\n- One ready\n- One cooking\n\n| Dish | Qty |\n| --- | --- |\n| Chole | 2 |"} />
    );
    expect(result).toContain("<h4>");
    expect(result).toContain("<strong>2 orders</strong>");
    expect(result).toContain("<ul>");
    expect(result).toContain("<table>");
    expect(result).toContain('aria-label="Answer table"');
  });
  it("escapes model-authored HTML rather than interpreting it", () => {
    const result = renderToStaticMarkup(
      <EmberRichAnswer text={'Hello <img src=x onerror="alert(1)"> and **safe text**'} />
    );
    expect(result).not.toContain("<img");
    expect(result).toContain("&lt;img");
    expect(result).toContain("<strong>safe text</strong>");
  });
  it("does not show historical raw tool-call JSON", () => {
    const result = renderToStaticMarkup(
      <EmberRichAnswer text={'{"type":"function","name":"menu_listDishes","parameters":{}}'} />
    );
    expect(result).toContain("reliable answer");
    expect(result).not.toContain("menu_listDishes");
  });
});
