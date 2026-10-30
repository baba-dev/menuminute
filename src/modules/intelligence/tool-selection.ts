/**
 * Bounded shortlist for the verified model. This is only routing: the
 * permission-filtered registry and domain RLS independently authorize tools.
 */
export function selectQuestionTools<T extends { name: string }>(
  allowed: readonly T[], question: string
): T[] {
  const q = question.toLocaleLowerCase();
  const priorities: string[] = [];
  const add = (name: string) => { if (!priorities.includes(name)) priorities.push(name); };
  if (/\b(sales?|revenue|earnings?|income|turnover|best.selling|top.selling|last week|this week|this month)\b/.test(q))
    add("reports.summary");
  if (/\b(dish|food|menu item|serve|selling|have|available|stock|sold out|sell|price)\b/.test(q) &&
      !/\b(how much|total sales?|revenue|earnings?|income|turnover)\b/.test(q))
    add("menu.findDish");
  if (/\b(import|uploaded|upload|photo menu|menu scan)\b/.test(q)) add("imports.pulse");
  if (/\b(qr|qr code|scan code)\b/.test(q)) add("qr.pulse");
  if (/\b(kitchen|chef|station|prepar|cook)\b/.test(q)) add("kitchen.pulse");
  if (/\b(order|ticket|pending|queue|service)\b/.test(q)) add("orders.pulse");
  if (/\b(table|dine.in|dining)\b/.test(q)) add("tables.pulse");
  if (/\b(draft|published|menus|menu summary)\b/.test(q)) add("menu.summary");
  const order = priorities.length
    ? priorities
    : ["orders.pulse", "menu.summary", "reports.summary", "menu.findDish",
        "kitchen.pulse", "orders.history", "tables.pulse", "qr.pulse"];
  return order
    .map((name) => allowed.find((candidate) => candidate.name === name))
    .filter((tool): tool is T => Boolean(tool))
    .slice(0, 8);
}
