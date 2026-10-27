"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { canonicalOutletTimezone, outletLocalClock } from "@/lib/outlet-timezones";

export function OutletTimezonePicker({
  value,
  onChange,
  id,
  name,
}: {
  value: string;
  onChange: (timezone: string) => void;
  id: string;
  name?: string;
}) {
  const searchId = useId();
  const selectId = useId();
  const [options, setOptions] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [failure, setFailure] = useState("");
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState<Date | null>(null);
  const canonical = canonicalOutletTimezone(value);
  const supported = options.includes(canonical);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/outlet-timezones", {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Unable to verify available timezones");
        const body: unknown = await response.json();
        if (!body || typeof body !== "object" || !("options" in body) || !Array.isArray(body.options)
          || !body.options.every((entry: unknown) => typeof entry === "string")) {
          throw new Error("Invalid timezone registry response");
        }
        const available = body.options as string[];
        setOptions(available);
        if (available.includes(canonical) && canonical !== value) onChange(canonical);
        setFailure("");
      } catch {
        if (!controller.signal.aborted) setFailure("Cannot verify operating timezones. Reload before saving.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
    // Load once per mounted editor. The registry does not change with the selected zone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const interval = window.setInterval(update, 60_000);
    return () => window.clearInterval(interval);
  }, []);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return options.filter((option) => option === canonical || option.toLowerCase().includes(query));
  }, [options, search, canonical]);

  return (
    <div className="wizard-field-group">
      <label className="wizard-label" htmlFor={selectId}>Operating timezone *</label>
      <label className="wizard-label" htmlFor={searchId}>Search by city or region</label>
      <input id={searchId} type="search" className="wizard-select" value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search city or region" autoComplete="off" />
      <select id={selectId} name={name} className="wizard-select oh-control" value={supported ? canonical : ""}
        onChange={(event) => onChange(event.target.value)}
        disabled={loading || Boolean(failure)}
        required aria-invalid={!loading && !supported}
        aria-describedby={selectId + "-help"}>
        <option value="" disabled>{loading ? "Verifying timezones…" : "Choose a supported timezone"}</option>
        {filtered.map((timezone) => (
          <option key={timezone} value={timezone}>{timezone.replaceAll("_", " ")}</option>
        ))}
      </select>
      <p id={selectId + "-help"} className="wizard-counter" role="status">
        {failure || (!loading && !supported
          ? "Your saved timezone needs confirmation. Choose an available city or region."
          : now && supported ? "Restaurant local time: " + outletLocalClock(canonical, now)
          : "Time is verified against the operating database.")}
      </p>
    </div>
  );
}
