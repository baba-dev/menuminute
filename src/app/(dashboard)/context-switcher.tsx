"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function ContextSwitcher({
  outlets,
  selected,
}: {
  outlets: { id: string; name: string }[];
  selected?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="px-3 pb-2">
      <label className="text-xs font-semibold">
        Active outlet
        <select
          aria-label="Active outlet"
          className="mt-1 w-full rounded border p-2 text-xs"
          value={selected ?? ""}
          disabled={busy}
          onChange={async (e) => {
            setBusy(true);
            setError("");
            try {
              const r = await fetch("/api/context", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ outletId: e.target.value }),
              });
              if (!r.ok) throw new Error("Outlet access changed. Refresh and try again.");
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Unable to switch");
            } finally {
              setBusy(false);
            }
          }}
        >
          <option value="" disabled>
            Select outlet
          </option>
          {outlets.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      <p role="status" className="text-xs">
        {error}
      </p>
    </div>
  );
}
