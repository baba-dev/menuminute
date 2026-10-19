import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ChefNote,
  EmberButton,
  InkTicket,
  ServiceCard,
} from "@/components/menu-product/phase4-primitives";

describe("Phase 4 Ink & Ember semantic primitives", () => {
  it("defaults to non-submitting routine action and exposes a clear intent variant", () => {
    const html = renderToStaticMarkup(<EmberButton>Save draft</EmberButton>);
    expect(html).toContain('type="button"');
    expect(html).toContain("mm-action--flow");
    expect(html).toContain("Save draft");
  });

  it("preserves native disabled state without claiming an operation succeeded", () => {
    const html = renderToStaticMarkup(
      <EmberButton disabled intent="press">
        Publish
      </EmberButton>
    );
    expect(html).toContain("disabled");
    expect(html).toContain("mm-action--press");
    expect(html).not.toContain("success");
  });

  it("provides routine, milestone and optional note surfaces without modal behavior", () => {
    expect(renderToStaticMarkup(<ServiceCard role="region">Edit</ServiceCard>)).toContain(
      "mm-service-card"
    );
    expect(renderToStaticMarkup(<InkTicket>Published</InkTicket>)).toContain("mm-ink-ticket");
    expect(renderToStaticMarkup(<ChefNote aria-label="Optional guidance">Tip</ChefNote>)).toContain(
      "<aside"
    );
  });
});
