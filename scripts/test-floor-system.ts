/* eslint-disable no-console */
/**
 * Standalone verification for the dining floor v2 (tables, real chairs, sections, occupancy):
 * - contract schemas fail closed
 * - table illustration geometry places one slot per chair
 * - hero copy is deterministic
 * - public demo baseline and migration journal registration
 */
import fs from "node:fs";
import path from "node:path";
import {
  addChairsInputSchema,
  createReservationInputSchema,
  createTableInputSchema,
  setChairOccupiedInputSchema,
  updateTableInputSchema,
} from "../src/modules/hospitality/floor-contracts";
import { floorHeadline } from "../src/modules/hospitality/floor-headline";
import { layoutTable } from "../src/components/dashboard/floor/table-geometry";
import { buildDemoBaseline } from "../src/modules/demo/baseline";

let passed = 0;
let failed = 0;
function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAILED: ${message}`);
    failed++;
  }
}

console.log("=== Dining floor v2 verification ===\n");

console.log("1. Contracts");
assert(
  createTableInputSchema.safeParse({ name: "Window booth", shape: "booth", chairCount: 4 }).success,
  "A named table with chairs is accepted"
);
assert(
  !createTableInputSchema.safeParse({ name: " ", chairCount: 2 }).success,
  "A blank name is rejected"
);
assert(
  !createTableInputSchema.safeParse({ name: "T", chairCount: 31 }).success,
  "More than 30 chairs is rejected"
);
assert(
  !createTableInputSchema.safeParse({ name: "T", capacity: 99 }).success,
  "Clients cannot send capacity; it is derived from chairs"
);
assert(!updateTableInputSchema.safeParse({}).success, "An empty table update is rejected");
assert(
  addChairsInputSchema.safeParse({ count: 3, tableId: null }).success,
  "Unassigned chairs are allowed"
);
assert(
  !setChairOccupiedInputSchema.safeParse({ occupied: true, occupiedBy: "someone" }).success,
  "Occupancy cannot be attributed by the client"
);
assert(
  createReservationInputSchema.safeParse({
    tableId: "t1",
    guestName: "Sarah",
    partySize: 4,
    reservationTime: new Date().toISOString(),
  }).success,
  "A valid reservation is accepted"
);
assert(
  !createReservationInputSchema.safeParse({ guestName: "", partySize: 0, reservationTime: "x" })
    .success,
  "An invalid reservation fails closed"
);

console.log("\n2. Illustration geometry");
for (const shape of ["round", "square", "rectangle", "booth"] as const)
  assert(layoutTable(shape, 6).slots.length === 6, `${shape} table places one slot per chair`);

console.log("\n3. Hero copy");
const totals = {
  tables: 3,
  chairs: 12,
  maxOccupancy: 12,
  currentOccupancy: 7,
  sections: 2,
  tablesOccupied: 2,
};
assert(
  floorHeadline({ totals, nextReservation: null }, (i) => i).headline ===
    "7 of 12 seats taken, 5 free.",
  "Headline carries live numbers"
);

console.log("\n4. Public demo baseline and migration");
const baseline = buildDemoBaseline();
assert(baseline.tables.length === 12, "Demo baseline contains all 12 tables");
assert(
  baseline.tables.every((t) => t.capacity >= 1 && t.capacity <= 30),
  "Every demo table seats 1 to 30 (the reset seeds that many chairs)"
);
const journal = JSON.parse(
  fs.readFileSync(path.resolve("src/db/migrations/meta/_journal.json"), "utf8")
) as { entries: Array<{ tag: string }> };
assert(
  journal.entries.some((e) => e.tag === "0070_floor_chairs_and_sections"),
  "Migration 0070 is registered in the journal"
);
const sql = fs.readFileSync(
  path.resolve("src/db/migrations/0070_floor_chairs_and_sections.sql"),
  "utf8"
);
assert(
  !/\bDROP\s+TABLE\b|\bTRUNCATE\b|\bDELETE\s+FROM\b/i.test(sql),
  "Migration 0070 deletes no data"
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
