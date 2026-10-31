/**
 * Deterministic replies for greetings, thanks and "what can you do?". No provider call, no spend,
 * no business data: the capability list is derived only from the tools this person is already
 * authorized to use, so it never promises something their role cannot do.
 */
const CAPABILITIES: Array<{ tool: string; line: string }> = [
  { tool: "orders.pulse", line: "see what's happening with today's orders right now" },
  { tool: "orders.history", line: "look back at past orders" },
  { tool: "kitchen.pulse", line: "check what the kitchen is working on" },
  { tool: "tables.pulse", line: "check how your tables are doing" },
  { tool: "menu.summary", line: "give an overview of your menus" },
  { tool: "menu.findDish", line: "find a dish and check whether it's on your menu" },
  { tool: "qr.pulse", line: "check your table QR codes" },
  { tool: "imports.pulse", line: "check the progress of a menu import" },
  { tool: "reports.summary", line: "summarize orders and sales for a day, week or month" },
  { tool: "finance.pulse", line: "look at your till and payments overview" },
  { tool: "help.search", line: "explain how to do things in MenuMinute, step by step" },
];

const norm = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const GREETING =
  /^(?:hi+|hello+|hey+|hiya|yo|howdy|namaste|good (?:morning|afternoon|evening)|hi there|hello there|hey there)(?: ember)?$/;
const THANKS =
  /^(?:thanks|thank you|thx|ok thanks|great thanks|thank you (?:so much|ember)|thanks (?:a lot|ember))$/;
const CAPABILITY =
  /^(?:help|help me|what can you do|what do you do|what can i ask(?: you)?|how can you help(?: me)?|what are you|who are you|what is ember|what can ember do|how do i use (?:this|you|ember))$/;

export type SmallTalk = { kind: "greeting" | "thanks" | "capabilities"; answer: string };

export function smallTalkReply(
  prompt: string,
  authorizedTools: ReadonlyArray<string>
): SmallTalk | null {
  const text = norm(prompt);
  if (!text || text.length > 60) return null;
  const allowed = new Set(authorizedTools);
  const lines = CAPABILITIES.filter((c) => allowed.has(c.tool)).map((c) => `- ${c.line}`);
  const menu = lines.length
    ? `Here's what I can help with:\n\n${lines.join("\n")}\n\nI only look things up and explain them. I never change anything without you confirming it first.`
    : "I can answer questions about your restaurant, but your account doesn't have access to any information I can look at yet. Ask your account owner to check your permissions.";
  if (GREETING.test(text))
    return {
      kind: "greeting",
      answer: `Hello! I'm Ember, your restaurant assistant. Ask me something like “How are today's orders going?”\n\n${menu}`,
    };
  if (THANKS.test(text))
    return { kind: "thanks", answer: "You're welcome! Ask me anything else whenever you like." };
  if (CAPABILITY.test(text))
    return { kind: "capabilities", answer: `I'm Ember, your restaurant assistant. ${menu}` };
  return null;
}
