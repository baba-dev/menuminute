import { describe, expect, it } from "vitest";
import { assertAppUrl, escapeHtml, renderEmail } from "../src/lib/email/template";

const APP = "https://food.example.com";
const base = {
  preheader: "Short summary",
  heading: "Hello there",
  paragraphs: ["First paragraph.", "", "Second paragraph."],
};

describe("shared email template", () => {
  it("renders a complete html document and a plain-text twin", () => {
    const { html, text } = renderEmail(
      {
        ...base,
        eyebrow: "Your trial",
        facts: [{ label: "Trial ends", value: "12 Nov 2026" }],
        action: { label: "Open billing", url: `${APP}/billing` },
        note: "Fine print.",
      },
      APP
    );
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<title>Hello there</title>");
    expect(html).toContain("MenuMinute");
    expect(html).toContain(`href="${APP}/billing"`);
    expect(html).toContain(`${APP}/brand/icons/pwa/icon-192.png`);
    expect(html).toContain("prefers-color-scheme:dark");
    expect(html).toContain("Trial ends");
    // Blank paragraphs are dropped, real ones kept in order.
    expect(html.indexOf("First paragraph.")).toBeLessThan(html.indexOf("Second paragraph."));
    expect(text).toContain("Hello there");
    expect(text).toContain("Trial ends: 12 Nov 2026");
    expect(text).toContain(`Open billing:\n${APP}/billing`);
    expect(text).not.toContain("<");
  });

  it("puts the action link first in the plain text, so a link scraper finds it", () => {
    const { text } = renderEmail(
      { ...base, action: { label: "Continue", url: `${APP}/reset?token=abc` } },
      APP
    );
    expect(text.match(/https?:\/\/\S+/)?.[0]).toBe(`${APP}/reset?token=abc`);
  });

  it("escapes every piece of text, so names cannot inject markup", () => {
    const evil = `<script>alert(1)</script> & "quotes"`;
    const { html } = renderEmail(
      {
        preheader: evil,
        eyebrow: evil,
        heading: evil,
        paragraphs: [evil],
        facts: [{ label: evil, value: evil }],
        note: evil,
        action: { label: evil, url: `${APP}/x` },
      },
      APP
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;quotes&quot;");
  });

  it("refuses a link that is not on the app origin", () => {
    for (const url of [
      "https://evil.example.org/x",
      "http://food.example.com/x",
      "javascript:alert(1)",
    ])
      expect(() => renderEmail({ ...base, action: { label: "Go", url } }, APP)).toThrow();
    expect(() => assertAppUrl(`${APP}/ok`, APP)).not.toThrow();
  });

  it("works without an action", () => {
    const { html, text } = renderEmail(base, APP);
    expect(html).not.toContain("<a href");
    expect(text).not.toContain("http");
  });

  it("escapeHtml covers the five special characters", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });
});
