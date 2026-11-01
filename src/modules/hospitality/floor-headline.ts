import type { FloorOverview } from "./floor-contracts";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Hand-written, deterministic hero copy with live numbers. No AI: every sentence is a fixed
 * template, so it is easy to review, translate and test.
 */
export function floorHeadline(
  overview: Pick<FloorOverview, "totals" | "nextReservation">,
  formatTime: (iso: string) => string
): { headline: string; detail: string } {
  const { tables, chairs, currentOccupancy } = overview.totals;
  const booking = overview.nextReservation
    ? `Next booking: ${overview.nextReservation.guestName} for ${overview.nextReservation.partySize} at ${formatTime(overview.nextReservation.time)}.`
    : null;

  if (tables === 0)
    return {
      headline: "Let’s build your dining room.",
      detail: "Add your first table, then give it chairs.",
    };
  if (chairs === 0)
    return {
      headline: `${plural(tables, "table is", "tables are")} waiting for chairs.`,
      detail: "Add chairs so we can count your seats.",
    };
  if (currentOccupancy === 0)
    return {
      headline: `${plural(chairs, "seat", "seats")}, all free.`,
      detail: booking ?? "Your room is open and ready for guests.",
    };
  if (currentOccupancy >= chairs)
    return {
      headline: `Full house: ${chairs} of ${chairs} seats taken.`,
      detail: booking ?? "Mark tables clear as guests leave.",
    };
  return {
    headline: `${currentOccupancy} of ${chairs} seats taken, ${chairs - currentOccupancy} free.`,
    detail: booking ?? "Tap a chair or table to update who is seated.",
  };
}
