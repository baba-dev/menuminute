"use client";

import { useState } from "react";
import { OverridesEditor } from "./overrides-editor";
import { WeekEditor } from "./week-editor";
import type { ComboRef, OverrideView, SlotKind, SlotView, WeekEntry } from "./week-form";

type Props = {
  outletId: string;
  timezone: string;
  today: string;
  combos: ComboRef[];
  archivedCombos: ComboRef[];
  slots: SlotView[];
  week: WeekEntry[];
  overrides: OverrideView[];
};

/** Holds which meals have a stored slot so a first save enables the grid and overrides at once. */
export function WeekMenu({ slots, overrides, today, ...shared }: Props) {
  const [configured, setConfigured] = useState<SlotKind[]>(() => slots.map((s) => s.kind));
  return (
    <>
      <WeekEditor
        {...shared}
        slots={slots}
        week={shared.week}
        onSlotSaved={(kind) => setConfigured((c) => (c.includes(kind) ? c : [...c, kind]))}
      />
      <OverridesEditor
        outletId={shared.outletId}
        timezone={shared.timezone}
        today={today}
        combos={shared.combos}
        archivedCombos={shared.archivedCombos}
        overrides={overrides}
        configuredKinds={configured}
      />
    </>
  );
}
