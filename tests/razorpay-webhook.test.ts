import { it, expect, describe } from "vitest";
import crypto from "node:crypto";
import { verifyRazorpayWebhookSignature } from "../src/modules/billing/razorpay";

describe("Razorpay Webhook Signature Verification", () => {
  const secret = "test_webhook_secret_123456789012345";
  const payload = JSON.stringify({
    event: "subscription.charged",
    payload: {
      subscription: {
        entity: {
          id: "sub_test123",
          plan_id: "plan_ORDERING_119",
          notes: { organizationId: "org-test-123" },
          current_start: 1700000000,
          current_end: 1702592000,
        },
      },
      payment: {
        entity: {
          id: "pay_test456",
        },
      },
    },
  });

  it("verifies a valid HMAC-SHA256 signature successfully", () => {
    const validSignature = crypto.createHmac("sha256", secret).update(payload).digest("hex");

    expect(verifyRazorpayWebhookSignature(payload, validSignature, secret)).toBe(true);
  });

  it("rejects an invalid or tampered signature", () => {
    const validSignature = crypto.createHmac("sha256", secret).update(payload).digest("hex");

    const forgedSignature = validSignature.slice(0, -4) + "abcd";
    expect(verifyRazorpayWebhookSignature(payload, forgedSignature, secret)).toBe(false);
  });

  it("rejects when the payload was modified after signing", () => {
    const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");

    const tamperedPayload = payload + " ";
    expect(verifyRazorpayWebhookSignature(tamperedPayload, signature, secret)).toBe(false);
  });

  it("fails safely when signature or secret is empty", () => {
    expect(verifyRazorpayWebhookSignature(payload, "", secret)).toBe(false);
    expect(verifyRazorpayWebhookSignature(payload, "sig", "")).toBe(false);
    expect(verifyRazorpayWebhookSignature("", "sig", secret)).toBe(false);
  });
});
