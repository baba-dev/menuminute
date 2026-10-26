import { expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { requestId } from "../src/lib/observability";
import { errorResponse } from "../src/lib/request-context";
import { proxy } from "../src/proxy";

it("overwrites an untrusted request ID at the API boundary", () => {
  const response = proxy(
    new NextRequest("https://menu.invalid/api/context", {
      headers: { "x-request-id": "attacker-chosen-id" },
    })
  );
  expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  expect(response.headers.get("x-request-id")).not.toBe("attacker-chosen-id");
});

it("uses one correlation ID for a redacted server-error event and response", () => {
  const request = new Request("https://menu.invalid/api/context?private=value", { method: "POST" });
  expect(requestId(request)).toBe(requestId(request));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const response = errorResponse(new Error("sensitive internal detail"), request);
    const record = JSON.parse(String(log.mock.calls[0]![0]));
    expect(response.status).toBe(500);
    expect(record.requestId).toBe(response.headers.get("x-request-id"));
    expect(record.path).toBe("/api/context");
    expect(JSON.stringify(record)).not.toContain("sensitive internal detail");
    expect(JSON.stringify(record)).not.toContain("private=value");
  } finally {
    log.mockRestore();
  }
});

it("does not log path parameters such as invitation tokens", () => {
  const request = new Request("https://menu.invalid/api/invitations/private-invite-token?email=secret");
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    errorResponse(new Error("private detail"), request);
    const record = JSON.parse(String(log.mock.calls[0]![0]));
    expect(record.path).toBe("/api/invitations");
    expect(JSON.stringify(record)).not.toContain("private-invite-token");
    expect(JSON.stringify(record)).not.toContain("secret");
  } finally {
    log.mockRestore();
  }
});
