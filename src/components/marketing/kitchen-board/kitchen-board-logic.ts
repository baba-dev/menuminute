/**
 * Pure logic for the "Fired, plated, served" kitchen board (home-v2 section 3). Sample data only:
 * the tickets mirror the Table 11 order from section 2 plus two ambient tickets. No API, no timers
 * here, so every rule is unit-testable. This is an illustrative preview.
 */
import { SAMPLE_TABLE, sampleDish, type SampleDish } from "../scan-to-order/scan-to-order-fixture";

export type Stage = "new" | "preparing" | "ready" | "served";
export const STAGES: readonly Stage[] = ["new", "preparing", "ready", "served"];

export type TicketLine = { dishId: string; quantity: number; done: boolean };
export type Ticket = {
  id: string;
  label: string;
  kind: "dine-in" | "pickup";
  stage: Stage;
  /** Sample-clock minute at which the order was placed (may be negative: already on the pass). */
  placedAt: number;
  lines: TicketLine[];
  /** True only for the Table 11 ticket that the guest tracker follows. */
  focus?: boolean;
};

export const FOCUS_TICKET_ID = "t-11";

/** Sample minutes shown per real second while the section is on screen. */
export const SAMPLE_MINUTES_PER_SECOND = 1;

export const STAGE_LABEL: Record<Stage, string> = {
  new: "New",
  preparing: "Preparing",
  ready: "Ready",
  served: "Served",
};

export const ACTION_LABEL: Record<Exclude<Stage, "served">, string> = {
  new: "Accept",
  preparing: "Mark ready",
  ready: "Serve",
};

export function seedTickets(): Ticket[] {
  return [
    {
      id: FOCUS_TICKET_ID,
      label: SAMPLE_TABLE,
      kind: "dine-in",
      stage: "new",
      placedAt: 0,
      focus: true,
      lines: [
        { dishId: "MM-CORE-butter-chicken", quantity: 1, done: false },
        { dishId: "MM-CORE-biryani", quantity: 2, done: false },
      ],
    },
    {
      id: "t-04",
      label: "Table 4",
      kind: "dine-in",
      stage: "preparing",
      placedAt: -9,
      lines: [
        { dishId: "MM-IN-045", quantity: 2, done: true },
        { dishId: "MM-IN-013", quantity: 1, done: false },
      ],
    },
    {
      id: "t-28",
      label: "Pickup 28",
      kind: "pickup",
      stage: "new",
      placedAt: -3,
      lines: [
        { dishId: "MM-CORE-biryani", quantity: 1, done: false },
        { dishId: "MM-CORE-butter-chicken", quantity: 1, done: false },
      ],
    },
  ];
}

/** Station shown beside a line. Derived from the sample dish's category, never invented per dish. */
export function stationOf(dish: SampleDish | undefined): string {
  return dish?.category === "mains" ? "Curry" : "Rice & grill";
}

export const allLinesDone = (ticket: Ticket) => ticket.lines.every((line) => line.done);

export function nextStage(stage: Stage): Stage {
  const index = STAGES.indexOf(stage);
  return STAGES[Math.min(index + 1, STAGES.length - 1)]!;
}

/** Whether a ticket may move on. A ticket cannot be marked ready until every line is done. */
export function canAdvance(ticket: Ticket): boolean {
  if (ticket.stage === "served") return false;
  if (ticket.stage === "preparing") return allLinesDone(ticket);
  return true;
}

export function advanceTicket(tickets: readonly Ticket[], id: string): Ticket[] {
  return tickets.map((ticket) =>
    ticket.id === id && canAdvance(ticket) ? { ...ticket, stage: nextStage(ticket.stage) } : ticket
  );
}

export function toggleLine(tickets: readonly Ticket[], id: string, dishId: string): Ticket[] {
  return tickets.map((ticket) =>
    ticket.id === id && ticket.stage === "preparing"
      ? {
          ...ticket,
          lines: ticket.lines.map((line) =>
            line.dishId === dishId ? { ...line, done: !line.done } : line
          ),
        }
      : ticket
  );
}

export type AgeTone = "ok" | "soon" | "late";
export const DUE_SOON_MINUTES = 8;
export const LATE_MINUTES = 12;

export function ageMinutes(ticket: Ticket, clock: number): number {
  return Math.max(0, Math.floor(clock - ticket.placedAt));
}

/** Tone comes with a word, so it never relies on colour alone. */
export function ageTone(minutes: number): { tone: AgeTone; label: string } {
  if (minutes >= LATE_MINUTES) return { tone: "late", label: "Late" };
  if (minutes >= DUE_SOON_MINUTES) return { tone: "soon", label: "Due soon" };
  return { tone: "ok", label: "On time" };
}

/** One autoplay step for the focus ticket: accept, tick each line, mark ready, serve. */
export function autoStep(tickets: readonly Ticket[]): Ticket[] {
  const ticket = tickets.find((item) => item.id === FOCUS_TICKET_ID);
  if (!ticket || ticket.stage === "served") return [...tickets];
  if (ticket.stage === "preparing") {
    const open = ticket.lines.find((line) => !line.done);
    if (open) return toggleLine(tickets, ticket.id, open.dishId);
  }
  return advanceTicket(tickets, ticket.id);
}

export const isAutoplayDone = (tickets: readonly Ticket[]) =>
  tickets.find((ticket) => ticket.id === FOCUS_TICKET_ID)?.stage === "served";

export type TrackerStep = { id: string; label: string; state: "done" | "current" | "todo" };

/** Guest-facing progress for the focus ticket (illustrative guest view). */
export function trackerSteps(stage: Stage): { steps: TrackerStep[]; message: string } {
  const order = ["sent", "accepted", "preparing", "ready", "served"] as const;
  const labels = {
    sent: "Request sent",
    accepted: "Accepted",
    preparing: "Being prepared",
    ready: "Ready",
    served: "Served",
  } as const;
  const current: (typeof order)[number] =
    stage === "new" ? "sent" : stage === "preparing" ? "preparing" : stage;
  const currentIndex = order.indexOf(current);
  const steps = order.map((id, index) => ({
    id,
    label: labels[id],
    state: (stage === "served" || index < currentIndex
      ? "done"
      : index === currentIndex
        ? "current"
        : "todo") as TrackerStep["state"],
  }));
  const message =
    stage === "new"
      ? "Waiting for the restaurant to accept"
      : stage === "preparing"
        ? "Your order is being prepared"
        : stage === "ready"
          ? "Your order is ready"
          : "Enjoy your meal";
  return { steps, message };
}

export type BoardSummary = { onPass: number; ready: number; served: number };

export function summarise(tickets: readonly Ticket[], servedCount: number): BoardSummary {
  return {
    onPass: tickets.filter((ticket) => ticket.stage !== "served").length,
    ready: tickets.filter((ticket) => ticket.stage === "ready").length,
    served: servedCount,
  };
}

export const lineName = (line: TicketLine) => sampleDish(line.dishId)?.name ?? "Dish";

/** Confetti burst geometry: evenly spread, deterministic (no Math.random, so SSR-safe and testable). */
export function confettiBurst(count = 14, radius = 74): { x: number; y: number; hue: number }[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
    const reach = radius * (0.65 + (0.35 * ((index * 7) % 5)) / 4);
    return {
      x: Math.round(Math.cos(angle) * reach),
      y: Math.round(Math.sin(angle) * reach),
      hue: index % 3,
    };
  });
}
