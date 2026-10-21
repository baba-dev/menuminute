"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ContextSwitcher({
  outlets,
  selected,
}: {
  outlets: { id: string; name: string; organizationId: string }[];
  selected?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="mm-workspace-switcher">
      <label className="sr-only" htmlFor="mm-active-outlet">
        Active outlet
      </label>
      <select
        id="mm-active-outlet"
        aria-describedby={error ? "mm-active-outlet-error" : undefined}
        aria-invalid={Boolean(error)}
        value={selected ?? ""}
        disabled={busy || outlets.length === 0}
        onChange={async (event) => {
          setBusy(true);
          setError("");
          try {
            const result = await fetch("/api/context", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ outletId: event.target.value }),
            });
            if (!result.ok) throw new Error("Outlet access changed. Refresh and try again.");
            router.refresh();
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to switch outlet");
          } finally {
            setBusy(false);
          }
        }}
      >
        <option value="" disabled>
          Select outlet
        </option>
        {outlets.map((outlet) => (
          <option key={outlet.id} value={outlet.id}>
            {outlet.name}
          </option>
        ))}
      </select>
      {busy && (
        <p className="mm-workspace-switcher-status" role="status">
          Switching outlet…
        </p>
      )}
      {error && (
        <p className="mm-workspace-switcher-error" id="mm-active-outlet-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
