"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ScheduleEditor } from "@/components/menu-product/schedule-editor";
import type { Schedule } from "@/modules/menu-product/contracts";
export function OnboardingForm() {
  const [type, setType] = useState("restaurant"),
    [modes, setModes] = useState(["dine_in"]),
    [schedule, setSchedule] = useState<Schedule | null>(null);
  const router = useRouter();
  // A lost response must retry with the same key; changed settings require a new key.
  const retry = useRef({ signature: "", key: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="product stack"
      aria-busy={busy}
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setError("");
        if (modes.length === 0) {
          setError("Select at least one fulfillment mode.");
          return;
        }
        setBusy(true);
        const values = {
          ...Object.fromEntries(new FormData(e.currentTarget)),
          fulfillmentModes: modes,
          menuSchedule: schedule,
        };
        const signature = JSON.stringify(values);
        if (retry.current.signature !== signature)
          retry.current = { signature, key: crypto.randomUUID() };
        try {
          const r = await fetch("/api/organizations", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Idempotency-Key": retry.current.key },
            body: signature,
          });
          if (!r.ok) {
            setError(
              r.status === 409
                ? "These details changed while the request was being processed. Review and retry."
                : "Could not create the outlet. Your entries are preserved. Review and retry."
            );
            return;
          }
          router.push("/dashboard/menu");
          router.refresh();
        } catch {
          setError("Connection failed. Please try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="panel stack">
        <span className="eyebrow">Step 1 · Your business</span>
        <p>Name your outlet and select the type that best describes it. Each outlet has its own menu settings.</p>
      </div>
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
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setModes(
              ["cafe", "takeout", "cloud_kitchen"].includes(e.target.value)
                ? ["pickup"]
                : ["dine_in"]
            );
          }}
          id="outletType"
          name="outletType"
          className="block w-full rounded border p-2"
        >
          {["restaurant", "cafe", "takeout", "cloud_kitchen", "hotel", "mixed"].map((v) => (
            <option key={v} value={v}>
              {v.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </div>
      <div className="panel stack">
        <span className="eyebrow">Step 2 · Local settings</span>
        <p>Confirm the outlet country, transaction currency and IANA timezone. These are independent of your platform billing currency.</p>
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
      <section className="panel stack">
        <span className="eyebrow">Step 3 · Service</span>
        <h2>How do guests collect their food?</h2>
        {["dine_in", "pickup"].map((m) => (
          <label key={m} className="row">
            <input
              type="checkbox"
              checked={modes.includes(m)}
              disabled={m === "dine_in" && ["takeout", "cloud_kitchen"].includes(type)}
              onChange={(e) =>
                setModes(e.target.checked ? [...modes, m] : modes.filter((x) => x !== m))
              }
            />
            {m === "dine_in" ? "Dine-in" : "Pickup"}
          </label>
        ))}
        <p>You can change supported modes later without replacing the QR.</p>
      </section>
      <details className="panel">
        <summary>Step 4 · Set the first menu’s service hours (optional)</summary>
        <ScheduleEditor value={schedule} onChange={setSchedule} />
      </details>
      {error && <p role="alert" className="error" tabIndex={-1}>{error}</p>}
      <p>Next: Menu Studio, draft preview and explicit publication. Your permanent QR will not be rotated by menu edits.</p>
      <button disabled={busy || modes.length === 0} className="ember">
        {busy ? "Creating…" : "Create organization and outlet"}
      </button>
    </form>
  );
}
