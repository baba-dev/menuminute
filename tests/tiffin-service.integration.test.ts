import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { admin, fixture } from "./helpers";
import {
  clearOverride,
  mapTiffinError,
  publicWeek,
  quoteSelection,
  readTiffinMenu,
  saveCombo,
  saveSlot,
  setComboArchived,
  setOverride,
  setWeekMenu,
  type PublicWeek,
} from "../src/modules/tiffin/service";
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../src/lib/errors";

const app = new Pool({ connectionString: process.env["DATABASE_URL"], max: 2 });
const worker = new Pool({ connectionString: process.env["WORKER_DATABASE_URL"], max: 1 });
afterAll(async () => {
  await app.end();
  await worker.end();
});
beforeEach(() => {
  vi.stubEnv("TIFFIN_ENABLED", "true");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

type Actor = { userId: string };
type Outlet = { actor: Actor; outletId: string; org: string; token: string; timezone: string };

async function tiffinOutlet(timezone = "Asia/Kolkata", currency = "INR"): Promise<Outlet> {
  const f = await fixture(currency);
  await admin(async (_db, pool) => {
    await pool.query(
      "update restaurants set outlet_type='tiffin',is_published=true,timezone=$2 where id=$1",
      [f.outlet.id, timezone]
    );
  });
  return {
    actor: f.actor,
    outletId: f.outlet.id,
    org: f.outlet.organizationId,
    token: f.outlet.publicId,
    timezone,
  };
}

async function addMember(org: string, outletId: string, roles: string[]) {
  const userId = crypto.randomUUID();
  const memberId = crypto.randomUUID();
  await admin(async (_db, pool) => {
    await pool.query(
      "insert into users(id,name,email,email_verified) values($1,'Tiffin member',$2,true)",
      [userId, `${userId}@tiffin.invalid`]
    );
    await pool.query(
      "insert into organization_members(id,organization_id,user_id,role,is_active) values($1,$2,$3,'member',true)",
      [memberId, org, userId]
    );
    await pool.query(
      "insert into outlet_grants(organization_id,member_id,outlet_id,roles) values($1,$2,$3,$4::text[])",
      [org, memberId, outletId, roles]
    );
  });
  return { userId };
}

async function localToday(timezone: string) {
  return admin(async (_db, pool) => {
    const r = await pool.query<{ d: string }>(
      "select ((statement_timestamp() at time zone $1)::date)::text as d",
      [timezone]
    );
    return r.rows[0]!.d;
  });
}
const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dow = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

const slot = (kind: "lunch" | "dinner", extra: Record<string, unknown> = {}) => ({
  kind,
  startMinute: kind === "lunch" ? 720 : 1170,
  endMinute: kind === "lunch" ? 840 : 1290,
  cutoffMinutesBefore: 120,
  capacity: null,
  ...extra,
});
const thali = {
  name: "Veg Thali",
  description: "Dal, sabzi, rice",
  priceMinor: 12000,
  items: [
    { label: "Roti", quantity: 4 },
    { label: "Dal", quantity: 1 },
  ],
  addons: [{ label: "Extra roti", priceMinor: 1000 }],
};
const snack = {
  name: "Snack Box",
  priceMinor: 8000,
  items: [{ label: "Samosa", quantity: 2 }],
  addons: [],
};
const plain = (name: string, priceMinor = 5000) => ({
  name,
  priceMinor,
  items: [{ label: name, quantity: 1 }],
  addons: [{ label: `${name} pickle`, priceMinor: 500 }],
});

type SavedCombo = { id: string; name: string; addons: { id: string; label: string }[] };
const save = async (o: Outlet, raw: unknown) =>
  (await saveCombo(o.actor, o.outletId, raw)) as SavedCombo;

/** A tiffin outlet with lunch+dinner slots and thali/snack (lunch, every weekday). */
async function seeded(timezone = "Asia/Kolkata") {
  const o = await tiffinOutlet(timezone);
  await saveSlot(o.actor, o.outletId, slot("lunch"));
  await saveSlot(o.actor, o.outletId, slot("dinner"));
  const t = await save(o, thali);
  const s = await save(o, snack);
  for (let weekday = 0; weekday < 7; weekday++)
    await setWeekMenu(o.actor, o.outletId, {
      slotKind: "lunch",
      weekday,
      comboIds: [s.id, t.id],
    });
  const today = await localToday(timezone);
  return { ...o, thali: t, snack: s, today };
}

/** Resolves a slot-day's ordered comboIds through the week's combo map. */
const slotCombos = (week: PublicWeek | null, i: number, kind: "lunch" | "dinner" = "lunch") =>
  week!.days[i]!.slots[kind]!.comboIds.map((id) => week!.combos[id]!);
const lunchNames = (week: PublicWeek | null, i: number) => slotCombos(week, i).map((c) => c.name);

function keysDeep(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => keysDeep(v, out));
  else if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value)) {
      out.add(k);
      keysDeep(v, out);
    }
  return out;
}

