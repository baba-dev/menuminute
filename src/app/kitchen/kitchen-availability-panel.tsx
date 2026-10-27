"use client";
import { useState } from "react";
import type { KitchenDish } from "@/modules/hospitality/service";
export function KitchenAvailabilityPanel({
  dishes,
  organizationId,
  outletId,
}: {
  dishes: KitchenDish[];
  organizationId: string;
  outletId: string;
}) {
  const [list, setList] = useState(dishes);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [confirm, setConfirm] = useState(false);
  const item = list.find((d) => d.menuId + ":" + d.id === selected);
  async function change() {
    if (!item || busy) return;
    setBusy(true);
    setNotice("");
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/outlets/${encodeURIComponent(outletId)}/menu/quick-availability`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ menuId: item.menuId, dishId: item.id, soldOut: !item.soldOut }),
        }
      );
      if (!res.ok) throw Error("Availability could not be saved. Refresh and retry.");
      setList((old) =>
        old.map((x) =>
          x.menuId === item.menuId && x.id === item.id ? { ...x, soldOut: !item.soldOut } : x
        )
      );
      setNotice(
        item.soldOut
          ? "Dish restocked for this outlet and published menu."
          : "Dish marked sold out for this outlet and published menu."
      );
      setConfirm(false);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }
  if (!dishes.length) return null;
  return (
    <section
      className="mx-auto my-3 max-w-7xl rounded-xl border border-amber-500/40 bg-stone-900 p-4 text-stone-100"
      aria-label="Kitchen dish availability"
    >
      <h2 className="text-base font-bold">Fast-Pass 86 · Published Dishes</h2>
      <p className="mb-3 text-xs opacity-80">
        Choose the exact dish and menu. This only changes availability for the selected outlet, not
        unrelated dishes with the same name.
      </p>
      <label className="block text-sm" htmlFor="kitchen-86-dish">
        Select dish
        <select
          id="kitchen-86-dish"
          className="mt-1 block min-h-11 w-full rounded border border-stone-600 bg-stone-950 p-2 text-sm text-white"
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setConfirm(false);
          }}
        >
          <option value="">Choose a published dish</option>
          {list.map((d) => (
            <option key={d.menuId + ":" + d.id} value={d.menuId + ":" + d.id}>
              {d.name} · {d.category} · {d.menuId.slice(0, 16)} {d.soldOut ? "(SOLD OUT)" : ""}
            </option>
          ))}
        </select>
      </label>
      {item && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!confirm ? (
            <button
              type="button"
              className="min-h-11 rounded bg-amber-500 px-4 text-sm font-semibold text-stone-950"
              onClick={() => setConfirm(true)}
            >
              {item.soldOut ? "Restock" : "Mark sold out"}
            </button>
          ) : (
            <>
              <span className="text-xs">
                Confirm {item.soldOut ? "restock" : "86"} for this exact menu?
              </span>
              <button
                type="button"
                disabled={busy}
                className="min-h-11 rounded bg-rose-600 px-4 text-sm"
                onClick={() => void change()}
              >
                Confirm change
              </button>
              <button
                type="button"
                className="min-h-11 rounded border border-current/30 px-4 text-sm"
                onClick={() => setConfirm(false)}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      )}
      {notice && (
        <p role="status" className="mt-2 text-xs">
          {notice}
        </p>
      )}
    </section>
  );
}
