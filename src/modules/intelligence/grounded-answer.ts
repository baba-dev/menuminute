import { z } from "zod";
import { currencyExponent } from "@/lib/money";

const dish = z
  .object({
    query: z.string(),
    matches: z
      .array(
        z.object({
          dish: z.string(),
          menu: z.string(),
          category: z.string(),
          soldOut: z.boolean(),
          availableNow: z.boolean(),
          currency: z.string(),
          priceMinor: z.number().int(),
        })
      )
      .max(10),
    truncated: z.boolean(),
    definitiveNotFound: z.boolean(),
  })
  .passthrough();
const report = z
  .object({
    period: z.object({ from: z.string(), to: z.string(), label: z.string() }),
    currency: z.string(),
    orderValueMinor: z.number().int(),
    orderCount: z.number().int(),
    completedOrderCount: z.number().int(),
    cancelledOrderCount: z.number().int(),
    paymentEvidenceAvailable: z.boolean(),
    operatorRecordedCollectedMinor: z.number().int().optional(),
    topSellingDishes: z
      .array(
        z.object({
          dish: z.string(),
          quantity: z.number().int(),
          orderValueMinor: z.number().int(),
        })
      )
      .max(5),
  })
  .passthrough();

const helpDataSchema = z.object({
  query: z.string(),
  faqs: z
    .array(z.object({ question: z.string(), answer: z.string(), category: z.string() }))
    .default([]),
  matches: z.array(
    z.object({
      title: z.string(),
      slug: z.string(),
      audience: z.enum(["owner", "customer", "both"]),
      category: z.string(),
      summary: z.string(),
      quickSteps: z.array(z.string()),
      dashboardLink: z
        .object({
          label: z.string(),
          href: z.string(),
        })
        .optional(),
    })
  ),
});