async function expectReject(
  work: Promise<unknown>,
  type: new (...a: never[]) => Error,
  message?: string
) {
  let error: unknown;
  try {
    await work;
  } catch (e) {
    error = e;
  }
  expect(error, "expected a rejection").toBeInstanceOf(type);
  if (message !== undefined) expect((error as Error).message).toBe(message);
}

describe("tiffin public week", () => {
  it("returns the seeded weekday menu in order with the public combo shape and no tenant ids", async () => {
    const o = await seeded();
    const week = await publicWeek(o.token, o.today, 7);
    expect(week).not.toBeNull();
    expect(week!.outlet).toEqual({
      id: o.outletId,
      name: "Fixture Kitchen",
      currency: "INR",
      timezone: "Asia/Kolkata",
    });
    expect(week!.days).toHaveLength(7);
    week!.days.forEach((day, i) => {
      expect(day.localDate).toBe(addDays(o.today, i));
      expect(day.weekday).toBe(dow(day.localDate));
      expect(lunchNames(week, i)).toEqual(["Snack Box", "Veg Thali"]);
      expect(day.slots.lunch).toMatchObject({
        kind: "lunch",
        startMinute: 720,
        endMinute: 840,
        open: true,
        closed: false,
      });
      // Dinner is enabled but has no menu.
      expect(day.slots.dinner).toMatchObject({ open: false, closed: false, comboIds: [] });
      expect(day.slots.lunch!.comboIds).toEqual([o.snack.id, o.thali.id]);
      expect(day.slots.lunch).not.toHaveProperty("combos");
    });
    expect(Object.keys(week!.combos).sort()).toEqual([o.snack.id, o.thali.id].sort());
    expect(week!.combos[o.thali.id]).toEqual({
      id: o.thali.id,
      name: "Veg Thali",
      description: "Dal, sabzi, rice",
      priceMinor: "12000",
      items: [
        { label: "Roti", quantity: 4 },
        { label: "Dal", quantity: 1 },
      ],
      addons: [{ id: o.thali.addons[0]!.id, label: "Extra roti", priceMinor: "1000" }],
    });
    const keys = keysDeep(week);
    for (const k of ["organization_id", "organizationId", "outlet_id", "currency_code", "archived"])
      expect(keys.has(k)).toBe(false);
    expect(JSON.stringify(week)).not.toContain(o.org);
  });

  it("defaults to seven days from the outlet-local today", async () => {
    const o = await seeded();
    const week = await publicWeek(o.token);
    expect(week!.days.map((d) => d.localDate)).toEqual(
      Array.from({ length: 7 }, (_, i) => addDays(o.today, i))
    );
  });

  it("applies date overrides: closed hides the day, combos replace the weekday menu", async () => {
    const o = await seeded();
    const veg = await save(o, plain("Rajma Rice"));
    const closedDay = addDays(o.today, 1);
    const replacedDay = addDays(o.today, 2);
    const emptyDay = addDays(o.today, 3);
    await setOverride(o.actor, o.outletId, {
      slotKind: "lunch",
      localDate: closedDay,
      closed: true,
      comboIds: [],
    });
    await setOverride(o.actor, o.outletId, {
      slotKind: "lunch",
      localDate: replacedDay,
      closed: false,
      comboIds: [veg.id],
    });
    await setOverride(o.actor, o.outletId, {
      slotKind: "lunch",
      localDate: emptyDay,
      closed: false,
      comboIds: [],
    });
    const week = await publicWeek(o.token, o.today, 5);
    expect(lunchNames(week, 0)).toEqual(["Snack Box", "Veg Thali"]);
    expect(week!.days[1]!.slots.lunch).toMatchObject({ closed: true, open: false, comboIds: [] });
    expect(lunchNames(week, 2)).toEqual(["Rajma Rice"]);
    expect(week!.days[2]!.slots.lunch).toMatchObject({ closed: false, open: true });
    expect(week!.days[3]!.slots.lunch).toMatchObject({
      closed: false,
      open: false,
      comboIds: [],
    });
    expect(lunchNames(week, 4)).toEqual(["Snack Box", "Veg Thali"]);

    // Clearing the override restores the weekday menu.
    await clearOverride(o.actor, o.outletId, {
      slotKind: "lunch",
      localDate: closedDay,
      clear: true,
    });
    expect(lunchNames(await publicWeek(o.token, closedDay, 1), 0)).toEqual([
      "Snack Box",
      "Veg Thali",
    ]);
  });

  it("omits archived combos and disabled slots", async () => {
    const o = await seeded();
    await setWeekMenu(o.actor, o.outletId, {
      slotKind: "dinner",
      weekday: dow(o.today),
      comboIds: [o.snack.id],
    });
    expect((await publicWeek(o.token, o.today, 1))!.days[0]!.slots.dinner!.comboIds).toEqual([
      o.snack.id,
    ]);
    await setComboArchived(o.actor, o.outletId, { id: o.thali.id, archived: true });
    await saveSlot(o.actor, o.outletId, slot("dinner", { enabled: false }));
    const week = await publicWeek(o.token, o.today, 7);
    for (let i = 0; i < 7; i++) {
      expect(lunchNames(week, i)).toEqual(["Snack Box"]);
      expect(week!.days[i]!.slots.dinner).toBeUndefined();
      expect(Object.keys(week!.days[i]!.slots)).toEqual(["lunch"]);
    }
    expect(JSON.stringify(week)).not.toContain(o.thali.id);
    expect(Object.keys(week!.combos)).toEqual([o.snack.id]);
  });

  it("never shows another outlet's combos", async () => {
    const a = await seeded();
    const b = await tiffinOutlet();
    await saveSlot(b.actor, b.outletId, slot("lunch"));
    const secret = await save(b, plain("Other Kitchen Secret"));
    await setWeekMenu(b.actor, b.outletId, {
      slotKind: "lunch",
      weekday: dow(a.today),
      comboIds: [secret.id],
    });
    const text = JSON.stringify(await publicWeek(a.token, a.today, 7));
    expect(text).not.toContain(secret.id);
    expect(text).not.toContain("Other Kitchen Secret");
    expect(text).not.toContain(b.outletId);
    expect(lunchNames(await publicWeek(b.token, a.today, 1), 0)).toEqual(["Other Kitchen Secret"]);
  });

  it("embeds each combo once: a maximal week stays bounded and slots carry only ordered ids", async () => {
    const o = await tiffinOutlet();
    await saveSlot(o.actor, o.outletId, slot("lunch"));
    await saveSlot(o.actor, o.outletId, slot("dinner"));
    // Maximal ASCII combos: 300-char description, 20 items and 20 add-ons with 80-char labels.
    const big = (tag: string, n: number) => ({
      name: `${tag} combo ${n} `.padEnd(80, "n"),
      description: `${tag}-description-${n}-`.padEnd(300, "d"),
      priceMinor: 2147483647,
      items: Array.from({ length: 20 }, (_, i) => ({
        label: `item ${i} `.padEnd(80, "i"),
        quantity: 99,
      })),
      addons: Array.from({ length: 20 }, (_, i) => ({
        label: `addon ${i} `.padEnd(80, "a"),
        priceMinor: 2147483647,
      })),
    });
    const lunchIds: string[] = [];
    const dinnerIds: string[] = [];
    for (let n = 0; n < 50; n++) {
      lunchIds.push((await save(o, big("L", n))).id);
      dinnerIds.push((await save(o, big("D", n))).id);
    }
    const dinnerOrder = [...dinnerIds].reverse();
    for (let weekday = 0; weekday < 7; weekday++) {
      await setWeekMenu(o.actor, o.outletId, { slotKind: "lunch", weekday, comboIds: lunchIds });
      await setWeekMenu(o.actor, o.outletId, {
        slotKind: "dinner",
        weekday,
        comboIds: dinnerOrder,
      });
    }
    const archivedId = lunchIds[0]!;
    await setComboArchived(o.actor, o.outletId, { id: archivedId, archived: true });
    const expectedLunch = lunchIds.slice(1);

    const week = await publicWeek(o.token, await localToday(o.timezone), 7);
    const text = JSON.stringify(week);
    expect(Buffer.byteLength(text, "utf8")).toBeLessThan(1.5 * 1024 * 1024);
    expect(Object.keys(week!.combos).sort()).toEqual([...expectedLunch, ...dinnerIds].sort());
    expect(text).not.toContain(archivedId);
    for (const [id, combo] of Object.entries(week!.combos)) {
      expect(combo.id).toBe(id);
      // Each combo body (its unique description) is embedded exactly once.
      expect(text.split(combo.description).length - 1).toBe(1);
    }
    expect(week!.days).toHaveLength(7);
    for (const day of week!.days) {
      expect(day.slots.lunch!.comboIds).toEqual(expectedLunch);
      expect(day.slots.dinner!.comboIds).toEqual(dinnerOrder);
      for (const s of [day.slots.lunch!, day.slots.dinner!]) {
        expect(Object.keys(s).sort()).toEqual([
          "closed",
          "comboIds",
          "endMinute",
          "kind",
          "open",
          "startMinute",
        ]);
        expect(s.comboIds.every((id) => typeof id === "string")).toBe(true);
      }
    }
  }, 120_000);

  it.each([
    ["revoked QR", "update qr_codes set is_active=false where destination_token=$1", true],
    ["unpublished outlet", "update restaurants set is_published=false where id=$1", false],
    ["inactive outlet", "update restaurants set is_active=false where id=$1", false],
    ["restaurant outlet", "update restaurants set outlet_type='restaurant' where id=$1", false],
    [
      "inactive organization",
      "update organizations set is_active=false where id=(select organization_id from restaurants where id=$1)",
      false,
    ],
  ])(
    "is not found for a %s (week null, quote NotFoundError)",
    async (_label, statement, byToken) => {
      const o = await seeded();
      const quote = {
        localDate: o.today,
        slotKind: "lunch",
        lines: [{ comboId: o.thali.id, addonIds: [], quantity: 1 }],
      };
      expect(await publicWeek(o.token, o.today, 1)).not.toBeNull();
      await quoteSelection(o.token, quote);
      await admin(async (_db, pool) => {
        await pool.query(statement, [byToken ? o.token : o.outletId]);
      });
      expect(await publicWeek(o.token, o.today, 1)).toBeNull();
      await expectReject(quoteSelection(o.token, quote), NotFoundError, "Menu not found");
    }
  );

  it("is not found when the flag is off, for unknown tokens and invalid ranges", async () => {
    const o = await seeded();
    const quote = {
      localDate: o.today,
      slotKind: "lunch",
      lines: [{ comboId: o.thali.id, addonIds: [], quantity: 1 }],
    };
    vi.stubEnv("TIFFIN_ENABLED", "false");
    expect(await publicWeek(o.token, o.today, 1)).toBeNull();
    await expectReject(quoteSelection(o.token, quote), NotFoundError, "Menu not found");
    vi.stubEnv("TIFFIN_ENABLED", "true");
    for (const token of ["unknown-token", "", "x".repeat(129)]) {
      expect(await publicWeek(token, o.today, 1)).toBeNull();
      await expectReject(quoteSelection(token, quote), NotFoundError, "Menu not found");
    }
    expect(await publicWeek(o.token, o.today, 0)).toBeNull();
    expect(await publicWeek(o.token, o.today, 15)).toBeNull();
    expect(await publicWeek(o.token, o.today, 1.5)).toBeNull();
    expect(await publicWeek(o.token, "2026-02-30", 1)).toBeNull();
    expect(await publicWeek(o.token, addDays(o.today, -2), 1)).toBeNull();
    expect(await publicWeek(o.token, addDays(o.today, 366), 2)).toBeNull();
    expect(await publicWeek(o.token, addDays(o.today, -1), 14)).not.toBeNull();
    expect((await publicWeek(o.token, addDays(o.today, 366), 1))!.days).toHaveLength(1);
  });
});

