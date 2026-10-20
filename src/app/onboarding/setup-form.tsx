"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ScheduleEditor } from "@/components/menu-product/schedule-editor";
import type { Schedule } from "@/modules/menu-product/contracts";
import { localeOptions, currencyFor, timezoneOptions } from "@/modules/onboarding/locales";
type Fields = {
  name: string;
  country: string;
  currency: string;
  timezone: string;
  outletType: string;
  fulfillmentModes: string[];
  menuSchedule: Schedule | null;
};
const initial: Fields = {
  name: "",
  country: "IN",
  currency: "INR",
  timezone: "Asia/Kolkata",
  outletType: "restaurant",
  fulfillmentModes: ["dine_in"],
  menuSchedule: null,
};
const regions = localeOptions();
const currencies = Intl.supportedValuesOf("currency");
const timezones = timezoneOptions();
export function OnboardingForm() {
  const router = useRouter();
  const [fields, setFields] = useState<Fields>(initial);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [persisted, setPersisted] = useState(false);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const reconciliation = useRef(false);
  const reconcile = useCallback(async () => {
    if (reconciliation.current) return;
    reconciliation.current = true;
    try {
      const res = await fetch("/api/onboarding", { cache: "no-store" });
      if (!res.ok) throw new Error("Unable to load saved progress.");
      const data = await res.json();
      if (data.status === "completed" && data.outletId) {
        router.replace("/dashboard/menu");
        router.refresh();
        return;
      }
      if (data.draft && Object.keys(data.draft).length) setFields({ ...initial, ...data.draft });
      setStatus(
        data.status === "provisioning"
          ? "An earlier request may have completed. Continue to reconcile without creating a duplicate."
          : data.key
            ? "Your saved setup was restored."
            : ""
      );
      setPersisted(Boolean(data.key));
      setReady(true);
    } catch {
      setError("Unable to restore your saved setup. Retry loading this page.");
    } finally {
      reconciliation.current = false;
    }
  }, [router]);
  useEffect(() => {
    void Promise.resolve().then(reconcile);
  }, [reconcile]);
  const save = useCallback((data: Fields) => {
    const operation = queue.current
      .catch(() => undefined)
      .then(async () => {
        const result = await fetch("/api/onboarding", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!result.ok)
          throw new Error(
            result.status === 409
              ? "A previous provisioning attempt must be reconciled before editing."
              : "Your progress could not be saved. Retry before leaving."
          );
        setPersisted(true);
      });
    queue.current = operation;
    return operation;
  }, []);
  useEffect(() => {
    if (!ready) return;
    const timeout = window.setTimeout(() => {
      void save(fields).catch((e) => setError(e instanceof Error ? e.message : "Unable to save."));
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [fields, ready, save]);
  const set = <K extends keyof Fields>(key: K, value: Fields[K]) => {
    setPersisted(false);
    setError("");
    setFields((previous) => ({ ...previous, [key]: value }));
  };
  return (
    <form
      className="product stack"
      aria-busy={busy}
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy || !ready) return;
        setError("");
        setBusy(true);
        try {
          if (!fields.fulfillmentModes.length)
            throw new Error("Choose at least one fulfillment mode.");
          if (fields.name.trim().length < 2) throw new Error("Enter an outlet name.");
          await save(fields);
          const response = await fetch("/api/onboarding", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: "{}",
          });
          const value = await response.json();
          if (!response.ok)
            throw new Error(
              value.message ||
                "Provisioning did not finish. Resume to check the previous operation."
            );
          if (value.status === "completed") {
            router.replace("/dashboard/menu");
            router.refresh();
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : "Unable to finish setup.");
          await reconcile();
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="eyebrow">Your first outlet · saved securely to your account</p>
      <div className="panel stack">
        <h2>Business details</h2>
        <label className="field" htmlFor="onboarding-name">
          Outlet name
          <input
            id="onboarding-name"
            aria-label="Outlet name"
            autoComplete="organization"
            required
            minLength={2}
            maxLength={100}
            value={fields.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </label>
        <label className="field" htmlFor="outletType">
          Outlet type
        </label>
        <select
          id="outletType"
          value={fields.outletType}
          onChange={(e) => {
            const type = e.target.value;
            setFields((previous) => ({
              ...previous,
              outletType: type,
              fulfillmentModes: ["cafe", "takeout", "cloud_kitchen"].includes(type)
                ? ["pickup"]
                : ["dine_in"],
            }));
          }}
        >
          {["restaurant", "cafe", "takeout", "cloud_kitchen", "hotel", "mixed"].map((x) => (
            <option key={x} value={x}>
              {x.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </div>
      <div className="panel stack">
        <h2>Country and local settings</h2>
        <p>
          Select where this outlet operates. Billing currency is separate from your menu currency.
        </p>
        <label className="field" htmlFor="onboarding-country">
          Country
        </label>
        <select
          id="onboarding-country"
          name="country"
          value={fields.country}
          onChange={(e) => {
            const country = e.target.value;
            setFields((previous) => ({
              ...previous,
              country,
              currency: currencyFor[country] ?? previous.currency,
            }));
          }}
        >
          {regions.map((r) => (
            <option key={r.code} value={r.code}>
              {r.label} ({r.code})
            </option>
          ))}
        </select>
        <label className="field" htmlFor="currency">
          Currency
        </label>
        <select
          id="currency"
          name="currency"
          value={fields.currency}
          onChange={(e) => set("currency", e.target.value)}
        >
          {currencies.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <label className="field" htmlFor="timezone">
          Timezone
        </label>
        <select
          id="timezone"
          name="timezone"
          value={fields.timezone}
          onChange={(e) => set("timezone", e.target.value)}
        >
          {timezones.map((v) => (
            <option key={v} value={v}>
              {v.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </div>
      <section className="panel stack">
        <h2>Service and hours</h2>
        {["dine_in", "pickup"].map((m) => (
          <label key={m} className="row">
            <input
              type="checkbox"
              checked={fields.fulfillmentModes.includes(m)}
              disabled={m === "dine_in" && ["takeout", "cloud_kitchen"].includes(fields.outletType)}
              onChange={(e) =>
                set(
                  "fulfillmentModes",
                  e.target.checked
                    ? [...fields.fulfillmentModes, m]
                    : fields.fulfillmentModes.filter((x) => x !== m)
                )
              }
            />
            {m === "dine_in" ? "Dine-in" : "Pickup"}
          </label>
        ))}
        <details>
          <summary>First menu service hours (optional)</summary>
          <ScheduleEditor
            value={fields.menuSchedule}
            onChange={(value) => set("menuSchedule", value)}
          />
        </details>
      </section>
      <p role="status" aria-live="polite">
        {!ready
          ? "Restoring progress…"
          : busy
            ? "Checking saved operation…"
            : persisted
              ? "Saved to your account."
              : status}
      </p>
      {error && (
        <p className="error" role="alert" tabIndex={-1}>
          {error}
        </p>
      )}
      <button className="ember" disabled={!ready || busy || fields.fulfillmentModes.length === 0}>
        {busy ? "Creating…" : "Create organization and outlet"}
      </button>
      <p>
        Interrupted requests are reconciled with your saved operation; repeated clicks cannot create
        duplicate outlets.
      </p>
    </form>
  );
}