/** Escape untrusted menu names as Markdown data, not instructions. */
const safe = (s: string) =>
  s
    .replace(/[\\*_[\]{}|#~<>!]/g, "\\$&")
    .replace(/\s+/g, " ")
    .slice(0, 110);
function money(minor: number, currency: string): string | null {
  const exp = currencyExponent(currency);
  if (exp === null || !Number.isSafeInteger(minor)) return null;
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      minimumFractionDigits: exp,
      maximumFractionDigits: exp,
    }).format(minor / 10 ** exp);
  } catch {
    return null;
  }
}
export type MerchantEvidence = { tool: string; source: string; capturedAt: string; data: unknown };
/** Authoritative answer avoids second paid model request; never invent missing values. */
export function groundedMerchantAnswer(
  prompt: string,
  evidence: MerchantEvidence[]
): string | null {
  if (evidence.length !== 1) return null;
  const item = evidence[0]!;
  if (
    item.tool === "menu.findDish" &&
    /\b(sell|serve|have|available|stock|sold.out|price|dish)\b/i.test(prompt)
  ) {
    const parsed = dish.safeParse(item.data);
    if (!parsed.success) return null;
    const d = parsed.data;
    if (!d.matches.length)
      return d.definitiveNotFound
        ? "I couldn't find **" + safe(d.query) + "** in your currently published menus."
        : "I couldn't confirm whether **" +
            safe(d.query) +
            "** is offered. The search was incomplete.";
    const lines = [
      "I found **" +
        d.matches.length +
        " matching " +
        (d.matches.length === 1 ? "dish" : "dishes") +
        "** in your published menus.",
      "",
      "| Dish | Published menu | Status | Price |",
      "| --- | --- | --- | --- |",
      ...d.matches.map(
        (m) =>
          "| " +
          safe(m.dish) +
          " | " +
          safe(m.menu) +
          " | " +
          (m.soldOut ? "Sold out" : m.availableNow ? "Available now" : "Not currently available") +
          " | " +
          (money(m.priceMinor, m.currency) ?? "Unavailable") +
          " |"
      ),
    ];
    if (d.truncated)
      lines.push("", "More matches or menus may exist; open Menu Studio for the full list.");
    return lines.join("\n");
  }
  if (
    item.tool === "reports.summary" &&
    /\b(sales?|revenue|earnings?|income|turnover|orders? total|best.sell|top.sell)\b/i.test(prompt)
  ) {
    const parsed = report.safeParse(item.data);
    if (!parsed.success) return null;
    const d = parsed.data,
      amount = money(d.orderValueMinor, d.currency);
    if (!amount) return null;
    const lines = [
      "## " + safe(d.period.label) + " — order overview",
      "For **" +
        safe(d.period.from) +
        " to " +
        safe(d.period.to) +
        "**, recorded orders total **" +
        amount +
        "** across **" +
        d.orderCount +
        " orders**.",
      "",
      "| Order measure | Recorded value |",
      "| --- | --- |",
      "| Total orders | " + d.orderCount + " |",
      "| Completed orders | " + d.completedOrderCount + " |",
      "| Cancelled orders | " + d.cancelledOrderCount + " |",
    ];
    if (d.topSellingDishes.length)
      lines.push(
        "",
        "### Best-selling dishes (by quantity)",
        "",
        "| Dish | Quantity | Order value |",
        "| --- | --- | --- |",
        ...d.topSellingDishes.map(
          (x) =>
            "| " +
            safe(x.dish) +
            " | " +
            x.quantity +
            " | " +
            (money(x.orderValueMinor, d.currency) ?? "Unavailable") +
            " |"
        )
      );
    if (d.paymentEvidenceAvailable && d.operatorRecordedCollectedMinor !== undefined) {
      const collected = money(d.operatorRecordedCollectedMinor, d.currency);
      if (collected)
        lines.push(
          "",
          "**Staff-recorded collections:** " +
            collected +
            ". These are not bank-verified settlements."
        );
    }
    lines.push("", "*Order totals are not the same as verified paid revenue.*");
    return lines.join("\n");
  }
  if (item.tool === "support.myTickets") {
    const parsed = z
      .object({
        count: z.number(),
        tickets: z.array(
          z.object({
            number: z.number(),
            subject: z.string(),
            status: z.string(),
            latestReply: z.string().nullable(),
          })
        ),
      })
      .safeParse(item.data);
    if (!parsed.success) return null;
    if (!parsed.data.count)
      return "You haven't sent any support requests yet. Tell me what's wrong and I'll prepare one for you to confirm.";
    return [
      "Here are your latest support requests:",
      "",
      ...parsed.data.tickets.map(
        (t) =>
          `- **#${t.number} · ${safe(t.subject)}** — ${safe(t.status)}` +
          (t.latestReply ? `\n  Latest reply: “${safe(t.latestReply).slice(0, 160)}”` : "")
      ),
    ].join("\n");
  }
  if (item.tool.startsWith("propose.")) {
    const parsed = z
      .object({
        prepared: z.boolean(),
        kind: z.string().optional(),
        summary: z.string().optional(),
        reason: z.string().optional(),
      })
      .safeParse(item.data);
    if (!parsed.success) return null;
    if (!parsed.data.prepared) return safe(parsed.data.reason ?? "I couldn't prepare that change.");
    // The card carries the exact change; the reply stays short and never claims it is done.
    if (parsed.data.kind === "menu.publish")
      return "I've prepared that. Nothing goes live until you tap **Publish** on the card below, which lists exactly what will change.";
    if (parsed.data.kind === "menu.price" || parsed.data.kind === "menu.description")
      return "I've prepared that change for your **draft** menu. Nothing changes until you tap **Confirm**, and guests won't see it until the menu is published.";
    return "I've prepared that for you. Nothing changes until you tap **Confirm** on the card below.";
  }
  if (item.tool === "help.search") {
    const parsed = helpDataSchema.safeParse(item.data);
    if (!parsed.success) return null;
    const d = parsed.data;
    const faqLines = d.faqs.map((f) => `**${safe(f.question)}**\n${safe(f.answer)}`);
    if (!d.matches.length && faqLines.length)
      return [...faqLines, "", "More answers are in the [Help Center FAQ](/help/faq)."].join(
        "\n\n"
      );
    if (!d.matches.length) {
      return (
        "I couldn't find an exact guide matching **" +
        safe(d.query) +
        "**. You can browse all [Restaurant Owner Guides](/help/owner) or explore the [Help Center FAQ](/help/faq)."
      );
    }
    const top = d.matches[0];
    if (!top) return null;
    const lines = [
      "### " + safe(top.title),
      safe(top.summary),
      "",
      "**Step-by-step instructions:**",
      ...top.quickSteps.map((step, idx) => `${idx + 1}. ${safe(step)}`),
    ];
    const actions: string[] = [];
    if (top.dashboardLink) {
      actions.push(`[${safe(top.dashboardLink.label)}](${top.dashboardLink.href})`);
    }
    actions.push(`[Read Illustrated Guide](/help/${top.audience}/${top.slug})`);
    lines.push("", actions.join(" • "));
    if (d.matches.length > 1) {
      lines.push(
        "",
        "*Also related:* " +
          d.matches
            .slice(1)
            .map((m) => `[${safe(m.title)}](/help/${m.audience}/${m.slug})`)
            .join(", ")
      );
    }
    if (faqLines.length) lines.push("", "**Quick answer**", ...faqLines);
    return lines.join("\n");
  }
  return null;
}
