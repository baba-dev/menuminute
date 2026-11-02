"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  ClipboardList,
  MapPin,
  Palette,
  RefreshCw,
  Save,
  Settings2,
  Store,
  Mail,
  Clock3,
  Navigation,
  ReceiptText,
} from "lucide-react";
import type { OutletProfileFields } from "@/modules/restaurants/profile";
import { OutletTimezonePicker } from "@/components/onboarding/timezone-picker";
import { SettingsScopeNav } from "@/components/settings/settings-scope-nav";
import { canonicalOutletTimezone } from "@/lib/outlet-timezones";
import { localeOptions } from "@/modules/onboarding/locales";
type Outlet = {
  name: string;
  slug: string;
  publicId: string;
  country: string;
  currency: string;
  timezone: string;
  outletType: string;
  fulfillmentModes: string[];
  isActive: boolean;
  isDemoData: boolean;
  profileVersion: number;
};
type Props = {
  organizationId: string;
  organizationVersion: number;
  outletId: string;
  outlet: Outlet;
  initial: OutletProfileFields;
  canManage: boolean;
};
const normalize = (fields: OutletProfileFields): OutletProfileFields => ({
  ...fields,
  description: fields.description?.trim() || null,
  phone: fields.phone?.trim() || null,
  email: fields.email?.trim() || null,
  website: fields.website?.trim() || null,
  addressLine1: fields.addressLine1?.trim() || null,
  addressLine2: fields.addressLine2?.trim() || null,
  city: fields.city?.trim() || null,
  state: fields.state?.trim() || null,
  postalCode: fields.postalCode?.trim() || null,
  latitude:
    fields.latitude !== null &&
    fields.latitude !== undefined &&
    Number.isFinite(Number(fields.latitude))
      ? Number(fields.latitude)
      : null,
  longitude:
    fields.longitude !== null &&
    fields.longitude !== undefined &&
    Number.isFinite(Number(fields.longitude))
      ? Number(fields.longitude)
      : null,
});
const safeColor = (v: string | null | undefined, fallback: string) =>
  /^#[0-9a-fA-F]{6}$/.test(v || "") ? v! : fallback;
const anchors = [
  { id: "operations", label: "Outlet essentials", Icon: ClipboardList },
  { id: "profile", label: "Restaurant profile", Icon: Store },
  { id: "contact", label: "Contact & location", Icon: MapPin },
  { id: "branding", label: "Brand appearance", Icon: Palette },
  { id: "pickup", label: "Pickup scheduling", Icon: Clock3 },
];

type OperationalDraft = Pick<
  Outlet,
  "name" | "country" | "currency" | "timezone" | "outletType" | "fulfillmentModes"
>;

