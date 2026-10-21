"use client";

import * as Popover from "@radix-ui/react-popover";
import { Info } from "lucide-react";

/**
 * A click/tap-accessible explanation, unlike hover-only tooltips.
 * Radix provides Escape, outside-click dismissal, focus management and
 * an accessible labelled dialog on touch, keyboard and pointer devices.
 */
export function DashboardTooltip({ label, children }: { label: string; children: string }) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button type="button" className="mm-dashboard-info" aria-label={"About " + label}>
          <Info size={15} aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          aria-label={"About " + label}
          className="mm-dashboard-tooltip"
          sideOffset={8}
          collisionPadding={12}
        >
          {children}
          <Popover.Arrow className="mm-dashboard-tooltip-arrow" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
