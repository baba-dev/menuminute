"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Building2, Check, Store } from "lucide-react";

type Organization = { id: string; name: string; role: string };
type Outlet = { id: string; name: string; organizationId: string };
export function AccountWorkspacePreference({
  organizations,
  outlets,
  selectedOrganizationId,
  selectedOutletId,
}: {
  organizations: Organization[];
  outlets: Outlet[];
  selectedOrganizationId: string | null;
  selectedOutletId: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function choose(selection: { organizationId: string } | { outletId: string }, key: string) {
    setBusy(key);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/context", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(selection),
        cache: "no-store",
      });
      if (!res.ok)
        throw new Error(
          res.status === 403
            ? "Access to this workspace has changed. Refresh your choices."
            : "Couldn't save your workspace. Please retry."
        );
      setNotice("Default workspace saved across your devices.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't save your workspace.");
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="grid gap-3">
      <p className="text-sm">
        Choose your default workspace. We recheck access each time you return.
      </p>
      {organizations.map((org) => (
        <div
          key={org.id}
          className="grid gap-2 rounded-xl border border-stone-200 p-3 dark:border-stone-700"
        >
          <button
            type="button"
            disabled={Boolean(busy)}
            aria-pressed={selectedOrganizationId === org.id}
            className="flex min-h-11 items-center gap-2 text-left font-semibold"
            onClick={() => void choose({ organizationId: org.id }, org.id)}
          >
            <Building2 size={18} aria-hidden="true" />
            <span className="min-w-0 flex-1 break-words">
              {org.name} <span className="text-xs opacity-65">· {org.role}</span>
            </span>
            {selectedOrganizationId === org.id && (
              <Check size={18} aria-label="Default organization" />
            )}
          </button>
          {outlets
            .filter((o) => o.organizationId === org.id)
            .map((outlet) => (
              <button
                key={outlet.id}
                type="button"
                disabled={Boolean(busy)}
                aria-pressed={selectedOutletId === outlet.id && selectedOrganizationId === org.id}
                className="ml-2 flex min-h-11 items-center gap-2 rounded-lg border border-stone-200 px-3 text-left text-sm hover:bg-orange-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 dark:border-stone-700 dark:hover:bg-stone-800"
                onClick={() => void choose({ outletId: outlet.id }, outlet.id)}
              >
                <Store size={17} aria-hidden="true" />
                <span className="flex-1 break-words">{outlet.name}</span>
                {selectedOutletId === outlet.id && selectedOrganizationId === org.id && (
                  <Check size={17} aria-label="Default outlet" />
                )}
              </button>
            ))}
        </div>
      ))}
      {!organizations.length && <p className="text-sm">No active workspaces are available.</p>}
      {busy && <p role="status">Saving your selection…</p>}
      {notice && (
        <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
