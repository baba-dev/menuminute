// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { StepGetPaid } from "../src/components/onboarding/wizard-steps/step-get-paid";
import { initialWizardDraft, type WizardDraft } from "../src/components/onboarding/wizard-types";

function Harness({ initial = initialWizardDraft }: { initial?: WizardDraft }) {
  const [draft, setDraft] = useState(initial);
  return (
    <StepGetPaid
      draft={draft}
      onChange={(key, value) => setDraft((d) => ({ ...d, [key]: value }))}
    />
  );
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("StepGetPaid", () => {
  it("is optional: blank fields show no error and no preview", () => {
    render(<Harness />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
  it("flags an invalid UPI ID", () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText(/UPI ID/), { target: { value: "chai" } });
    expect(screen.getByRole("alert")).toHaveTextContent(/valid UPI ID/);
  });
  it("previews the printed block using the outlet name when no payee name is typed", () => {
    render(<Harness initial={{ ...initialWizardDraft, name: "Chai Corner" }} />);
    fireEvent.change(screen.getByLabelText(/UPI ID/), { target: { value: "chai@okhdfc" } });
    expect(screen.getByRole("img", { name: "UPI payment QR for Rs 840.00" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("explains the INR-only limit for other currencies", () => {
    render(<Harness initial={{ ...initialWizardDraft, currency: "OMR" }} />);
    expect(screen.getByRole("status")).toHaveTextContent(/only on INR bills/);
  });
});