describe("tiffin public week — outlet-local dates", () => {
  /** Reads one day at a controlled instant through the owner-only clock-injected variant. */
  async function firstDayAt(token: string, instant: string) {
    return admin(async (_db, pool) => {
      const r = await pool.query<{ r: PublicWeek | null }>(
        "select app_private.tiffin_public_week_at($1,null,1,$2::timestamptz) as r",
        [token, instant]
      );
      const week = r.rows[0]!.r!;
      return { ...week.days[0]!, names: lunchNames(week, 0) };
    });
  }
  async function perWeekday(timezone: string) {
    const o = await tiffinOutlet(timezone);
    await saveSlot(o.actor, o.outletId, slot("lunch"));
    for (let weekday = 0; weekday < 7; weekday++) {
      const c = await save(o, plain(`Day ${weekday}`));
      await setWeekMenu(o.actor, o.outletId, { slotKind: "lunch", weekday, comboIds: [c.id] });
    }
    return o;
  }
  const named = (day: Awaited<ReturnType<typeof firstDayAt>>) => day.names;

  it("Europe/London across the 2026-03-29 DST change", async () => {
    const o = await perWeekday("Europe/London");
    // 00:30 UTC on the change day is 00:30 GMT: Sunday 29 March.
    let day = await firstDayAt(o.token, "2026-03-29T00:30:00Z");
    expect([day.localDate, day.weekday, named(day)]).toEqual(["2026-03-29", 0, ["Day 0"]]);
    // 23:30 UTC the previous evening is still Saturday locally.
    day = await firstDayAt(o.token, "2026-03-28T23:30:00Z");
    expect([day.localDate, day.weekday, named(day)]).toEqual(["2026-03-28", 6, ["Day 6"]]);
    // 23:30 UTC on 29 March is 00:30 BST on Monday 30 March (UTC still says Sunday).
    day = await firstDayAt(o.token, "2026-03-29T23:30:00Z");
    expect([day.localDate, day.weekday, named(day)]).toEqual(["2026-03-30", 1, ["Day 1"]]);
  });

  it("America/New_York across the 2026-11-01 DST change", async () => {
    const o = await perWeekday("America/New_York");
    // 03:30 UTC on 1 November is 23:30 EDT on Saturday 31 October.
    let day = await firstDayAt(o.token, "2026-11-01T03:30:00Z");
    expect([day.localDate, day.weekday, named(day)]).toEqual(["2026-10-31", 6, ["Day 6"]]);
    // 04:30 UTC on 2 November is 23:30 EST on Sunday 1 November (UTC already says Monday).
    day = await firstDayAt(o.token, "2026-11-02T04:30:00Z");
    expect([day.localDate, day.weekday, named(day)]).toEqual(["2026-11-01", 0, ["Day 0"]]);
  });

  it("Asia/Kolkata is ahead of UTC", async () => {
    const o = await perWeekday("Asia/Kolkata");
    // 19:00 UTC Saturday 28 March is 00:30 IST on Sunday 29 March.
    const day = await firstDayAt(o.token, "2026-03-28T19:00:00Z");
    expect([day.localDate, day.weekday, named(day)]).toEqual(["2026-03-29", 0, ["Day 0"]]);
  });

  it("bounds the window by the injected outlet-local today", async () => {
    const o = await perWeekday("Europe/London");
    const at = (from: string, days: number) =>
      admin(async (_db, pool) => {
        const r = await pool.query<{ r: PublicWeek | null }>(
          "select app_private.tiffin_public_week_at($1,$2::date,$3,'2026-03-29T00:30:00Z'::timestamptz) as r",
          [o.token, from, days]
        );
        return r.rows[0]!.r;
      });
    expect(await at("2026-03-28", 1)).not.toBeNull();
    expect(await at("2026-03-27", 1)).toBeNull();
    expect(await at("2027-03-30", 1)).not.toBeNull();
    expect(await at("2027-03-31", 1)).toBeNull();
  });
});

