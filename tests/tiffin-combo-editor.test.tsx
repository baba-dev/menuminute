// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ComboEditor } from "../src/app/(dashboard)/dashboard/tiffin/combos/combo-editor";
import {
  buildComboPayload,
  formatMinor,
  minorToInput,
  parsePrice,
  summarizeItems,
  type ComboView,
} from "../src/app/(dashboard)/dashboard/tiffin/combos/combo-form";

afterEach(cleanup);

const thali: ComboView = {
  id: "c1",
  name: "Home thali",
  description: "",
  priceMinor: 12000,
  currency: "INR",
  archived: false,
  items: [
    { id: "i1", label: "Dal", quantity: 1 },
    { id: "i2", label: "Roti", quantity: 3 },
  ],
  addons: [{ id: "a1", label: "Raita", priceMinor: 2500 }],
};
const old: ComboView = { ...thali, id: "c2", name: "Old thali", archived: true };

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
const reply = (status: number, body: unknown) =>
  fetchMock.mockResolvedValueOnce({ ok: status < 400, status, json: async () => body });
const lastBody = () => JSON.parse(fetchMock.mock.calls.at(-1)![1].body);
const mount = (over: Partial<React.ComponentProps<typeof ComboEditor>> = {}) =>
  render(<ComboEditor outletId="out 1" currency="INR" combos={[]} archivedCombos={[]} {...over} />);
const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("combo form helpers (integer minor units, no floats)", () => {
  it("parses by currency exponent", () => {
    expect(parsePrice("120.00", "INR")).toEqual({ ok: true, minor: 12000 });
    expect(parsePrice("1.250", "OMR")).toEqual({ ok: true, minor: 1250 });
    expect(parsePrice("500", "JPY")).toEqual({ ok: true, minor: 500 });
    expect(parsePrice("1.005", "INR").ok).toBe(false);
    expect(parsePrice("-1", "INR").ok).toBe(false);
    expect(parsePrice("", "INR").ok).toBe(false);
    expect(parsePrice("99999999999", "INR").ok).toBe(false);
  });
  it("round-trips and formats", () => {
    expect(minorToInput(12050, "INR")).toBe("120.50");
    expect(minorToInput(5, "INR")).toBe("0.05");
    expect(minorToInput(1250, "OMR")).toBe("1.250");
    expect(formatMinor(12000, "INR")).toBe("₹120.00");
    expect(summarizeItems(thali.items)).toBe("Dal x1, Roti x3");
  });
  it("builds the exact save body", () => {
    const built = buildComboPayload(
      {
        name: " Thali ",
        description: "",
        price: "120.00",
        items: [{ key: "a", label: "Dal", quantity: "2" }],
        addons: [{ key: "b", label: "Raita", price: "25" }],
      },
      "INR",
      "c1"
    );
    expect(built).toEqual({
      ok: true,
      payload: {
        id: "c1",
        name: "Thali",
        description: "",
        priceMinor: 12000,
        items: [{ label: "Dal", quantity: 2 }],
        addons: [{ label: "Raita", priceMinor: 2500 }],
      },
    });
  });
});

