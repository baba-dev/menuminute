/** ESC/POS receipt data is derived from the authenticated immutable POS receipt view.
 * This is a client-side local print convenience, NOT a statutory/fiscal document.
 * Receipt pricing, taxes, statuses and customer details must never be recalculated here.
 */
export type ThermalPaper = "58" | "80";

export type ThermalReceipt = {
  merchantName: string;
  outletName: string;
  address?: string | null;
  orderNumber: string;
  issuedAt: string;
  service: string;
  customerName?: string | null;
  customerPhone?: string | null;
  table?: string | null;
  paymentStatus: string;
  paymentMethod?: string | null;
  items: Array<{
    name: string;
    variant?: string | null;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
  }>;
  subtotalLabel: string;
  subtotal: string;
  taxableBase?: string | null;
  taxLabel?: string | null;
  taxAmount?: string | null;
  totalLabel: string;
  total: string;
  closingStatus: string;
  taxDisclaimer: string;
};

export function thermalColumns(paper: ThermalPaper): number {
  return paper === "58" ? 32 : 48;
}

/** Default ESC/POS code page cannot reliably print arbitrary Unicode.
 * Retain readable Latin text and replace unsupported glyphs, never send control
 * bytes supplied by restaurant names, staff, or guest input to a raw printer.
 */
export function safePrinterText(text: string): string {
  return text
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u00d7/g, "x")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, "?")
    .replace(/\s+/g, " ")
    .trim();
}

function wrapText(value: string, width: number): string[] {
  const clean = safePrinterText(value);
  if (!clean) return [];
  const result: string[] = [];
  let line = "";
  for (const word of clean.split(" ")) {
    if (word.length > width) {
      if (line) {
        result.push(line);
        line = "";
      }
      for (let i = 0; i < word.length; i += width) result.push(word.slice(i, i + width));
      continue;
    }
    if (!line) line = word;
    else if (line.length + 1 + word.length <= width) line += " " + word;
    else {
      result.push(line);
      line = word;
    }
  }
  if (line) result.push(line);
  return result;
}

function pair(label: string, value: string, width: number): string[] {
  const lhs = wrapText(label, width);
  const rhs = safePrinterText(value);
  const result = lhs.length ? lhs.slice(0, -1) : [];
  const last = lhs.at(-1) ?? "";
  const space = width - last.length - rhs.length;
  if (space >= 1) result.push(last + " ".repeat(space) + rhs);
  else {
    if (last) result.push(last);
    result.push(...wrapText(rhs, width).map((l) => l.padStart(width)));
  }
  return result;
}

function line(parts: number[], content: string) {
  for (let i = 0; i < content.length; i++) parts.push(content.charCodeAt(i));
  parts.push(0x0a);
}
function esc(parts: number[], ...bytes: number[]) {
  parts.push(...bytes);
}

/** Build a bounded, readable 58/80 mm ESC/POS job with no network, no auto-cut,
 * no cash drawer commands and no printer state mutations beyond text formatting.
 */
export function encodeThermalReceipt(receipt: ThermalReceipt, paper: ThermalPaper): Uint8Array {
  const width = thermalColumns(paper);
  const data: number[] = [];
  // Preserve intentional spaces used to align numeric columns. All dynamic text
  // is sanitized before reaching this point; these bytes never include ESC.
  const draw = (s: string) => line(data, s.replace(/[^\\x20-\\x7e]/g, "?").slice(0, width));
  const separator = "-".repeat(width);
  esc(data, 0x1b, 0x40); // initialize
  esc(data, 0x1b, 0x61, 0x01); // center
  esc(data, 0x1b, 0x45, 0x01); // bold
  for (const s of wrapText(receipt.merchantName || "MenuMinute", width)) draw(s);
  esc(data, 0x1b, 0x45, 0x00);
  if (receipt.outletName !== receipt.merchantName) {
    for (const s of wrapText(receipt.outletName, width)) draw(s);
  }
  if (receipt.address) for (const s of wrapText(receipt.address, width)) draw(s);
  esc(data, 0x1b, 0x61, 0x00); // left
  draw(separator);
  for (const s of wrapText("Order #" + receipt.orderNumber, width)) draw(s);
  for (const s of wrapText(receipt.issuedAt, width)) draw(s);
  for (const [label, value] of [
    ["Service", receipt.service],
    ["Customer", receipt.customerName],
    ["Mobile", receipt.customerPhone],
    ["Table", receipt.table],
    ["Payment", receipt.paymentStatus],
    ["Method", receipt.paymentMethod],
  ]) {
    if (value) for (const s of pair(label, value, width)) draw(s);
  }
  draw(separator);
  for (const item of receipt.items.slice(0, 250)) {
    for (const s of wrapText(item.name, width)) draw(s);
    if (item.variant) for (const s of wrapText("  " + item.variant, width)) draw(s);
    for (const s of pair(String(item.quantity) + " x " + item.unitPrice, item.lineTotal, width))
      draw(s);
  }
  draw(separator);
  for (const s of pair(receipt.subtotalLabel, receipt.subtotal, width)) draw(s);
  if (receipt.taxableBase) for (const s of pair("Taxable base", receipt.taxableBase, width)) draw(s);
  if (receipt.taxLabel && receipt.taxAmount)
    for (const s of pair(receipt.taxLabel, receipt.taxAmount, width)) draw(s);
  esc(data, 0x1b, 0x45, 0x01);
  for (const s of pair(receipt.totalLabel, receipt.total, width)) draw(s);
  esc(data, 0x1b, 0x45, 0x00);
  draw(separator);
  esc(data, 0x1b, 0x61, 0x01);
  for (const s of wrapText(receipt.closingStatus, width)) draw(s);
  for (const s of wrapText(receipt.taxDisclaimer, width)) draw(s);
  draw("Thank you for visiting!");
  draw("Powered by MenuMinute");
  line(data, "");
  line(data, "");
  line(data, "");
  return Uint8Array.from(data);
}