function OutletOperationsForm({
  organizationId,
  organizationVersion,
  outletId,
  outlet,
  canManage,
}: {
  organizationId: string;
  organizationVersion: number;
  outletId: string;
  outlet: Outlet;
  canManage: boolean;
}) {
  const router = useRouter();
  const initial = useMemo<OperationalDraft>(
    () => ({
      name: outlet.name,
      country: outlet.country,
      currency: outlet.currency,
      timezone: canonicalOutletTimezone(outlet.timezone),
      outletType: outlet.outletType,
      fulfillmentModes: outlet.fulfillmentModes,
    }),
    [outlet]
  );
  const [draft, setDraft] = useState(initial);
  const [version, setVersion] = useState(organizationVersion);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const countries = useMemo(() => localeOptions(), []);
  const currencies = useMemo(() => Intl.supportedValuesOf("currency"), []);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const setTimezone = useCallback(
    (timezone: string) => setDraft((current) => ({ ...current, timezone })),
    []
  );
  const toggleMode = (mode: string, checked: boolean) =>
    setDraft((current) => ({
      ...current,
      fulfillmentModes: checked
        ? [...new Set([...current.fulfillmentModes, mode])]
        : current.fulfillmentModes.filter((entry) => entry !== mode),
    }));

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || busy || !dirty || draft.fulfillmentModes.length === 0) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key: crypto.randomUUID(),
          expectedVersion: version,
          command: {
            action: "outlet.update",
            data: { outletId, ...draft },
          },
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 409)
          throw new Error("These outlet settings changed elsewhere. Reload before saving again.");
        throw new Error(body?.message || "Unable to save outlet essentials.");
      }
      setVersion(typeof body?.version === "number" ? body.version : version + 1);
      setMessage("Outlet essentials saved.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save outlet essentials.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="os-edit-form">
      <fieldset disabled={!canManage || busy} className="os-form-fields">
        <label className="os-field">
          <span>Outlet name</span>
          <input
            value={draft.name}
            minLength={2}
            maxLength={100}
            required
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
        </label>
        <div className="os-fields-two">
          <label className="os-field">
            <span>Country code</span>
            <select
              value={draft.country}
              required
              onChange={(event) => setDraft({ ...draft, country: event.target.value })}
            >
              {countries.map(({ code, label }) => (
                <option key={code} value={code}>
                  {label} ({code})
                </option>
              ))}
            </select>
            <small>The operating country is separate from currency and timezone.</small>
          </label>
          <label className="os-field">
            <span>Transaction currency</span>
            <select
              value={draft.currency}
              required
              onChange={(event) => setDraft({ ...draft, currency: event.target.value })}
            >
              {currencies.map((currency) => (
                <option key={currency}>{currency}</option>
              ))}
            </select>
            <small>Changing currency may require menu repricing.</small>
          </label>
        </div>
        <div className="os-field">
          <OutletTimezonePicker
            id="settings-outlet-timezone"
            value={draft.timezone}
            onChange={setTimezone}
          />
          <small>Used for future schedules, service days and reports; history is unchanged.</small>
        </div>
        <label className="os-field">
          <span>Outlet type</span>
          <select
            value={draft.outletType}
            onChange={(event) => {
              const outletType = event.target.value;
              setDraft({
                ...draft,
                outletType,
                fulfillmentModes: ["takeout", "cloud_kitchen"].includes(outletType)
                  ? ["pickup"]
                  : draft.fulfillmentModes,
              });
            }}
          >
            {[
              ["restaurant", "Restaurant / diner"],
              ["cafe", "Cafe / quick service"],
              ["takeout", "Takeout"],
              ["cloud_kitchen", "Cloud kitchen"],
              ["hotel", "Hotel / food service"],
              ["mixed", "Other / mixed"],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="os-field">
          <legend>Fulfillment modes</legend>
          <div className="os-fields-two">
            {(
              [
                ["dine_in", "Dine-in"],
                ["pickup", "Pickup / takeout"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="os-check">
                <input
                  type="checkbox"
                  checked={draft.fulfillmentModes.includes(value)}
                  onChange={(event) => toggleMode(value, event.target.checked)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
          {draft.fulfillmentModes.length === 0 && (
            <small role="alert">Choose at least one mode.</small>
          )}
        </fieldset>
      </fieldset>
      <div className="os-savebar">
        <div>
          <strong>
            {canManage
              ? dirty
                ? "Unsaved operational changes"
                : "Outlet essentials saved"
              : "View only"}
          </strong>
          <small>Public profile fields are saved separately below.</small>
        </div>
        {canManage && (
          <button
            className="os-save"
            type="submit"
            disabled={!dirty || busy || draft.fulfillmentModes.length === 0}
          >
            <Save size={16} /> {busy ? "Saving…" : "Save essentials"}
          </button>
        )}
      </div>
      {message && (
        <p className="os-success" role="status">
          <Check size={16} />
          {message}
        </p>
      )}
      {error && (
        <p className="os-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
export function OutletAtelier({
  organizationId,
  organizationVersion,
  outletId,
  outlet,
  initial,
  canManage,
}: Props) {
  const [saved, setSaved] = useState<OutletProfileFields>(() => normalize(initial));
  const [draft, setDraft] = useState<OutletProfileFields>(() => normalize(initial));
  const [version, setVersion] = useState(outlet.profileVersion);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const controller = useRef<AbortController | null>(null);
  const bypassUnload = useRef(false);
  const current = normalize(draft);
  const dirty = JSON.stringify(current) !== JSON.stringify(saved);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty || bypassUnload.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => () => controller.current?.abort(), []);
  const display = useMemo(
    () => ({
      primary: safeColor(draft.primaryColor, "#f97316"),
      secondary: safeColor(draft.secondaryColor, "#1c1917"),
    }),
    [draft.primaryColor, draft.secondaryColor]
  );
  function change<K extends keyof OutletProfileFields>(key: K, value: OutletProfileFields[K]) {
    setDraft((old) => ({ ...old, [key]: value }));
    setNotice("");
    setError("");
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canManage || !dirty || busy) return;
    const normalized = normalize(draft);
    setBusy(true);
    setError("");
    setNotice("");
    const abort = new AbortController();
    controller.current = abort;
    try {
      const response = await fetch(
        "/api/organizations/" +
          encodeURIComponent(organizationId) +
          "/outlets/" +
          encodeURIComponent(outletId) +
          "/profile",
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ expectedVersion: version, fields: normalized }),
          signal: abort.signal,
        }
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 409)
          throw new Error(
            "The outlet profile changed elsewhere. Review the latest version before saving again."
          );
        throw new Error(body?.message || "Unable to save the outlet profile.");
      }
      const next = normalize(body.fields as OutletProfileFields);
      setSaved(next);
      setDraft(next);
      setVersion(body.profileVersion);
      setNotice("Profile saved successfully.");
    } catch (cause) {
      if (!abort.signal.aborted)
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to confirm the save. Refresh to verify the current profile."
        );
    } finally {
      if (controller.current === abort) {
        controller.current = null;
        setBusy(false);
      }
    }
  }
  const input = (
    key: keyof OutletProfileFields,
    label: string,
    options?: { type?: string; placeholder?: string; max?: number; help?: string }
  ) => (
    <label className="os-field" key={key}>
      <span>{label}</span>
      <input
        name={key}
        type={options?.type || "text"}
        value={String(draft[key] || "")}
        maxLength={options?.max}
        placeholder={options?.placeholder}
        disabled={!canManage || busy}
        onChange={(e) => change(key, e.target.value)}
      />
      {options?.help && <small>{options.help}</small>}
    </label>
  );
  return (
    <div className="product mm-settings" data-testid="outlet-atelier">
      <div className="os-scope-nav">
        <SettingsScopeNav />
      </div>
      <header className="os-hero">
        <div className="os-hero-copy">
          <span className="os-eyebrow">OUTLET SETTINGS</span>
          <h1>{outlet.name}</h1>
          <p>Operational essentials and the public details guests see for this location.</p>
          <div className="os-hero-actions">
            <a className="os-action os-action-primary" href="#profile">
              Edit public profile <ArrowRight size={17} aria-hidden="true" />
            </a>
            <a className="os-action" href="/dashboard/settings/tax">
              Sales tax preferences <ReceiptText size={17} aria-hidden="true" />
            </a>
          </div>
        </div>
        <div className="os-hero-art" aria-hidden="true">
          <span className="os-art-ring" />
          <span className="os-art-card">
            <span className="os-art-symbol">
              <Store size={34} />
            </span>
            <span className="os-art-line" />
            <span className="os-art-line os-art-short" />
            <span className="os-art-swatches">
              <i />
              <i />
              <i />
            </span>
          </span>
          <span className="os-art-pencil" />
          <span className="os-art-star" />
        </div>
      </header>
      <div className="os-body">
        <section className="os-pulse" aria-label="Current outlet overview">
          <div>
            <span className="os-eyebrow">CURRENT OUTLET</span>
            <strong>{outlet.name}</strong>
            <small>
              {outlet.isDemoData
                ? "Demo outlet"
                : outlet.isActive
                  ? "Active workspace"
                  : "Inactive outlet"}
            </small>
          </div>
          <div>
            <span className="os-eyebrow">GUEST CURRENCY</span>
            <strong>{outlet.currency}</strong>
            <small>Existing prices remain unchanged</small>
          </div>
          <div>
            <span className="os-eyebrow">LOCAL TIMEZONE</span>
            <strong>{outlet.timezone}</strong>
            <small>
              {outlet.country} · {outlet.outletType.replaceAll("_", " ")}
            </small>
          </div>
          <div>
            <span className="os-eyebrow">PROFILE ACCESS</span>
            <strong>{canManage ? "Editor" : "View only"}</strong>
            <small>{canManage ? "Authorized outlet management" : "Ask your outlet manager"}</small>
          </div>
        </section>
        <div className="os-workspace">
          <nav className="os-contents" aria-label="Settings sections">
            <span className="os-eyebrow">YOUR SETTINGS</span>
            {anchors.map(({ id, label, Icon }, i) => (
              <a key={id} href={"#" + id}>
                <Icon size={17} aria-hidden="true" />
                <span>{label}</span>
                <small>{String(i + 1).padStart(2, "0")}</small>
              </a>
            ))}
            <div className="os-contents-note">
              <Settings2 size={18} aria-hidden="true" />
              <p>Operational changes are linked to the appropriate guarded settings pages.</p>
            </div>
          </nav>
          <div className="os-sections">
            <section id="operations" className="os-panel" aria-labelledby="os-operations-title">
              <div className="os-panel-head">
                <span className="os-panel-icon">
                  <ClipboardList size={20} />
                </span>
                <div>
                  <span className="os-eyebrow">01 / OUTLET ESSENTIALS</span>
                  <h2 id="os-operations-title">Operational identity.</h2>
                  <p>Name, geography and service model for this location.</p>
                </div>
              </div>
              <OutletOperationsForm
                organizationId={organizationId}
                organizationVersion={organizationVersion}
                outletId={outletId}
                outlet={outlet}
                canManage={canManage}
              />
              <dl className="os-info-grid">
                <div>
                  <dt>Permanent public ID</dt>
                  <dd>{outlet.publicId}</dd>
                </div>
                <div>
                  <dt>URL slug</dt>
                  <dd>{outlet.slug}</dd>
                </div>
              </dl>
            </section>
            <form onSubmit={save} className="os-edit-form">
              <section id="profile" className="os-panel" aria-labelledby="os-profile-title">
                <div className="os-panel-head">
                  <span className="os-panel-icon">
                    <Store size={20} />
                  </span>
                  <div>
                    <span className="os-eyebrow">01 / THE ESSENTIALS</span>
                    <h2 id="os-profile-title">Restaurant profile.</h2>
                    <p>The details your guests recognize.</p>
                  </div>
                </div>
                <p className="os-fine">
                  Outlet name: <strong>{outlet.name}</strong>. Change it in Outlet essentials above.
                </p>
                <div className="os-field">
                  <label htmlFor="os-description">Description</label>
                  <textarea
                    id="os-description"
                    name="description"
                    value={draft.description || ""}
                    maxLength={500}
                    rows={4}
                    disabled={!canManage || busy}
                    onChange={(e) => change("description", e.target.value)}
                    placeholder="What makes your restaurant special?"
                  />
                  <small>
                    {(draft.description || "").length}/500 characters · Public restaurant
                    description. Your menu uses it when no custom hero headline is set, or in the
                    About section.
                  </small>
                </div>
              </section>
              <section id="contact" className="os-panel" aria-labelledby="os-contact-title">
                <div className="os-panel-head">
                  <span className="os-panel-icon">
                    <MapPin size={20} />
                  </span>
                  <div>
                    <span className="os-eyebrow">02 / STAY CONNECTED</span>
                    <h2 id="os-contact-title">Contact & location.</h2>
                    <p>Help guests find and reach you.</p>
                  </div>
                </div>
                <div className="os-fields-two">
                  {input("phone", "Public phone", {
                    type: "tel",
                    max: 40,
                    placeholder: "+91 00000 00000",
                  })}
                  {input("email", "Public email", {
                    type: "email",
                    max: 254,
                    placeholder: "hello@example.com",
                  })}
                </div>
                {input("website", "Website URL", {
                  type: "url",
                  max: 512,
                  placeholder: "https://example.com",
                  help: "Use a complete HTTP or HTTPS address.",
                })}
                {input("addressLine1", "Address line 1", {
                  max: 180,
                  placeholder: "Street address, building",
                })}
                {input("addressLine2", "Address line 2", {
                  max: 180,
                  placeholder: "Floor, landmark (optional)",
                })}
                <div className="os-fields-two">
                  {input("city", "City", { max: 100 })}
                  {input("state", "State / region", { max: 100 })}
                  {input("postalCode", "Postal code", { max: 24 })}
                </div>
                <div className="os-fields-two">
                  <label className="os-field">
                    <span
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span>Latitude (-90 to +90)</span>
                      <button
                        type="button"
                        className="os-chip"
                        style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem", cursor: "pointer" }}
                        disabled={!canManage || busy}
                        onClick={() => {
                          if (typeof navigator !== "undefined" && navigator.geolocation) {
                            navigator.geolocation.getCurrentPosition(
                              (pos) => {
                                change("latitude", Number(pos.coords.latitude.toFixed(7)));
                                change("longitude", Number(pos.coords.longitude.toFixed(7)));
                                setNotice(
                                  `Detected GPS: ±${Math.round(pos.coords.accuracy)}m. Confirm the pin matches your outlet, not just your device.`
                                );
                              },
                              () => {
                                setError(
                                  "Location permission denied or unavailable. Enter the outlet coordinates manually."
                                );
                              },
                              { timeout: 10000 }
                            );
                          }
                        }}
                      >
                        <Navigation size={12} style={{ display: "inline", marginRight: "4px" }} />{" "}
                        Detect GPS
                      </button>
                    </span>
                    <input
                      name="latitude"
                      type="number"
                      step="any"
                      value={draft.latitude ?? ""}
                      placeholder="e.g. 19.0760000"
                      disabled={!canManage || busy}
                      onChange={(e) =>
                        change(
                          "latitude",
                          e.target.value === "" ? null : parseFloat(e.target.value)
                        )
                      }
                    />
                  </label>
                  <label className="os-field">
                    <span>Longitude (-180 to +180)</span>
                    <input
                      name="longitude"
                      type="number"
                      step="any"
                      value={draft.longitude ?? ""}
                      placeholder="e.g. 72.8777000"
                      disabled={!canManage || busy}
                      onChange={(e) =>
                        change(
                          "longitude",
                          e.target.value === "" ? null : parseFloat(e.target.value)
                        )
                      }
                    />
                  </label>
                </div>
                <p className="os-fine">
                  <Mail size={15} /> The public phone, email, website, address and saved map pin can
                  appear on your published menu. Only enter guest-facing business details; private
                  operational contacts and account recovery details are not published.
                </p>
              </section>
              <section id="branding" className="os-panel" aria-labelledby="os-brand-title">
                <div className="os-panel-head">
                  <span className="os-panel-icon">
                    <Palette size={20} />
                  </span>
                  <div>
                    <span className="os-eyebrow">03 / VISUAL IDENTITY</span>
                    <h2 id="os-brand-title">Brand appearance.</h2>
                    <p>Choose colors that make your outlet unmistakable.</p>
                  </div>
                </div>
                <div
                  className="os-brand-preview"
                  style={{ background: display.secondary, color: "#fff" }}
                >
                  <div className="os-preview-mark" style={{ background: display.primary }}>
                    <Store size={20} aria-hidden="true" />
                  </div>
                  <span>RESTAURANT PREVIEW</span>
                  <strong>{outlet.name}</strong>
                  <p>{draft.description || "Your story begins here."}</p>
                  <i style={{ background: display.primary }} />
                </div>
                <div className="os-fields-two">
                  {(["primaryColor", "secondaryColor"] as const).map((key) => (
                    <label className="os-field" key={key}>
                      <span>{key === "primaryColor" ? "Primary color" : "Secondary color"}</span>
                      <div className="os-color-control">
                        <input
                          aria-label={
                            key === "primaryColor"
                              ? "Choose primary color"
                              : "Choose secondary color"
                          }
                          type="color"
                          value={key === "primaryColor" ? display.primary : display.secondary}
                          disabled={!canManage || busy}
                          onChange={(e) => change(key, e.target.value)}
                        />
                        <input
                          type="text"
                          aria-label={
                            key === "primaryColor" ? "Primary hex color" : "Secondary hex color"
                          }
                          pattern="#[a-fA-F0-9]{6}"
                          maxLength={7}
                          value={draft[key] || ""}
                          disabled={!canManage || busy}
                          onChange={(e) => change(key, e.target.value)}
                        />
                      </div>
                    </label>
                  ))}
                </div>
                <p className="os-fine">
                  Preview is illustrative. The published menu uses its own release and styling
                  rules.
                </p>
              </section>
              {outlet.fulfillmentModes.includes("pickup") && (
                <section id="pickup" className="os-panel" aria-labelledby="os-pickup-title">
                  <div className="os-panel-head">
                    <span className="os-panel-icon">
                      <Clock3 size={20} />
                    </span>
                    <div>
                      <span className="os-eyebrow">04 / PICKUP PROMISE</span>
                      <h2 id="os-pickup-title">Pickup scheduling.</h2>
                      <p>Set the booking window guests can actually choose.</p>
                    </div>
                  </div>
                  <div className="os-fields-two">
                    {(
                      [
                        ["pickupLeadMinutes", "Minimum preparation time", 0, 240, "minutes"],
                        ["pickupSlotMinutes", "Pickup slot interval", 5, 120, "minutes"],
                        ["pickupAdvanceDays", "Advance booking window", 1, 30, "days"],
                      ] as const
                    ).map(([key, label, min, max, unit]) => (
                      <label className="os-field" key={key}>
                        <span>{label}</span>
                        <input
                          type="number"
                          min={min}
                          max={max}
                          step={1}
                          value={draft[key]}
                          disabled={!canManage || busy}
                          onChange={(event) => change(key, Number(event.target.value))}
                        />
                        <small>{unit} · validated again when the guest submits</small>
                      </label>
                    ))}
                  </div>
                </section>
              )}
              <div className="os-savebar">
                <div>
                  <strong>
                    {!canManage
                      ? "View-only profile"
                      : dirty
                        ? "Unsaved changes"
                        : "All profile edits saved"}
                  </strong>
                  <small>
                    {canManage
                      ? "Profile version " + version
                      : "Only authorized outlet managers may edit this profile."}
                  </small>
                </div>
                {canManage && (
                  <div className="os-savebar-actions">
                    <button
                      type="button"
                      className="os-reset"
                      disabled={!dirty || busy}
                      onClick={() => {
                        setDraft(saved);
                        setError("");
                        setNotice("");
                      }}
                    >
                      Discard
                    </button>
                    <button type="submit" className="os-save" disabled={!dirty || busy}>
                      <Save size={16} />
                      {busy ? "Saving…" : "Save profile"}
                    </button>
                  </div>
                )}
              </div>
              {notice && (
                <p role="status" className="os-success">
                  <Check size={16} />
                  {notice}
                </p>
              )}
              {error && (
                <div role="alert" className="os-error">
                  <span>{error}</span>
                  <button
                    type="button"
                    onClick={() => {
                      bypassUnload.current = true;
                      window.location.reload();
                    }}
                  >
                    <RefreshCw size={15} /> Reload latest
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
