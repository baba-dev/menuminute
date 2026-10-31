import { describe, expect, it } from "vitest";
import { fixture } from "./helpers";
import { executeReadTool, authorizedToolDefinitions } from "../src/modules/intelligence/read-tools";
import { selectQuestionTools } from "../src/modules/intelligence/tool-selection";
import { toolDefinitions } from "../src/modules/intelligence/read-tools";
import { proposeToolDefinitions } from "../src/modules/intelligence/propose-tools";
import { toolDefinition } from "../src/modules/intelligence/contracts";

const NEW = ["service.requests", "qr.details", "reports.insights", "billing.status"];

describe("Ember tool registry contract", () => {
  it("every advertised tool satisfies the provider contract (a bad name fails every such question)", () => {
    const all = [...toolDefinitions(), ...proposeToolDefinitions()];
    for (const tool of all) {
      const definition = {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      };
      expect(toolDefinition.safeParse(definition).success, tool.name).toBe(true);
    }
    expect(new Set(all.map((t) => t.name.replaceAll(".", "_"))).size).toBe(all.length);
  });
});

describe("Ember additional read tools", () => {
  it("offers the new tools to an owner and returns safe, bounded data", async () => {
    const f = await fixture();
    const ctx = { actor: f.actor, organizationId: f.outlet.organizationId, outletId: f.outlet.id };
    const names = (await authorizedToolDefinitions(ctx)).map((t) => t.name);
    for (const n of NEW) expect(names).toContain(n);

    const requests = await executeReadTool(ctx, "service.requests", {});
    expect(requests.data).toMatchObject({ openCount: 0, requests: [] });

    const qr = await executeReadTool(ctx, "qr.details", {});
    const text = JSON.stringify(qr.data);
    expect(text).not.toMatch(/destination|svg|token|http/i);
    expect(qr.data).toHaveProperty("totalScans");

    const insights = await executeReadTool(ctx, "reports.insights", { range: "today" });
    expect(insights.data).toHaveProperty("busiestHours");
    await expect(executeReadTool(ctx, "reports.insights", { range: "forever" })).rejects.toThrow();
    await expect(executeReadTool(ctx, "service.requests", { extra: 1 })).rejects.toThrow();

    const billing = await executeReadTool(ctx, "billing.status", {});
    expect(JSON.stringify(billing.data)).not.toMatch(/grant|razorpay|sub_[A-Za-z0-9]/i);
  });

  it("routes plain-language questions to the right tool", () => {
    const registry = [
      "orders.pulse",
      "orders.history",
      "kitchen.pulse",
      "menu.summary",
      "tables.pulse",
      "finance.pulse",
      "reports.summary",
      "menu.findDish",
      "imports.pulse",
      "qr.pulse",
      ...NEW,
      "support.myTickets",
      "propose.supportTicket",
      "help.search",
    ].map((name) => ({ name }));
    const first = (q: string) => selectQuestionTools(registry, q)[0]?.name;
    expect(first("Is anyone asking for the bill?")).toBe("service.requests");
    expect(first("Which tables need a waiter?")).toBe("service.requests");
    expect(first("Which QR code is scanned the most?")).toBe("qr.details");
    expect(first("When is my busiest time?")).toBe("reports.insights");
    expect(first("What are my slowest selling dishes?")).toBe("reports.insights");
    expect(first("What is my subscription status?")).toBe("billing.status");
    expect(first("How much sale this week?")).toBe("reports.summary");
    expect(first("What are my orders right now?")).toBe("orders.pulse");
    expect(first("Show my support tickets")).toBe("support.myTickets");
    expect(first("Any reply to my request?")).toBe("support.myTickets");
    expect(first("Please raise a support request, the printer is broken")).toBe(
      "propose.supportTicket"
    );
    expect(first("Something is not working with my menu")).toBe("propose.supportTicket");
  });
});
