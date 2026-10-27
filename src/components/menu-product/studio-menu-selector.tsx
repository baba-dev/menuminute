"use client";

import { ChevronDown } from "lucide-react";
import { menuLibraryStatus, type MenuLibraryEntry } from "./studio-menu-gallery";
import { menuDocumentSchema } from "@/modules/menu-product/contracts";

export function StudioMenuSelector({
  menus,
  selectedId,
  disabled,
  onSelect,
}: {
  menus: MenuLibraryEntry[];
  selectedId: string;
  disabled: boolean;
  onSelect: (id: string) => void;
}) {
  const active = menus.filter((menu) => !menu.archived);
  const selected = menus.find((menu) => menu.id === selectedId);
  const all = selected?.archived ? [...active, selected] : active;

  return (
    <label className="atelier-selected-menu">
      <span className="sr-only">Select menu for Studio and overview</span>
      <span className="atelier-selected-menu-status" aria-hidden="true">
        {selected?.publishedRevision && !selected.archived ? "●" : "○"}
      </span>
      <select
        aria-label="Menu displayed in Studio"
        value={selectedId}
        disabled={disabled || all.length === 0}
        onChange={(event) => {
          if (event.target.value !== selectedId) onSelect(event.target.value);
        }}
      >
        {all.length === 0 && <option value="">No menus yet</option>}
        {all.map((menu) => {
          const result = menuDocumentSchema.safeParse(menu.document);
          return (
            <option key={menu.id} value={menu.id}>
              {result.success ? result.data.name : "Menu unavailable"} · {menuLibraryStatus(menu)}
            </option>
          );
        })}
      </select>
      <ChevronDown size={15} aria-hidden="true" />
    </label>
  );
}
