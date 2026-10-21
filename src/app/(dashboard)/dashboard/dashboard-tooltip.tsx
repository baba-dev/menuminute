"use client";

import * as Tooltip from "@radix-ui/react-tooltip";
import { Info } from "lucide-react";

export function DashboardTooltip({ label, children }: { label: string; children: string }) {
  return (
    <Tooltip.Provider delayDuration={180}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button type="button" className="mm-dashboard-info" aria-label={"About " + label}>
            <Info size={15} aria-hidden="true" />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className="mm-dashboard-tooltip" sideOffset={8} collisionPadding={12}>
            {children}
            <Tooltip.Arrow className="mm-dashboard-tooltip-arrow" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
