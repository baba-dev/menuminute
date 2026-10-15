"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function OnboardingForm() {
  const router = useRouter();
  const [key] = useState(() => crypto.randomUUID());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const values = Object.fromEntries(new FormData(e.currentTarget));
        try {
          const r = await fetch("/api/organizations", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Idempotency-Key": key },
            body: JSON.stringify(values),
          });
          if (!r.ok) {
            setError("Could not create the outlet. Check its settings and try again.");
            return;
          }
          router.push("/dashboard");
          router.refresh();
        } catch {
          setError("Connection failed. Please try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="block">
        Outlet name
        <input
          name="name"
          required
          minLength={2}
          maxLength={100}
          className="block w-full rounded border p-2"
        />
      </label>
      <div>
        <label htmlFor="outletType" className="block">
          Outlet type
        </label>
        <select id="outletType" name="outletType" className="block w-full rounded border p-2">
          {["restaurant", "cafe", "takeout", "cloud_kitchen", "hotel", "mixed"].map((v) => (
            <option key={v} value={v}>
              {v.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </div>
      <label className="block">
        Country code
        <input
          name="country"
          defaultValue="IN"
          pattern="[A-Z]{2}"
          required
          className="block w-full rounded border p-2"
        />
      </label>
      <div>
        <label htmlFor="currency" className="block">
          Currency
        </label>
        <select
          id="currency"
          name="currency"
          defaultValue="INR"
          className="block w-full rounded border p-2"
        >
          {Intl.supportedValuesOf("currency").map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="timezone" className="block">
          Timezone
        </label>
        <select
          id="timezone"
          name="timezone"
          defaultValue="Asia/Calcutta"
          className="block w-full rounded border p-2"
        >
          {Intl.supportedValuesOf("timeZone").map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </div>
      {error && <p role="alert">{error}</p>}
      <button
        disabled={busy}
        className="rounded bg-orange-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Creating…" : "Create organization and outlet"}
      </button>
    </form>
  );
}
