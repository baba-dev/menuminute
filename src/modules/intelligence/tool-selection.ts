/**
 * Bounded shortlist for the verified model. This is only routing: the
 * permission-filtered registry and domain RLS independently authorize tools.
 */
export function selectQuestionTools<T extends { name: string }>(
  allowed: readonly T[],
  question: string
): T[] {
  const q = question.toLocaleLowerCase();
  const priorities: string[] = [];
  const add = (name: string) => {
    if (!priorities.includes(name)) priorities.push(name);
  };
  // "How much did I sell?" asks for live facts, not documentation.
  // Only explicit setup/how-to requests should rank guides first.
  const instructional =
    /\b(how (?:do|can) i (?:set up|create|add|edit|print|mark|change|configure|use|publish|invite|open|scan|remove|download|start|stop|reset)|how to|step.by.step|tutorial|instructions?|guide|documentation|faq)\b/.test(
      q
    ) || /^(?:help me|i need help|where (?:do|can) i)\b/.test(q);
  if (
    /\b(my plan|my subscription|subscription status|billing|paid features?|renew(?:al)?|trial)\b/.test(
      q
    )
  )
    add("billing.status");
  // Action requests ("mark order 12 ready", "resolve table 5's water request") prepare a
  // confirm-first card. Only offered when the person's actions are enabled and permitted.
  if (
    /\b(mark|set|move|accept|reject|cancel|start|complete|finish|resolve|acknowledge|close|clear|dismiss)\b/.test(
      q
    )
  ) {
    if (/\b(table|water|bill|server|waiter|guest request)\b/.test(q) && !/\border\b/.test(q))
      add("propose.guestRequest");
    if (/\b(order|#\s?\d+)\b/.test(q)) add("propose.orderStatus");
    if (/\b(ticket|kitchen|prep|start cooking)\b/.test(q)) add("propose.kitchenTicket");
  }
  // Product questions (plans, pricing, features) are answered from the published Help Center.
  const productInfo =
    /\b(menuminute|kitchen pro|pricing|pricing plans?|commission|subscription|upgrade|free plan|offline|install(?:ing)? the app)\b/.test(
      q
    );
  if (instructional || productInfo) add("help.search");
  if (
    /\b(waiters?|servers?|water|bill request|asking for (?:the )?bill|guest requests?|service requests?|calling for|needs? (?:help|attention))\b/.test(
      q
    )
  )
    add("service.requests");
  if (
    /\b(busiest|peak|rush|slowest|slow.selling|worst.selling|least popular|categor(?:y|ies)|prep time)\b/.test(
      q
    )
  )
    add("reports.insights");
  if (/\b(scans?|scanned|which qr|inactive qr)\b/.test(q)) add("qr.details");
  if (
    /\b(sales?|revenue|earnings?|income|turnover|best.selling|top.selling|last week|this week|this month)\b/.test(
      q
    )
  )
    add("reports.summary");
  if (
    /\b(dish|food|menu item|serve|selling|have|available|stock|sold out|sell|price)\b/.test(q) &&
    !/\b(how much|total sales?|revenue|earnings?|income|turnover)\b/.test(q)
  )
    add("menu.findDish");
  if (/\b(imports?|uploaded|upload|photo menu|menu scan)\b/.test(q)) add("imports.pulse");
  if (/\b(qr|qr code|scan code)\b/.test(q)) add("qr.pulse");
  if (/\b(kitchen|chef|station|prepar|cook)\b/.test(q)) add("kitchen.pulse");
  if (/\b(order|ticket|pending|queue|service)\b/.test(q)) add("orders.pulse");
  if (/\b(table|dine.in|dining)\b/.test(q)) add("tables.pulse");
  if (/\b(draft|published|menus|menu summary)\b/.test(q)) add("menu.summary");
  const order = priorities.length
    ? priorities
    : [
        "orders.pulse",
        "menu.summary",
        "reports.summary",
        "menu.findDish",
        "kitchen.pulse",
        "orders.history",
        "tables.pulse",
        "qr.pulse",
        "help.search",
      ];
  return order
    .map((name) => allowed.find((candidate) => candidate.name === name))
    .filter((tool): tool is T => Boolean(tool))
    .slice(0, 9);
}