describe("tiffin quote", () => {
  async function quoteSetup() {
    const o = await seeded();
    const date = addDays(o.today, 1);
    return { ...o, date, roti: o.thali.addons[0]!.id };
  }

  it("returns the worked totals as decimal strings", async () => {
    const o = await quoteSetup();
    const q = await quoteSelection(o.token, {
      localDate: o.date,
      slotKind: "lunch",
      lines: [{ comboId: o.thali.id, addonIds: [o.roti], quantity: 3 }],
    });
    expect(q).toEqual({
      outletId: o.outletId,
      currency: "INR",
      localDate: o.date,
      slotKind: "lunch",
      lines: [
        {
          comboId: o.thali.id,
          name: "Veg Thali",
          unitMinor: "13000",
          addons: [{ id: o.roti, label: "Extra roti", priceMinor: "1000" }],
          quantity: 3,
          lineMinor: "39000",
        },
      ],
      totalMinor: "39000",
    });
    expect(JSON.parse(JSON.stringify(q))).toEqual(q);
    const two = await quoteSelection(o.token, {
      localDate: o.date,
      slotKind: "lunch",
      lines: [
        { comboId: o.thali.id, addonIds: [o.roti], quantity: 3 },
        { comboId: o.snack.id, addonIds: [], quantity: 1 },
      ],
    });
    expect(two.lines.map((l) => l.lineMinor)).toEqual(["39000", "8000"]);
    expect(two.totalMinor).toBe("47000");
  });

  it("uses the live price: raising a combo price changes the next quote", async () => {
    const o = await quoteSetup();
    const input = {
      localDate: o.date,
      slotKind: "lunch",
      lines: [{ comboId: o.thali.id, addonIds: [o.roti], quantity: 3 }],
    };
    expect((await quoteSelection(o.token, input)).totalMinor).toBe("39000");
    const updated = await save(o, { ...thali, id: o.thali.id, priceMinor: 15000 });
    const q = await quoteSelection(o.token, {
      ...input,
      lines: [{ comboId: o.thali.id, addonIds: [updated.addons[0]!.id], quantity: 3 }],
    });
    expect(q.lines[0]!.unitMinor).toBe("16000");
    expect(q.totalMinor).toBe("48000");
  });

  it("rejects selections that are not offered or invalid", async () => {
    const o = await quoteSetup();
    const offSchedule = await save(o, plain("Not On Menu"));
    const other = await tiffinOutlet();
    const otherCombo = await save(other, plain("Elsewhere"));
    const line = (extra: Record<string, unknown> = {}) => ({
      comboId: o.thali.id,
      addonIds: [] as string[],
      quantity: 1,
      ...extra,
    });
    const q = (lines: unknown[], extra: Record<string, unknown> = {}) =>
      quoteSelection(o.token, { localDate: o.date, slotKind: "lunch", lines, ...extra });
    const notOffered = "This combo is not offered for the chosen date and meal";

    await expectReject(q([line({ comboId: offSchedule.id })]), ValidationError, notOffered);
    await expectReject(q([line({ comboId: otherCombo.id })]), ValidationError, notOffered);
    await expectReject(q([line()], { slotKind: "dinner" }), ValidationError, notOffered);
    await expectReject(
      q([line({ addonIds: [o.snack.id] })]),
      ValidationError,
      "An add-on is not available for this combo"
    );
    await expectReject(
      q([line({ addonIds: [otherCombo.addons[0]!.id] })]),
      ValidationError,
      "An add-on is not available for this combo"
    );
    await expectReject(
      q([line({ addonIds: [o.roti, o.roti] })]),
      ValidationError,
      "Each add-on can only be chosen once per item"
    );
    for (const quantity of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 2, "2"])
      await expectReject(
        q([line({ quantity })]),
        ValidationError,
        "Quantity must be a whole number of at least 1"
      );
    await expectReject(
      q(Array.from({ length: 101 }, () => line())),
      ValidationError,
      "Choose between 1 and 100 items"
    );
    await expectReject(q([]), ValidationError, "Choose between 1 and 100 items");
    await expectReject(q([line({ priceMinor: 1 })]), ValidationError, "Invalid quote request");
    await expectReject(q([line()], { currency: "USD" }), ValidationError, "Invalid quote request");
    await expectReject(
      q([line()], { localDate: "2026-02-30" }),
      ValidationError,
      "Invalid quote request"
    );

    // A closed day and an archived combo are no longer offered.
    await setOverride(o.actor, o.outletId, {
      slotKind: "lunch",
      localDate: o.date,
      closed: true,
      comboIds: [],
    });
    await expectReject(q([line()]), ValidationError, notOffered);
    const nextDay = addDays(o.date, 1);
    await setComboArchived(o.actor, o.outletId, { id: o.thali.id, archived: true });
    await expectReject(q([line()], { localDate: nextDay }), ValidationError, notOffered);
    // A date outside the outlet window is not offered either (the token stays valid).
    await expectReject(
      q([line({ comboId: o.snack.id })], { localDate: addDays(o.today, 400) }),
      ValidationError,
      notOffered
    );
    expect((await q([line({ comboId: o.snack.id })], { localDate: nextDay })).totalMinor).toBe(
      "8000"
    );
  });
});

