// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReceiptPaymentSettingsForm } from "../src/components/settings/receipt-payment-settings-form";
import type { ReceiptPaymentProfile } from "../src/modules/receipt-payment/service";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const empty: ReceiptPaymentProfile = {
  configured: false,
  upiId: null,
  payeeName: null,
  enabled: false,
  revision: 0,
  updatedAt: null,
};
const props = {
  organizationId: "org-1",
  outletId: "out-1",
  outletName: "Spice Route Kitchen",
  currency: "INR",
  initial: empty,
  canManage: true,
};
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  fetchMock.mockReset();
});

const typeUpi = (value: string) =>
  fireEvent.change(screen.getByLabelText("UPI ID"), { target: { value } });

describe("ReceiptPaymentSettingsForm", () => {
  it("starts unconfigured with Save disabled and no preview", () => {
    render(<ReceiptPaymentSettingsForm {...props} />);
    expect(screen.getByLabelText("UPI ID")).toHaveValue("");
    expect(screen.getByLabelText("Payee name")).toHaveValue("Spice Route Kitchen");
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("flags an invalid UPI ID and keeps Save disabled", () => {
    render(<ReceiptPaymentSettingsForm {...props} />);
    typeUpi("not a upi id");
    expect(screen.getByText(/valid UPI ID/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
  });

  it("shows the live preview and saves with the current revision", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        configured: true,
        upiId: "spice@okhdfc",
        payeeName: "Spice Route Kitchen",
        enabled: true,
        revision: 1,
        updatedAt: "2026-11-22T00:00:00.000Z",
      }),
    });
    render(<ReceiptPaymentSettingsForm {...props} />);
    typeUpi(" Spice@OkHDFC ");
    expect(screen.getByRole("img", { name: "UPI payment QR for Rs 840.00" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/organizations/org-1/outlets/out-1/receipt-payment");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({
      expectedRevision: 0,
      upiId: "spice@okhdfc",
      payeeName: "Spice Route Kitchen",
      enabled: true,
    });
    expect(await screen.findByText(/saved/i)).toBeInTheDocument();
  });

  it("asks the user to reload when someone else changed the settings (409)", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 409, json: async () => ({}) });
    render(<ReceiptPaymentSettingsForm {...props} />);
    typeUpi("spice@okhdfc");
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/reload/i);
  });

  it("is read-only for people who cannot manage the outlet", () => {
    render(
      <ReceiptPaymentSettingsForm
        {...props}
        canManage={false}
        initial={{
          ...empty,
          configured: true,
          upiId: "spice@okhdfc",
          payeeName: "Spice",
          revision: 1,
        }}
      />
    );
    expect(screen.getByLabelText("UPI ID")).toBeDisabled();
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
  });

  it("explains that the QR prints only on INR bills for other currencies", () => {
    render(<ReceiptPaymentSettingsForm {...props} currency="USD" />);
    expect(screen.getByText(/only on INR bills/i)).toBeInTheDocument();
  });
});
