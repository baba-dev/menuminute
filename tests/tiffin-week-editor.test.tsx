// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { OverridesEditor } from "../src/app/(dashboard)/dashboard/tiffin/week/overrides-editor";
import { WeekEditor } from "../src/app/(dashboard)/dashboard/tiffin/week/week-editor";
import type { SlotView } from "../src/app/(dashboard)/dashboard/tiffin/week/week-form";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const combos = [
  { id: "c1", name: "Home thali" },
  { id: "c2", name: "Light lunch" },
  { id: "c3", name: "Sunday feast" },
];
const archived = [{ id: "cx", name: "Old thali", archived: true }];
const slots: SlotView[] = [
  {
    kind: "lunch",
    startMinute: 720,
    endMinute: 840,
    cutoffMinutesBefore: 90,
    capacity: 40,
    enabled: true,
  },
];

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
const reply = (status: number, body: unknown) =>
  fetchMock.mockResolvedValueOnce({ ok: status < 400, status, json: async () => body });
const lastBody = () => JSON.parse(fetchMock.mock.calls.at(-1)![1].body);

const week = (over: Partial<React.ComponentProps<typeof WeekEditor>> = {}) =>
  render(
    <WeekEditor
      outletId="out 1"
      timezone="Asia/Kolkata"
      combos={combos}
      archivedCombos={archived}
      slots={slots}
      week={[{ slotKind: "lunch", weekday: 1, comboIds: ["c1"] }]}
      {...over}
    />
  );

function addTo(label: string, comboName: string) {
  fireEvent.change(screen.getByLabelText(`Add a combo to ${label}`), {
    target: { value: combos.find((c) => c.name === comboName)!.id },
  });
  fireEvent.click(screen.getByRole("button", { name: `Add selected combo to ${label}` }));
}

