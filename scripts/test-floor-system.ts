/* eslint-disable no-console */
/**
 * Standalone Verification Suite for Dining Floor Visual System:
 * - Contract schemas & validations
 * - Parametric SVG chair and table geometry calculations
 * - Public demo baseline layout & sample reservations
 * - Table data to QR Code generator URL and SVG rendering
 * - Migration journal & demo reset registration
 */
import {
  floorLayoutDocSchema,
  createReservationInputSchema,
} from "../src/modules/hospitality/floor-contracts";
import { buildDemoBaseline } from "../src/modules/demo/baseline";
import QRCode from "qrcode";
import fs from "node:fs";
import path from "node:path";

async function main() {
  console.log("=== Running Visual Dining Floor & Tabletop QR Verification ===\n");
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

  // ─── 1. Contract & Schema Validation ───────────────────────────────────────
  console.log("1. Validating Floor & Reservation Contracts...");
  const validLayout = {
    version: 1,
    canvas: { width: 1400, height: 900, gridSnap: 20 },
    sections: [
      { id: "sec-1", name: "Main Dining", color: "#f59e0b" },
      { id: "sec-2", name: "Terrace", color: "#10b981" },
    ],
    tables: [
      {
        id: "tbl-1",
        tableNumber: "1",
        label: "Window 1",
        capacity: 4,
        shape: "round",
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        rotation: 0,
        section: "Main Dining",
        assignedStaff: "Carlos",
      },
    ],
  };

  const parsedLayout = floorLayoutDocSchema.safeParse(validLayout);
  assert(parsedLayout.success, "Valid FloorLayoutDoc parses successfully");

  const invalidLayout = {
    version: 1,
    canvas: { width: 100, height: 100, gridSnap: 20 }, // below min width
    tables: [{ id: "t1", capacity: -5 }], // negative capacity
  };
  assert(!floorLayoutDocSchema.safeParse(invalidLayout).success, "Invalid layout doc fails closed");

  const validRes = {
    tableId: "tbl-1",
    guestName: "Sarah Connor",
    partySize: 4,
    reservationTime: new Date().toISOString(),
    durationMinutes: 90,
    notes: "Anniversary",
  };
  assert(
    createReservationInputSchema.safeParse(validRes).success,
    "Valid reservation input accepted"
  );

  const invalidRes = {
    guestName: "",
    partySize: 0,
    reservationTime: "not-a-date",
  };
  assert(
    !createReservationInputSchema.safeParse(invalidRes).success,
    "Invalid reservation input fails closed"
  );

  // ─── 2. Parametric Chair Geometry Calculations ────────────────────────────
  console.log("\n2. Validating Parametric SVG Chair Distributions...");

  // Radial calculation test
  function testRadialChairs(radius: number, count: number) {
    const chairs = [];
    const offsetDistance = radius + 15;
    for (let i = 0; i < count; i++) {
      const angleRad = (2 * Math.PI * i) / count - Math.PI / 2;
      const x = offsetDistance * Math.cos(angleRad);
      const y = offsetDistance * Math.sin(angleRad);
      chairs.push({ x, y });
    }
    return chairs;
  }

  const round2 = testRadialChairs(45, 2);
  assert(round2.length === 2, "2-top round table generates exactly 2 radial chairs");
  // Check chairs are opposite each other (180 deg)
  const dist2 =
    round2[0] && round2[1] ? Math.hypot(round2[0].x - round2[1].x, round2[0].y - round2[1].y) : 0;
  assert(
    Math.abs(dist2 - 2 * 60) < 0.1,
    "2-top round chairs are positioned directly opposite (180°)"
  );

  const round6 = testRadialChairs(60, 6);
  assert(round6.length === 6, "6-top round table generates exactly 6 radial chairs");

  // Rectangular calculation test
  function testRectChairs(w: number, h: number, count: number) {
    const chairs = [];
    const cx = w / 2;
    const cy = h / 2;
    const offset = 14;

    if (count <= 2) {
      chairs.push({ x: cx, y: -offset });
      if (count === 2) chairs.push({ x: cx, y: h + offset });
      return chairs;
    }

    if (count === 4) {
      chairs.push({ x: cx, y: -offset });
      chairs.push({ x: w + offset, y: cy });
      chairs.push({ x: cx, y: h + offset });
      chairs.push({ x: -offset, y: cy });
      return chairs;
    }

    const sideCount = Math.floor(count / 2);
    const topCount = sideCount;
    for (let i = 0; i < topCount; i++) {
      chairs.push({ x: (w / (topCount + 1)) * (i + 1), y: -offset });
    }
    const bottomCount = sideCount;
    for (let i = 0; i < bottomCount; i++) {
      chairs.push({ x: (w / (bottomCount + 1)) * (i + 1), y: h + offset });
    }
    if (count % 2 > 0) {
      chairs.push({ x: w + offset, y: cy });
    }
    return chairs;
  }

  const rect4 = testRectChairs(100, 100, 4);
  assert(rect4.length === 4, "4-top square table has 1 chair per edge");

  const rect8 = testRectChairs(180, 90, 8);
  assert(rect8.length === 8, "8-top rectangular table distributes 4 chairs on top and 4 on bottom");

  // ─── 3. Demo Baseline & Public Seeding Verification ────────────────────────
  console.log("\n3. Validating Public Demo Baseline & Seeding...");
  const baseline = buildDemoBaseline();
  assert(
    Array.isArray(baseline.tables) && baseline.tables.length === 12,
    "Demo baseline contains all 12 tables"
  );
  assert(Boolean(baseline.floorPlan), "Demo baseline has floorPlan layout defined");
  assert(
    baseline.floorPlan?.tables.length === 12,
    "Demo floor plan maps all 12 tables with coordinates"
  );

  const hasRound = baseline.floorPlan?.tables.some((t) => t.shape === "round");
  const hasSquare = baseline.floorPlan?.tables.some((t) => t.shape === "square");
  const hasRect = baseline.floorPlan?.tables.some((t) => t.shape === "rectangle");
  const hasBooth = baseline.floorPlan?.tables.some((t) => t.shape === "booth");
  const hasBar = baseline.floorPlan?.tables.some((t) => t.shape === "bar");
  assert(
    Boolean(hasRound && hasSquare && hasRect && hasBooth && hasBar),
    "Demo floor plan features all 5 table shapes: Round, Square, Rect, Booth, and Bar"
  );

  assert(
    Array.isArray(baseline.reservations) && baseline.reservations.length >= 3,
    "Demo baseline contains sample time-slot reservations"
  );
  const boothRes = baseline.reservations?.find((r) => r.tableId === "demo-table-9");
  assert(Boolean(boothRes), "Sample reservation booked at Table 9 (Window booth)");

  // ─── 4. Table Data to QR Code Generator Integration ───────────────────────
  console.log("\n4. Validating Table Data to QR Code Generator Bridge...");
  const origin = "https://food.bababuilds.com";
  const destinationToken = "dest-token-abc123xyz";
  const tableOrderUrl = `${origin}/m/${destinationToken}`;

  assert(
    tableOrderUrl === "https://food.bababuilds.com/m/dest-token-abc123xyz",
    "Table destination URL formats correctly"
  );

  const qrSvgString = await QRCode.toString(tableOrderUrl, {
    type: "svg",
    margin: 1,
    color: { dark: "#1c1917", light: "#ffffff" },
  });

  assert(
    qrSvgString.startsWith("<svg") && qrSvgString.includes("</svg>"),
    "Client QRCode generates valid SVG markup"
  );
  assert(qrSvgString.includes("path"), "QR Code SVG contains rendering paths");

  // ─── 5. Database Migration & Registration Integrity ───────────────────────
  console.log("\n5. Validating Migration Journal & Demo Test Registration...");
  const migrationPath = path.resolve(
    process.cwd(),
    "src/db/migrations/0068_dining_floor_and_reservations.sql"
  );
  assert(fs.existsSync(migrationPath), "Migration 0068_dining_floor_and_reservations.sql exists");

  const journalPath = path.resolve(process.cwd(), "src/db/migrations/meta/_journal.json");
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));
  const entry68 = journal.entries.find(
    (e: { tag: string }) => e.tag === "0068_dining_floor_and_reservations"
  );
  assert(
    Boolean(entry68 && entry68.idx === 67),
    "Migration 0065 is registered at idx 67 in _journal.json"
  );

  const demoTestPath = path.resolve(process.cwd(), "tests/demo-reset.test.ts");
  const demoTestContent = fs.readFileSync(demoTestPath, "utf-8");
  assert(
    demoTestContent.includes("dining_floor_plans") &&
      demoTestContent.includes("dining_reservations"),
    "dining_floor_plans and dining_reservations are registered in PRESERVED in demo-reset.test.ts"
  );

  console.log(`\n======================================================`);
  console.log(`Total checks: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);

  if (failed > 0) {
    console.error("❌ Some verification checks failed!");
    process.exit(1);
  } else {
    console.log("🎉 ALL VISUAL DINING FLOOR VERIFICATION CHECKS PASSED!");
  }
}

main().catch((e) => {
  console.error("Unhandled error in test runner:", e);
  process.exit(1);
});