describe("combo editor", () => {
  it("shows the empty state with a create action", () => {
    mount();
    expect(screen.getByRole("heading", { name: "No combos yet" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create a combo" })).toBeTruthy();
  });

  it("lists combos with price, items and add-ons, and archived ones in a disclosure", () => {
    mount({ combos: [thali], archivedCombos: [old] });
    expect(screen.getByText("Home thali")).toBeTruthy();
    expect(screen.getAllByText("₹120.00").length).toBe(2);
    expect(screen.getAllByText(/Dal x1, Roti x3/).length).toBe(2);
    expect(screen.getAllByText(/Raita \(₹25.00\)/).length).toBe(2);
    expect(screen.getByText("Archived (1)")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "No combos yet" })).toBeNull();
  });

  it("creates a combo with priceMinor from an INR display price", async () => {
    reply(200, { ...thali, id: "new", name: "Lunch" });
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Create a combo" }));
    type("Combo name", "Lunch");
    type(/^Price/, "120.00");
    type("Item 1 name", "Dal");
    fireEvent.click(screen.getByRole("button", { name: "Add an add-on" }));
    type("Add-on 1 name", "Raita");
    type(/^Add-on 1 price/, "25");
    fireEvent.click(screen.getByRole("button", { name: "Save combo" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/tiffin/out%201/combos");
    expect(fetchMock.mock.calls[0]![1].method).toBe("POST");
    expect(lastBody()).toEqual({
      name: "Lunch",
      description: "",
      priceMinor: 12000,
      items: [{ label: "Dal", quantity: 1 }],
      addons: [{ label: "Raita", priceMinor: 2500 }],
    });
    await screen.findByText("Saved “Lunch”.");
  });

  it("sends 1250 for an OMR price of 1.250 and never a currency", async () => {
    reply(200, { ...thali, id: "n", currency: "OMR", priceMinor: 1250 });
    mount({ currency: "OMR" });
    fireEvent.click(screen.getByRole("button", { name: "Create a combo" }));
    type("Combo name", "Lunch");
    type(/^Price/, "1.250");
    type("Item 1 name", "Dal");
    fireEvent.click(screen.getByRole("button", { name: "Save combo" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(lastBody().priceMinor).toBe(1250);
    expect(lastBody()).not.toHaveProperty("currency");
  });

  it("blocks an invalid form locally and wires errors with aria-describedby", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Create a combo" }));
    fireEvent.click(screen.getByRole("button", { name: "Save combo" }));
    expect(fetchMock).not.toHaveBeenCalled();
    const name = screen.getByLabelText("Combo name");
    expect(name.getAttribute("aria-invalid")).toBe("true");
    const errorId = name.getAttribute("aria-describedby")!;
    expect(document.getElementById(errorId)!.getAttribute("role")).toBe("alert");
    expect(document.getElementById(errorId)!.textContent).toMatch(/Enter a combo name/);
  });

  it("renders server validation and combo-limit messages", async () => {
    reply(422, {
      message: "Invalid tiffin menu change",
      fields: { "items.0.label": ["String must contain at most 80 character(s)"] },
    });
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Create a combo" }));
    type("Combo name", "Lunch");
    type(/^Price/, "10");
    type("Item 1 name", "Dal");
    fireEvent.click(screen.getByRole("button", { name: "Save combo" }));
    const field = await screen.findByText(/at most 80 character/);
    expect(screen.getByLabelText("Item 1 name").getAttribute("aria-describedby")).toBe(field.id);
    expect(screen.getByText("Invalid tiffin menu change")).toBeTruthy();

    reply(422, { message: "You have reached the combo limit" });
    fireEvent.click(screen.getByRole("button", { name: "Save combo" }));
    await screen.findByText("You have reached the combo limit");
  });

  it("disables submit while saving and prevents a double submit", async () => {
    let resolve!: (value: unknown) => void;
    fetchMock.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Create a combo" }));
    type("Combo name", "Lunch");
    type(/^Price/, "10");
    type("Item 1 name", "Dal");
    const submit = screen.getByRole("button", { name: "Save combo" });
    fireEvent.click(submit);
    const saving = await screen.findByRole("button", { name: "Saving…" });
    expect((saving as HTMLButtonElement).disabled).toBe(true);
    fireEvent.submit(saving.closest("form")!);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolve({ ok: true, status: 200, json: async () => ({ ...thali, id: "z" }) });
    await screen.findByText(/Saved/);
  });

  it("adds and removes item rows, keeping at least one", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Create a combo" }));
    fireEvent.click(screen.getByRole("button", { name: "Add item" }));
    expect(screen.getByLabelText("Item 2 name")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove item 2" }));
    expect(screen.queryByLabelText("Item 2 name")).toBeNull();
    expect(
      (screen.getByRole("button", { name: "Remove item 1" }) as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it("archives with PATCH and moves the combo under Archived", async () => {
    reply(200, { ...thali, archived: true });
    mount({ combos: [thali] });
    fireEvent.click(screen.getByRole("button", { name: "Archive Home thali" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0]![1].method).toBe("PATCH");
    expect(lastBody()).toEqual({ id: "c1", archived: true });
    await screen.findByText("Archived (1)");
  });

  it("restores with PATCH and explains a repricing refusal", async () => {
    reply(422, { message: "Explicit repricing required" });
    mount({ archivedCombos: [old] });
    fireEvent.click(screen.getByRole("button", { name: "Restore Old thali" }));
    const alert = await screen.findByText(/Explicit repricing required/);
    expect(lastBody()).toEqual({ id: "c2", archived: false });
    expect(alert.textContent).toMatch(/save it with a price in INR, then restore/);
    expect(
      screen.getByRole("button", { name: "Restore Old thali" }).getAttribute("aria-describedby")
    ).toBe(alert.id);

    reply(200, { ...old, archived: false });
    fireEvent.click(screen.getByRole("button", { name: "Restore Old thali" }));
    await screen.findByText("Restored “Old thali”.");
  });
});