describe("tiffin authoring service", () => {
  it("rejects every authoring call with NotFoundError when the flag is off", async () => {
    const o = await tiffinOutlet();
    vi.stubEnv("TIFFIN_ENABLED", "false");
    const calls = [
      () => readTiffinMenu(o.actor, o.outletId),
      () => saveSlot(o.actor, o.outletId, slot("lunch")),
      () => saveCombo(o.actor, o.outletId, thali),
      () => setComboArchived(o.actor, o.outletId, { id: "x", archived: true }),
      () => setWeekMenu(o.actor, o.outletId, { slotKind: "lunch", weekday: 1, comboIds: [] }),
      () =>
        setOverride(o.actor, o.outletId, {
          slotKind: "lunch",
          localDate: "2026-12-01",
          closed: true,
          comboIds: [],
        }),
      () =>
        clearOverride(o.actor, o.outletId, {
          slotKind: "lunch",
          localDate: "2026-12-01",
          clear: true,
        }),
    ];
    for (const call of calls) await expectReject(call(), NotFoundError, "Menu not found");
    vi.unstubAllEnvs();
    await expectReject(readTiffinMenu(o.actor, o.outletId), NotFoundError);
  });

  it("reads back the authored menu", async () => {
    const o = await seeded();
    const archived = await save(o, plain("Old Combo"));
    await setComboArchived(o.actor, o.outletId, { id: archived.id, archived: true });
    const menu = await readTiffinMenu(o.actor, o.outletId);
    expect(menu.outlet).toMatchObject({ id: o.outletId, currency: "INR", today: o.today });
    expect(menu.slots.map((s) => s.kind)).toEqual(["lunch", "dinner"]);
    expect(menu.combos.map((c) => c.name)).toEqual(["Veg Thali", "Snack Box"]);
    expect(menu.archivedCombos.map((c) => c.name)).toEqual(["Old Combo"]);
    expect(menu.week).toHaveLength(7);
    expect(menu.week[0]).toEqual({
      slotKind: "lunch",
      weekday: 0,
      comboIds: [o.snack.id, o.thali.id],
    });
  });

  it("denies service staff writes (reads allowed) and foreign-organization actors", async () => {
    const o = await seeded();
    const service = await addMember(o.org, o.outletId, ["service"]);
    expect((await readTiffinMenu(service, o.outletId)).combos).toHaveLength(2);
    const writes = (actor: Actor) => [
      () => saveSlot(actor, o.outletId, slot("lunch")),
      () => saveCombo(actor, o.outletId, plain("Staff combo")),
      () => setComboArchived(actor, o.outletId, { id: o.thali.id, archived: true }),
      () => setWeekMenu(actor, o.outletId, { slotKind: "lunch", weekday: 1, comboIds: [] }),
      () =>
        setOverride(actor, o.outletId, {
          slotKind: "lunch",
          localDate: addDays(o.today, 1),
          closed: true,
          comboIds: [],
        }),
      () =>
        clearOverride(actor, o.outletId, {
          slotKind: "lunch",
          localDate: addDays(o.today, 1),
          clear: true,
        }),
    ];
    for (const w of writes(service)) await expectReject(w(), ForbiddenError);
    const foreign = await tiffinOutlet();
    await expectReject(readTiffinMenu(foreign.actor, o.outletId), ForbiddenError);
    for (const w of writes(foreign.actor)) await expectReject(w(), ForbiddenError);
    expect((await readTiffinMenu(o.actor, o.outletId)).combos).toHaveLength(2);
  });

  it("maps SQL rejections to safe application errors", async () => {
    const o = await tiffinOutlet();
    // 22023 with the function's safe message.
    await expectReject(
      setWeekMenu(o.actor, o.outletId, { slotKind: "lunch", weekday: 1, comboIds: [] }),
      ValidationError,
      "Slot not configured"
    );
    await saveSlot(o.actor, o.outletId, slot("lunch"));
    await expectReject(
      setWeekMenu(o.actor, o.outletId, { slotKind: "lunch", weekday: 1, comboIds: ["nope"] }),
      ValidationError,
      "Combo not allowed"
    );
    // 42501: the owner passes the outlet gate, but the outlet is not tiffin.
    await admin(async (_db, pool) => {
      await pool.query("update restaurants set outlet_type='restaurant' where id=$1", [o.outletId]);
    });
    await expectReject(saveCombo(o.actor, o.outletId, thali), ForbiddenError);
    await expectReject(readTiffinMenu(o.actor, o.outletId), ForbiddenError);
    await admin(async (_db, pool) => {
      await pool.query("update restaurants set outlet_type='tiffin' where id=$1", [o.outletId]);
      // 54000: fill the 200 combo cap directly.
      await pool.query(
        `insert into tiffin_combos(organization_id,outlet_id,name,price_minor,currency)
         select $1,$2,'Bulk '||g,100,'INR' from generate_series(1,200) g`,
        [o.org, o.outletId]
      );
    });
    await expectReject(
      saveCombo(o.actor, o.outletId, thali),
      ValidationError,
      "You have reached the combo limit"
    );
    // Zod runs before SQL and is strict: a client currency is refused.
    await expectReject(
      saveCombo(o.actor, o.outletId, { ...thali, currency: "USD" }),
      ValidationError
    );
    await expectReject(
      saveSlot(o.actor, o.outletId, slot("lunch", { endMinute: 700 })),
      ValidationError
    );
  });

  it("mapTiffinError never leaks database detail", () => {
    const map = (e: unknown) => {
      try {
        mapTiffinError(e);
      } catch (err) {
        return err as AppError;
      }
      throw new Error("mapTiffinError returned");
    };
    const wrapped = (cause: object) =>
      Object.assign(new Error("Failed query: select app_private.secret_fn($1)"), { cause });
    expect(map({ code: "40P01", message: "deadlock detected" })).toBeInstanceOf(ConflictError);
    expect(map(wrapped({ code: "40001", message: "could not serialize" }))).toBeInstanceOf(
      ConflictError
    );
    expect(map(wrapped({ code: "54000", message: "Combo limit reached" })).message).toBe(
      "You have reached the combo limit"
    );
    expect(map(wrapped({ code: "22023", message: "Invalid override" })).message).toBe(
      "Invalid override"
    );
    const unknown22023 = map(wrapped({ code: "22023", message: 'time zone "x" not recognized' }));
    expect(unknown22023).toBeInstanceOf(ValidationError);
    expect(unknown22023.message).toBe("Invalid tiffin menu change");
    expect(
      map(wrapped({ code: "42501", message: "permission denied for table x" }))
    ).toBeInstanceOf(ForbiddenError);
    const other = map(wrapped({ code: "XX000", message: "internal: relation secret" }));
    expect(other).toBeInstanceOf(AppError);
    expect(other.message).toBe("The tiffin menu request failed");
    expect(other.message).not.toContain("secret");
    const passthrough = new ValidationError("kept");
    expect(map(passthrough)).toBe(passthrough);
  });
});

