// @vitest-environment jsdom
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { KITCHEN_CARDS } from "@/components/marketing/kitchen-board/kitchen-board-fixture";
import {
  FOCUS_TICKET_ID,
  advanceTicket,
  ageMinutes,
  ageTone,
  autoStep,
  canAdvance,
  confettiBurst,
  isAutoplayDone,
  nextStage,
  seedTickets,
  summarise,
  toggleLine,
  trackerSteps,
} from "@/components/marketing/kitchen-board/kitchen-board-logic";

const focus = (tickets: ReturnType<typeof seedTickets>) =>
  tickets.find((ticket) => ticket.id === FOCUS_TICKET_ID)!;

describe("kitchen board logic", () => {
  it("seeds the Table 11 order from section 2 plus ambient tickets", () => {
    const tickets = seedTickets();
    expect(focus(tickets).label).toBe("Table 11");
    expect(focus(tickets).stage).toBe("new");
    expect(tickets).toHaveLength(3);
    expect(new Set(tickets.map((t) => t.id)).size).toBe(3);
  });

  it("only moves a ticket to ready when every dish is done", () => {
    let tickets = advanceTicket(seedTickets(), FOCUS_TICKET_ID);
    expect(focus(tickets).stage).toBe("preparing");
    expect(canAdvance(focus(tickets))).toBe(false);
    expect(focus(advanceTicket(tickets, FOCUS_TICKET_ID)).stage).toBe("preparing");
    for (const line of focus(tickets).lines) {
      tickets = toggleLine(tickets, FOCUS_TICKET_ID, line.dishId);
    }
    expect(canAdvance(focus(tickets))).toBe(true);
    tickets = advanceTicket(tickets, FOCUS_TICKET_ID);
    expect(focus(tickets).stage).toBe("ready");
    tickets = advanceTicket(tickets, FOCUS_TICKET_ID);
    expect(focus(tickets).stage).toBe("served");
    expect(canAdvance(focus(tickets))).toBe(false);
    expect(nextStage("served")).toBe("served");
  });

  it("only toggles dishes while a ticket is preparing", () => {
    const before = seedTickets();
    expect(toggleLine(before, FOCUS_TICKET_ID, focus(before).lines[0]!.dishId)).toEqual(before);
  });

  it("does not mutate its input", () => {
    const before = seedTickets();
    const snapshot = JSON.stringify(before);
    advanceTicket(before, FOCUS_TICKET_ID);
    autoStep(before);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it("autoplay walks the focus ticket to served and then stops changing it", () => {
    let tickets = seedTickets();
    let steps = 0;
    while (!isAutoplayDone(tickets) && steps < 20) {
      tickets = autoStep(tickets);
      steps += 1;
    }
    expect(focus(tickets).stage).toBe("served");
    // accept + two dishes + ready + serve
    expect(steps).toBe(5);
    expect(JSON.stringify(autoStep(tickets))).toBe(JSON.stringify(tickets));
  });

  it("labels ticket age with a word as well as a tone", () => {
    expect(ageTone(3)).toEqual({ tone: "ok", label: "On time" });
    expect(ageTone(8)).toEqual({ tone: "soon", label: "Due soon" });
    expect(ageTone(12)).toEqual({ tone: "late", label: "Late" });
    const [t11, t04] = [seedTickets()[0]!, seedTickets()[1]!];
    expect(ageMinutes(t11, 0)).toBe(0);
    expect(ageMinutes(t04, 0)).toBe(9);
    expect(ageMinutes(t11, -5)).toBe(0);
  });

  it("maps the focus stage to the guest tracker", () => {
    const states = (stage: Parameters<typeof trackerSteps>[0]) =>
      trackerSteps(stage).steps.map((step) => step.state);
    expect(states("new")).toEqual(["current", "todo", "todo", "todo", "todo"]);
    expect(states("preparing")).toEqual(["done", "done", "current", "todo", "todo"]);
    expect(states("ready")).toEqual(["done", "done", "done", "current", "todo"]);
    expect(states("served")).toEqual(["done", "done", "done", "done", "done"]);
    expect(trackerSteps("ready").message).toMatch(/ready/i);
  });

  it("summarises the board", () => {
    let tickets = seedTickets();
    expect(summarise(tickets, 0)).toEqual({ onPass: 3, ready: 0, served: 0 });
    while (!isAutoplayDone(tickets)) tickets = autoStep(tickets);
    const served = tickets.filter((t) => t.stage === "served").length;
    expect(summarise(tickets, served)).toEqual({ onPass: 2, ready: 0, served: 1 });
  });

  it("builds a deterministic confetti burst", () => {
    expect(confettiBurst()).toEqual(confettiBurst());
    expect(confettiBurst(10)).toHaveLength(10);
    for (const piece of confettiBurst()) {
      expect(Math.hypot(piece.x, piece.y)).toBeLessThanOrEqual(75);
      expect([0, 1, 2]).toContain(piece.hue);
    }
  });
});

describe("kitchen board copy", () => {
  it("links every card to an existing public page", () => {
    for (const card of KITCHEN_CARDS) {
      const route = card.href.split("#")[0]!.replace(/^\//, "");
      expect(existsSync(join(process.cwd(), "src/app", route, "page.tsx")), card.href).toBe(true);
    }
  });

  it("does not promise instant or universal availability", () => {
    const text = KITCHEN_CARDS.map((card) => `${card.title} ${card.body}`).join(" ");
    expect(text).not.toMatch(/instant|everyone|every outlet|guarantee/i);
  });
});
