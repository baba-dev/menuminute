// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { writeFileSync } from "node:fs";
import { SupportConsole } from "./support-console";
import type { TicketDetail, TicketRow } from "@/modules/support/service";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => new URLSearchParams("status=open"),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const iso = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();
const row = (n: number, over: Partial<TicketRow> = {}): TicketRow => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  number: n,
  subject: "Kitchen printer is not printing new orders",
  status: "open",
  priority: "high",
  category: "kitchen",
  requesterName: "Asha Verma",
  requesterEmail: "asha@spiceroute.example",
  organizationName: "Spice Route Kitchen",
  outletName: "Indiranagar",
  assigneeId: null,
  assigneeName: null,
  source: "ember",
  archived: false,
  createdAt: iso(14),
  updatedAt: iso(14),
  ...over,
});
const tickets = [
  row(12),
  row(11, {
    subject: "How do I add a second menu for lunch?",
    priority: "normal",
    status: "in_progress",
    assigneeName: "Rahul",
    createdAt: iso(190),
    category: "menu",
  }),
  row(10, {
    subject: "Billing shows the wrong plan",
    priority: "urgent",
    status: "waiting",
    createdAt: iso(60 * 30),
    category: "billing",
  }),
  row(9, {
    subject: "QR code for table 4 is faded",
    priority: "low",
    status: "resolved",
    createdAt: iso(60 * 80),
  }),
];
const counts = { all: 4, open: 1, in_progress: 1, waiting: 1, resolved: 1, closed: 0 };
const detail = (over: Partial<TicketDetail> = {}): TicketDetail => ({
  ...tickets[0]!,
  body: "Since noon the kitchen printer does not print new orders.\nWe restarted it twice.",
  messages: [
    {
      id: "m1",
      authorName: "Rahul",
      internal: true,
      body: "Looks like the printer is on the old network. Checking.",
      createdAt: iso(8),
    },
    {
      id: "m2",
      authorName: "Rahul",
      internal: false,
      body: "Please reconnect the printer to the shop Wi-Fi and tell us if it still fails.",
      createdAt: iso(3),
    },
  ],
  ...over,
});
const props = () => ({
  tickets,
  counts,
  hasNext: false,
  page: 1,
  filters: { status: "", priority: "", q: "", archived: false },
  currentAdminId: "admin-1",
  onLoad: vi.fn(async () => detail()),
  onUpdate: vi.fn(async () =>
    detail({ status: "in_progress", assigneeId: "admin-1", assigneeName: "You" })
  ),
  onReply: vi.fn(async () => detail()),
  onArchive: vi.fn(async () => detail({ archived: true })),
});

describe("Support desk console", () => {
  it("shows status tabs with live counts and filters through the URL", () => {
    render(<SupportConsole {...props()} />);
    expect(screen.getByRole("tab", { name: /All\s*4/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /Waiting\s*1/ }));
    expect(push).toHaveBeenCalledWith(expect.stringContaining("status=waiting"));
    expect(screen.getByText("Billing shows the wrong plan")).toBeTruthy();
  });

  it("opens a request, replies, and keeps internal notes labelled", async () => {
    const p = props();
    const view = render(<SupportConsole {...p} />);
    fireEvent.click(screen.getByText("Kitchen printer is not printing new orders"));
    await screen.findByText(/Internal note · only admins see this/);
    expect(screen.getByText(/Reply to operator/)).toBeTruthy();
    if (process.env["SUPPORT_SHOT_DIR"]) {
      writeFileSync(`${process.env["SUPPORT_SHOT_DIR"]}/panel.html`, document.body.innerHTML);
    }
    const box = screen.getByLabelText("Reply");
    fireEvent.change(box, { target: { value: "  Thanks, we are on it.  " } });
    fireEvent.click(screen.getByRole("button", { name: /Send reply/ }));
    await waitFor(() =>
      expect(p.onReply).toHaveBeenCalledWith(tickets[0]!.id, "  Thanks, we are on it.  ", false)
    );
    fireEvent.click(screen.getByLabelText("Internal note"));
    fireEvent.change(screen.getByLabelText("Reply"), { target: { value: "Escalate to Rahul" } });
    fireEvent.click(screen.getByRole("button", { name: /Add note/ }));
    await waitFor(() =>
      expect(p.onReply).toHaveBeenLastCalledWith(tickets[0]!.id, "Escalate to Rahul", true)
    );
    view.unmount();
  });

  it("changes status and assignment through the server handlers and can archive", async () => {
    const p = props();
    render(<SupportConsole {...p} />);
    fireEvent.click(screen.getByText("Kitchen printer is not printing new orders"));
    await screen.findByLabelText("Status");
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "resolved" } });
    await waitFor(() =>
      expect(p.onUpdate).toHaveBeenCalledWith(tickets[0]!.id, { status: "resolved" })
    );
    fireEvent.click(await screen.findByRole("button", { name: /Archive/ }));
    await waitFor(() => expect(p.onArchive).toHaveBeenCalledWith(tickets[0]!.id, true));
  });

  it("shows a friendly empty state", () => {
    render(
      <SupportConsole
        {...props()}
        tickets={[]}
        counts={{ all: 0, open: 0, in_progress: 0, waiting: 0, resolved: 0, closed: 0 }}
      />
    );
    expect(screen.getByText("No support requests yet")).toBeTruthy();
  });

  it("writes the list markup for visual review when asked", () => {
    const view = render(<SupportConsole {...props()} />);
    if (process.env["SUPPORT_SHOT_DIR"]) {
      writeFileSync(`${process.env["SUPPORT_SHOT_DIR"]}/list.html`, view.container.innerHTML);
    }
    expect(view.container.querySelectorAll("li")).toHaveLength(4);
  });
});
