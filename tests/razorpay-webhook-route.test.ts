import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  signatureValid: true,
  charge: vi.fn(async () => "grant-test"),
  status: vi.fn(async () => {}),
  refund: vi.fn(async () => true),
}));
vi.mock("@/lib/config/env", () => ({
  env: {
    RAZORPAY_ENABLED: true,
    COMMUNITY_EDITION: false,
    RAZORPAY_WEBHOOK_SECRET: "test-webhook-key",
    RAZORPAY_PLAN_ORDERING_ID: "plan_ORDERING_TEST",
    RAZORPAY_PLAN_KITCHEN_ID: "plan_KITCHEN_TEST",
    RAZORPAY_KITCHEN_ENABLED: false,
  },
}));
vi.mock("@/modules/billing/razorpay", () => ({
  providerEventId: vi.fn(() => "evt-test-1234"),
  verifyRazorpayWebhookSignature: vi.fn(() => m.signatureValid),
  recordRazorpaySubscriptionGrant: m.charge,
  recordRazorpaySubscriptionStatus: m.status,
  recordRazorpaySubscriptionRefund: m.refund,
}));

import { POST } from "../src/app/api/webhooks/billing/razorpay/route";

const current = Math.floor(Date.now() / 1000);
const subscription = {
  id: "sub_TEST123456",
  plan_id: "plan_ORDERING_TEST",
  current_start: current - 300,
  current_end: current + 30 * 86400,
};
const chargeEvent = {
  event: "subscription.charged",
  created_at: current,
  payload: {
    subscription: { entity: subscription },
    payment: {
      entity: {
        id: "pay_TEST123456",
        status: "captured",
        amount: 11900,
        currency: "INR",
      },
    },
  },
};
function request(body: unknown, signature = "a".repeat(64)): Request {
  return new Request("https://food.bababuilds.com/api/webhooks/billing/razorpay", {
    method: "POST",
    headers: { "x-razorpay-signature": signature },
    body: JSON.stringify(body),
  });
}

describe("Razorpay webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.signatureValid = true;
  });
  it("rejects missing or invalid signatures", async () => {
    expect((await POST(request(chargeEvent, ""))).status).toBe(400);
    m.signatureValid = false;
    expect((await POST(request(chargeEvent))).status).toBe(400);
    expect(m.charge).not.toHaveBeenCalled();
  });
  it("never treats subscription activation or payment capture as paid", async () => {
    const response = await POST(request({ ...chargeEvent, event: "subscription.activated" }));
    expect(response.status).toBe(200);
    expect(m.charge).not.toHaveBeenCalled();
  });
  it("rejects underpayments, wrong plans and uncaptured payments", async () => {
    for (const changes of [
      { payment: { entity: { ...chargeEvent.payload.payment.entity, amount: 11899 } } },
      { payment: { entity: { ...chargeEvent.payload.payment.entity, status: "authorized" } } },
      { subscription: { entity: { ...subscription, plan_id: "plan_UNRECOGNIZED" } } },
    ]) {
      const response = await POST(
        request({ ...chargeEvent, payload: { ...chargeEvent.payload, ...changes } })
      );
      expect(response.status).toBe(422);
    }
    expect(m.charge).not.toHaveBeenCalled();
  });
  it("accepts the captured payment for a registered catalog plan", async () => {
    const response = await POST(request(chargeEvent));
    expect(response.status).toBe(200);
    expect(m.charge).toHaveBeenCalledOnce();
    expect(m.charge).toHaveBeenCalledWith(
      expect.objectContaining({ paymentId: "pay_TEST123456", planId: "plan_ORDERING_TEST" })
    );
  });
  it("reconciles cancellation without inventing a paid grant", async () => {
    const response = await POST(
      request({
        event: "subscription.cancelled",
        created_at: current,
        payload: { subscription: { entity: subscription } },
      })
    );
    expect(response.status).toBe(200);
    expect(m.status).toHaveBeenCalledWith(expect.objectContaining({ status: "cancelled" }));
    expect(m.charge).not.toHaveBeenCalled();
  });
  it("ignores partial refunds and processes complete captured-payment refunds", async () => {
    const payment = { id: "pay_TEST123456", currency: "INR", amount: 11900, amount_refunded: 100 };
    const body = { event: "payment.refunded", payload: { payment: { entity: payment } } };
    expect((await POST(request(body))).status).toBe(200);
    expect(m.refund).not.toHaveBeenCalled();
    expect(
      (
        await POST(
          request({
            ...body,
            payload: { payment: { entity: { ...payment, amount_refunded: 11900 } } },
          })
        )
      ).status
    ).toBe(200);
    expect(m.refund).toHaveBeenCalledOnce();
  });
});
