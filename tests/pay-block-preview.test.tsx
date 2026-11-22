// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PayBlockPreview } from "../src/components/pos/pay-block-preview";
import { buildUpiPayUri } from "../src/lib/pos/upi";

const uri = buildUpiPayUri({
  vpa: "spiceroute@okhdfc",
  payeeName: "Spice Route",
  amountMinor: "84000",
  billNo: "1042",
})!;
const block = {
  uri,
  amountLabel: "Rs 840.00",
  payeeName: "Spice Route Kitchen",
  upiId: "spiceroute@okhdfc",
};
const putImageData = vi.fn();
const createImageData = vi.fn((w: number, h: number) => ({
  data: new Uint8ClampedArray(w * h * 4),
  width: w,
  height: h,
}));

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    createImageData,
    putImageData,
  } as unknown as CanvasRenderingContext2D);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  putImageData.mockClear();
  createImageData.mockClear();
});

describe("PayBlockPreview", () => {
  it.each([
    ["80", 576],
    ["58", 384],
  ] as const)("draws the %s mm block at its dot width with an accessible label", (paper, width) => {
    render(<PayBlockPreview block={block} paper={paper} />);
    const canvas = screen.getByRole("img", { name: "UPI payment QR for Rs 840.00" });
    expect(canvas.tagName).toBe("CANVAS");
    expect(canvas).toHaveAttribute("width", String(width));
    expect(createImageData).toHaveBeenCalledWith(width, expect.any(Number));
    expect(putImageData).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when the link is too long to print", () => {
    const { container } = render(
      <PayBlockPreview block={{ ...block, uri: "upi://pay?pa=" + "a".repeat(200) }} paper="80" />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
