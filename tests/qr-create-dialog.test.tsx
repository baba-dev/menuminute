// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QrCreateDialog } from "../src/components/menu-product/qr-create-dialog";
import type { QR } from "../src/components/menu-product/qr-studio-types";

afterEach(cleanup);

const created: QR = {
  id: "created", label: "Counter Menu", destinationToken: "stable-created",
  isActive: true, tableId: null, pointLabel: null,
};

function dialog(overrides: Partial<React.ComponentProps<typeof QrCreateDialog>> = {}) {
  const onCreate = vi.fn();
  const onPrint = vi.fn();
  const onLibrary = vi.fn();
  const props: React.ComponentProps<typeof QrCreateDialog> = {
    open: true, onOpenChange: vi.fn(), outletName: "Baba Bakery",
    origin: "http://localhost:3000", busy: false, error: "",
    created: null, existingLabels: ["Main Menu QR"], onCreate,
    onReset: vi.fn(), onLibrary, onPrint, ...overrides,
  };
  return { ...render(<QrCreateDialog {...props} />), onCreate, onPrint, onLibrary };
}

describe("Connection Atelier", () => {
  it("uses a two-step review before issuing a creation command", () => {
    const { onCreate } = dialog();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Create QR code/i })).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: /QR label/i }), { target: { value: "Counter Menu" } });
    fireEvent.click(screen.getByRole("button", { name: /Review QR/i }));
    expect(onCreate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Create QR code/i }));
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith("Counter Menu", undefined);
  });
  it("requires a service point label for table / counter mode", () => {
    const { onCreate } = dialog();
    fireEvent.click(screen.getByRole("button", { name: /Table or counter/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /QR label/i }), { target: { value: "Counter" } });
    expect((screen.getByRole("button", { name: /Review QR/i }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByRole("textbox", { name: /Table \/ counter label/i }), { target: { value: "Table 8" } });
    fireEvent.click(screen.getByRole("button", { name: /Review QR/i }));
    fireEvent.click(screen.getByRole("button", { name: /Create QR code/i }));
    expect(onCreate).toHaveBeenCalledWith("Counter", "Table 8");
  });
  it("shows the confirmed matrix and routes to library or printing", () => {
    const { onPrint, onLibrary } = dialog({ created });
    expect(screen.getByAltText("Authenticated newly created QR code")).toBeTruthy();
    expect(screen.getByText("http://localhost:3000/m/stable-created")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /View in library/i }));
    fireEvent.click(screen.getByRole("button", { name: /Design & Print/i }));
    expect(onLibrary).toHaveBeenCalledOnce();
    expect(onPrint).toHaveBeenCalledOnce();
  });
});
