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
  return null;
}
