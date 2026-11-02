import { describe, expect, it } from "vitest";
import { featureActivationRows, type ActivationInputs } from "../src/modules/admin/feature-activation";

const base: ActivationInputs = {
  kitchenRelease: false, kitchenCatalog: false, razorpay: false,
  kitchenBilling: false, kitchenProviderPlan: false,
  importWebEnabled: false, importApproved: false, importModel: false, importKey: false,
  conciergeEnabled: false, conciergeAll: false, conciergeOutletCount: 0, conciergeProvider: false,
  emberRead: false, emberActions: false, emberPublish: false, emberProviderVerified: false,
  pwaOperational: false, pwaOutletCount: 0, pwaPush: false, pwaPushOutletCount: 0,
  pwaVapidConfigured: false,
};

describe("feature activation diagnostics", () => {
  const item = (values: Partial<ActivationInputs>, id: string) =>
    featureActivationRows({ ...base, ...values }).find((row) => row.id === id)!;

  it("never treats an approved Kitchen release alone as verified paid checkout", () => {
    expect(item({ kitchenRelease: true }, "kitchen").state).toBe("review");
    const configured = item({
      kitchenRelease: true, kitchenCatalog: true, razorpay: true,
      kitchenBilling: true, kitchenProviderPlan: true,
    }, "kitchen");
    expect(configured.state).toBe("configured");
    expect(configured.detail).toMatch(/not been tested/);
  });

  it("does not claim a worker is ready based only on web AI flags", () => {
    const f = item({ importWebEnabled: true, importApproved: true, importKey: true, importModel: true }, "import");
    expect(f.state).toBe("review");
    expect(f.detail).toMatch(/worker environment/);
    expect(item({ importWebEnabled: true }, "import").state).toBe("unavailable");
  });

  it("distinguishes approved all-outlet Concierge from a restricted pilot", () => {
    expect(item({ conciergeEnabled: true, conciergeProvider: true, conciergeOutletCount: 2 }, "concierge").state).toBe("limited");
    expect(item({ conciergeEnabled: true, conciergeProvider: true, conciergeAll: true }, "concierge").state).toBe("configured");
    expect(item({ conciergeEnabled: true, conciergeAll: true }, "concierge").state).toBe("unavailable");
  });

  it("keeps regulated POS finance separate and PWA opt-in independent", () => {
    expect(item({}, "normal-pos").state).toBe("entitled");
    expect(item({}, "pos-finance").state).toBe("review");
    expect(item({ pwaOperational: true }, "pwa").state).toBe("unavailable");
    expect(item({ pwaOperational: true, pwaOutletCount: 1 }, "pwa").state).toBe("limited");
    expect(item({ pwaPush: true, pwaPushOutletCount: 1 }, "push").state).toBe("unavailable");
    expect(item({ pwaPush: true, pwaPushOutletCount: 1, pwaVapidConfigured: true }, "push").state).toBe("limited");
  });

  it("never reports publisher access based on read-only Ember configuration", () => {
    expect(item({ emberRead: true, emberProviderVerified: true }, "ember").state).toBe("limited");
    expect(item({ emberRead: true, emberProviderVerified: true, emberActions: true }, "ember").state).toBe("review");
  });
});