describe("tiffin public functions (0116) grants", () => {
  it("are executable by menuminute_app only and are stable definer functions", async () => {
    const o = await seeded();
    const r = await app.query<{ w: PublicWeek; o: { combos: unknown[] } }>(
      "select app_private.tiffin_public_week($1,null,7) as w, app_private.tiffin_public_offer($1,$2::date,'lunch') as o",
      [o.token, o.today]
    );
    expect(r.rows[0]!.w.days).toHaveLength(7);
    expect(r.rows[0]!.o.combos).toHaveLength(2);
    for (const statement of [
      "select app_private.tiffin_public_week($1,null,7)",
      "select app_private.tiffin_public_offer($1,current_date,'lunch')",
    ])
      await expect(worker.query(statement, [o.token])).rejects.toMatchObject({ code: "42501" });
    for (const statement of [
      "select app_private.tiffin_public_week_at($1,null,7,now())",
      "select app_private.tiffin_public_offer_at($1,current_date,'lunch',now())",
    ])
      await expect(app.query(statement, [o.token])).rejects.toMatchObject({ code: "42501" });
    const procs = await admin(
      async (_db, pool) =>
        (
          await pool.query<{
            proname: string;
            prosecdef: boolean;
            provolatile: string;
            proconfig: string[];
          }>(
            `select proname,prosecdef,provolatile,proconfig from pg_proc
           where pronamespace='app_private'::regnamespace and proname like 'tiffin_public_%' order by proname`
          )
        ).rows
    );
    expect(procs.map((p) => p.proname)).toEqual([
      "tiffin_public_combo",
      "tiffin_public_offer",
      "tiffin_public_offer_at",
      "tiffin_public_slot_day",
      "tiffin_public_week",
      "tiffin_public_week_at",
    ]);
    for (const p of procs) {
      expect(p.provolatile).toBe("s");
      expect(p.proconfig).toEqual(["search_path=pg_catalog, public, pg_temp"]);
    }
    expect(procs.filter((p) => p.prosecdef).map((p) => p.proname)).toEqual([
      "tiffin_public_offer",
      "tiffin_public_offer_at",
      "tiffin_public_week",
      "tiffin_public_week_at",
    ]);
  });
});