describe("WeekEditor grid", () => {
  it("renders a real table with scoped headers for seven days and two meals", () => {
    week();
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader")).toHaveLength(3);
    expect(within(table).getAllByRole("rowheader")).toHaveLength(7);
    expect(screen.getByText("Monday")).toBeTruthy();
  });

  it("adds a combo to Monday lunch and PUTs weekday 1 with the full ordered ids", async () => {
    week();
    reply(200, { slotKind: "lunch", weekday: 1, comboIds: ["c1", "c2"] });
    addTo("Monday lunch", "Light lunch");
    fireEvent.click(screen.getByRole("button", { name: "Save Monday lunch" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/tiffin/out%201/menu");
    expect(fetchMock.mock.calls[0]![1].method).toBe("PUT");
    expect(lastBody()).toEqual({
      kind: "week",
      week: { slotKind: "lunch", weekday: 1, comboIds: ["c1", "c2"] },
    });
    await waitFor(() =>
      expect(screen.getAllByText("Saved Monday lunch.").length).toBeGreaterThan(0)
    );
  });

  it("does not offer archived combos or ones already in the cell", () => {
    week();
    const select = screen.getByLabelText("Add a combo to Monday lunch") as HTMLSelectElement;
    const names = Array.from(select.options).map((o) => o.textContent);
    expect(names).toContain("Light lunch");
    expect(names).not.toContain("Old thali");
    expect(names).not.toContain("Home thali");
  });

  it("moves up and down and sends the new order", async () => {
    week({ week: [{ slotKind: "dinner", weekday: 0, comboIds: ["c1", "c2", "c3"] }] });
    fireEvent.click(screen.getByRole("button", { name: "Move Sunday feast up in Sunday dinner" }));
    fireEvent.click(screen.getByRole("button", { name: "Move Home thali down in Sunday dinner" }));
    expect(
      (
        screen.getByRole("button", {
          name: "Move Home thali up in Sunday dinner",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(false);
    reply(200, {});
    fireEvent.click(screen.getByRole("button", { name: "Save Sunday dinner" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(lastBody().week).toEqual({
      slotKind: "dinner",
      weekday: 0,
      comboIds: ["c3", "c1", "c2"],
    });
  });

  it("disables move at the boundaries", () => {
    week({ week: [{ slotKind: "dinner", weekday: 0, comboIds: ["c1", "c2"] }] });
    expect(
      (
        screen.getByRole("button", {
          name: "Move Home thali up in Sunday dinner",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Move Light lunch down in Sunday dinner",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
  });

  it("removes a combo and sends an empty list", async () => {
    week();
    fireEvent.click(screen.getByRole("button", { name: "Remove Home thali from Monday lunch" }));
    reply(200, {});
    fireEvent.click(screen.getByRole("button", { name: "Save Monday lunch" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(lastBody().week.comboIds).toEqual([]);
  });

  it("blocks a double submit while saving and disables the cell", async () => {
    week();
    let release: (v: unknown) => void = () => {};
    fetchMock.mockReturnValueOnce(new Promise((r) => (release = r)));
    addTo("Monday lunch", "Light lunch");
    const save = screen.getByRole("button", { name: "Save Monday lunch" });
    fireEvent.click(save);
    fireEvent.click(save);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      (screen.getByRole("button", { name: "Save Monday lunch" }) as HTMLButtonElement).disabled
    ).toBe(true);
    expect(
      (screen.getByLabelText("Add a combo to Monday lunch") as HTMLSelectElement).disabled
    ).toBe(true);
    release({ ok: true, status: 200, json: async () => ({}) });
    await waitFor(() =>
      expect(screen.getAllByText("Saved Monday lunch.").length).toBeGreaterThan(0)
    );
  });

  it("shows a server message inline with aria wiring and keeps the draft", async () => {
    week();
    reply(422, { message: "Invalid combo" });
    addTo("Monday lunch", "Light lunch");
    fireEvent.click(screen.getByRole("button", { name: "Save Monday lunch" }));
    const alert = await screen.findByText("Invalid combo");
    expect(alert.getAttribute("role")).toBe("alert");
    expect(
      screen.getByLabelText("Add a combo to Monday lunch").getAttribute("aria-describedby")
    ).toBe(alert.id);
    expect(screen.getByText("2. Light lunch")).toBeTruthy();
  });

  it("shows the create-combos-first empty state with a link", () => {
    week({ combos: [] });
    expect(screen.getByText("Create combos first")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Go to combos" }).getAttribute("href")).toBe(
      "/dashboard/tiffin/combos"
    );
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("slot settings", () => {
  it("sends stored cutoff and capacity unchanged and shows them read-only", async () => {
    week();
    expect(screen.getAllByText(/Used when booking opens \(a later step\)/).length).toBeGreaterThan(
      0
    );
    expect(screen.queryByLabelText(/cutoff/i)).toBeNull();
    fireEvent.change(screen.getByLabelText("Lunch start time"), { target: { value: "11:00" } });
    fireEvent.click(screen.getByLabelText("Lunch is on the menu"));
    reply(200, { ...slots[0], startMinute: 660, enabled: false });
    fireEvent.click(screen.getByRole("button", { name: "Save lunch settings" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(lastBody()).toEqual({
      kind: "slot",
      slot: {
        kind: "lunch",
        startMinute: 660,
        endMinute: 840,
        cutoffMinutesBefore: 90,
        capacity: 40,
        enabled: false,
      },
    });
  });

  it("rejects an end time that is not after the start without calling the server", () => {
    week();
    fireEvent.change(screen.getByLabelText("Lunch end time"), { target: { value: "11:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Save lunch settings" }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/after the start/);
    expect(screen.getByLabelText("Lunch end time").getAttribute("aria-invalid")).toBe("true");
  });

  it("sends defaults for a slot that was never saved", async () => {
    week({ slots: [] });
    reply(200, {});
    fireEvent.click(screen.getByRole("button", { name: "Save dinner settings" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(lastBody().slot).toEqual({
      kind: "dinner",
      startMinute: 1140,
      endMinute: 1320,
      cutoffMinutesBefore: 60,
      capacity: null,
      enabled: true,
    });
  });
});

describe("OverridesEditor", () => {
  const overrides = (over: Partial<React.ComponentProps<typeof OverridesEditor>> = {}) =>
    render(
      <OverridesEditor
        outletId="out 1"
        timezone="Europe/London"
        today="2026-03-30"
        combos={combos}
        archivedCombos={archived}
        overrides={[]}
        {...over}
      />
    );
  const pickDate = (value: string) =>
    fireEvent.change(screen.getByLabelText("Date"), { target: { value } });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-03-29T23:30:00Z")); // 2026-03-30 in London
  });

  it("shows the empty state", () => {
    overrides();
    expect(screen.getByText("No special dates yet")).toBeTruthy();
  });

  it("closes a day", async () => {
    overrides();
    pickDate("2026-04-01");
    reply(200, {});
    fireEvent.click(screen.getByRole("button", { name: "Save special date" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(lastBody()).toEqual({
      kind: "override",
      override: { slotKind: "lunch", localDate: "2026-04-01", closed: true, comboIds: [] },
    });
    expect(
      await screen.findByRole("button", { name: /Clear special date for lunch/ })
    ).toBeTruthy();
  });

  it("replaces the menu with chosen combos", async () => {
    overrides();
    pickDate("2026-04-02");
    fireEvent.change(screen.getByLabelText("Meal"), { target: { value: "dinner" } });
    fireEvent.click(screen.getByLabelText("Replace menu for this day"));
    fireEvent.change(screen.getByLabelText("Add a combo to this special date"), {
      target: { value: "c3" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Add selected combo to this special date" })
    );
    reply(200, {});
    fireEvent.click(screen.getByRole("button", { name: "Save special date" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(lastBody().override).toEqual({
      slotKind: "dinner",
      localDate: "2026-04-02",
      closed: false,
      comboIds: ["c3"],
    });
  });

  it("requires a combo when replacing", () => {
    overrides();
    pickDate("2026-04-02");
    fireEvent.click(screen.getByLabelText("Replace menu for this day"));
    fireEvent.click(screen.getByRole("button", { name: "Save special date" }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/at least one combo/);
  });

  it("rejects dates outside the outlet-local window before calling the server", () => {
    overrides();
    pickDate("2026-03-29"); // UTC today, but yesterday in London terms is not selectable either
    fireEvent.click(screen.getByRole("button", { name: "Save special date" }));
    expect(fetchMock).not.toHaveBeenCalled();
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/Past dates/);
    expect(screen.getByLabelText("Date").getAttribute("aria-describedby")).toBe(alert.id);
    expect(screen.getByLabelText("Date").getAttribute("aria-invalid")).toBe("true");
    pickDate("2027-04-01");
    fireEvent.click(screen.getByRole("button", { name: "Save special date" }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/within 366 days/);
  });

  it("accepts the outlet-local today even when UTC is still the previous day", async () => {
    overrides();
    pickDate("2026-03-30");
    reply(200, {});
    fireEvent.click(screen.getByRole("button", { name: "Save special date" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });

  it("lists existing overrides and clears one", async () => {
    overrides({
      overrides: [
        { slotKind: "lunch", localDate: "2026-04-01", closed: true, comboIds: [] },
        { slotKind: "dinner", localDate: "2026-04-03", closed: false, comboIds: ["c2", "cx"] },
      ],
    });
    expect(screen.getByText("Light lunch, Old thali")).toBeTruthy();
    expect(screen.getByText("Closed")).toBeTruthy();
    reply(200, { cleared: true });
    fireEvent.click(screen.getByRole("button", { name: /Clear special date for lunch on/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(lastBody()).toEqual({
      kind: "overrideClear",
      override: { slotKind: "lunch", localDate: "2026-04-01", clear: true },
    });
    await waitFor(() => expect(screen.queryByText("Closed")).toBeNull());
  });

  it("renders a server error for a failed clear inline", async () => {
    overrides({
      overrides: [{ slotKind: "lunch", localDate: "2026-04-01", closed: true, comboIds: [] }],
    });
    reply(422, { message: "Date is outside the allowed window" });
    fireEvent.click(screen.getByRole("button", { name: /Clear special date/ }));
    const alert = await screen.findByText("Date is outside the allowed window");
    expect(alert.getAttribute("role")).toBe("alert");
  });

  it("shows a server validation message for a save", async () => {
    overrides();
    pickDate("2026-04-01");
    reply(422, { message: "Invalid override" });
    fireEvent.click(screen.getByRole("button", { name: "Save special date" }));
    expect((await screen.findByText("Invalid override")).getAttribute("role")).toBe("alert");
  });
});
