"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { ComboList, FieldError } from "./combo-list";
import { putMenu } from "./menu-request";
import {
  SLOT_KINDS,
  SLOT_LABEL,
  checkOverrideDate,
  formatLocalDate,
  overrideWindow,
  zonedToday,
  type ComboRef,
  type OverrideView,
  type SlotKind,
} from "./week-form";

type Props = {
  outletId: string;
  timezone: string;
  /** Outlet-local today as computed by the server; the client re-derives it on submit. */
  today: string;
  combos: ComboRef[];
  archivedCombos: ComboRef[];
  overrides: OverrideView[];
  /** Meals with a stored slot row; the server rejects overrides for any other meal. */
  configuredKinds: SlotKind[];
};

const noopSubscribe = () => () => {};
function useLocale(): string | undefined {
  return useSyncExternalStore(
    noopSubscribe,
    () => (typeof navigator === "undefined" ? undefined : navigator.language),
    () => undefined
  );
}

const sortOverrides = (list: OverrideView[]) =>
  [...list].sort(
    (a, b) => a.localDate.localeCompare(b.localDate) || a.slotKind.localeCompare(b.slotKind)
  );
const sameKey = (a: OverrideView, date: string, slot: SlotKind) =>
  a.localDate === date && a.slotKind === slot;

export function OverridesEditor({
  outletId,
  timezone,
  today,
  combos,
  archivedCombos,
  overrides,
  configuredKinds,
}: Props) {
  const locale = useLocale();
  const allCombos = [...combos, ...archivedCombos.map((c) => ({ ...c, archived: true }))];
  const [list, setList] = useState(() => sortOverrides(overrides));
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState<SlotKind>(configuredKinds[0] ?? "lunch");
  const [mode, setMode] = useState<"close" | "replace">("close");
  const [ids, setIds] = useState<string[]>([]);
  const [dateError, setDateError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [announce, setAnnounce] = useState("");
  const [headingFocus, setHeadingFocus] = useState(0);
  useEffect(() => {
    if (headingFocus) listHeadingRef.current?.focus();
  }, [headingFocus]);
  const busyRef = useRef(false);
  const dateRef = useRef<HTMLInputElement>(null);
  const formErrorRef = useRef<HTMLParagraphElement>(null);
  const listHeadingRef = useRef<HTMLHeadingElement>(null);

  const range = overrideWindow(today);
  const existing = date ? list.find((o) => sameKey(o, date, slot)) : undefined;
  const nameOf = (id: string) => allCombos.find((c) => c.id === id)?.name ?? "Unknown combo";

  const [focusReq, setFocusReq] = useState<{ n: number; target: "date" | "form" } | null>(null);
  useEffect(() => {
    if (!focusReq) return;
    (focusReq.target === "date" ? dateRef : formErrorRef).current?.focus();
  }, [focusReq]);
  function fail(message: string, target?: "date") {
    if (target === "date") setDateError(message);
    else setFormError(message);
    setFocusReq((r) => ({ n: (r?.n ?? 0) + 1, target: target ?? "form" }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busyRef.current) return;
    setNotice("");
    setDateError("");
    setFormError("");
    if (!configuredKinds.includes(slot)) {
      return fail(`Save ${slot} meal times first (in Meal times above).`);
    }
    const problem = checkOverrideDate(date, zonedToday(new Date(), timezone));
    if (problem) return fail(problem, "date");
    if (mode === "replace" && ids.length === 0) {
      return fail("Choose at least one combo, or close this day instead.");
    }
    busyRef.current = true;
    setSaving(true);
    const body = {
      slotKind: slot,
      localDate: date,
      closed: mode === "close",
      comboIds: mode === "close" ? [] : ids,
    };
    const result = await putMenu(outletId, { kind: "override", override: body });
    busyRef.current = false;
    setSaving(false);
    if (!result.ok) return fail(result.message);
    const saved: OverrideView = { ...body };
    setList((current) => sortOverrides([...current.filter((o) => !sameKey(o, date, slot)), saved]));
    const text = `Saved ${SLOT_LABEL[slot].toLowerCase()} on ${formatLocalDate(date, locale)}: ${
      mode === "close" ? "closed" : "menu replaced"
    }.`;
    setNotice(text);
    setAnnounce(text);
    setIds([]);
  }

  async function clear(o: OverrideView) {
    if (busyRef.current) return;
    const key = `${o.localDate}:${o.slotKind}`;
    busyRef.current = true;
    setBusyKey(key);
    setNotice("");
    setRowErrors(({ [key]: _drop, ...rest }) => rest);
    const result = await putMenu(outletId, {
      kind: "overrideClear",
      override: { slotKind: o.slotKind, localDate: o.localDate, clear: true },
    });
    busyRef.current = false;
    setBusyKey(null);
    if (!result.ok) {
      setRowErrors((current) => ({ ...current, [key]: result.message }));
      return;
    }
    setList((current) => current.filter((x) => !sameKey(x, o.localDate, o.slotKind)));
    const text = `Cleared ${SLOT_LABEL[o.slotKind].toLowerCase()} on ${formatLocalDate(o.localDate, locale)}. The weekly menu applies again.`;
    setNotice(text);
    setAnnounce(text);
    setFocusReq(null);
    setHeadingFocus((n) => n + 1);
  }

  return (
    <section className="tiffin-overrides" aria-labelledby="overrides-title">
      <h2 id="overrides-title" ref={listHeadingRef} tabIndex={-1}>
        Special dates
      </h2>
      <p className="tiffin-muted">
        Close a meal on a specific date or replace its menu for that day. Dates are in the outlet’s
        timezone ({timezone}); you can choose from {range.min} to {range.max}.
      </p>
      <div className="tiffin-sr" role="status" aria-live="polite">
        {announce}
      </div>
      {notice && (
        <p className="tiffin-notice" role="status">
          {notice}
        </p>
      )}

      <form
        className="tiffin-form"
        onSubmit={submit}
        noValidate
        aria-labelledby="override-form-title"
      >
        <h3 id="override-form-title">Add or change a special date</h3>
        <div className="tiffin-slot-fields">
          <div className="tiffin-field">
            <label htmlFor="override-date">Date</label>
            <input
              id="override-date"
              ref={dateRef}
              type="date"
              value={date}
              min={range.min}
              max={range.max}
              disabled={saving}
              aria-invalid={dateError ? true : undefined}
              aria-describedby={dateError ? "override-date-error" : undefined}
              onChange={(e) => {
                setDate(e.target.value);
                setDateError("");
              }}
            />
            <FieldError id="override-date-error" message={dateError} />
          </div>
          <div className="tiffin-field">
            <label htmlFor="override-slot">Meal</label>
            <select
              id="override-slot"
              value={slot}
              disabled={saving}
              aria-describedby={configuredKinds.includes(slot) ? undefined : "override-slot-hint"}
              onChange={(e) => setSlot(e.target.value as SlotKind)}
            >
              {SLOT_KINDS.map((kind) => (
                <option key={kind} value={kind} disabled={!configuredKinds.includes(kind)}>
                  {SLOT_LABEL[kind]}
                  {configuredKinds.includes(kind) ? "" : " (save meal times first)"}
                </option>
              ))}
            </select>
            {!configuredKinds.includes(slot) && (
              <p className="tiffin-hint" id="override-slot-hint">
                Save {slot} meal times first (in Meal times above).
              </p>
            )}
          </div>
        </div>
        <fieldset className="tiffin-fieldset">
          <legend>What happens on this day</legend>
          <label className="tiffin-check">
            <input
              type="radio"
              name="override-mode"
              checked={mode === "close"}
              disabled={saving}
              onChange={() => setMode("close")}
            />
            Close this day
          </label>
          <label className="tiffin-check">
            <input
              type="radio"
              name="override-mode"
              checked={mode === "replace"}
              disabled={saving}
              onChange={() => setMode("replace")}
            />
            Replace menu for this day
          </label>
        </fieldset>
        {mode === "replace" &&
          (combos.length === 0 ? (
            <p className="tiffin-muted">Create combos first to replace a menu.</p>
          ) : (
            <ComboList
              idPrefix="override"
              label="this special date"
              ids={ids}
              allCombos={allCombos}
              disabled={saving}
              describedBy={formError ? "override-form-error" : undefined}
              onChange={setIds}
              onAnnounce={setAnnounce}
            />
          ))}
        {existing && (
          <p className="tiffin-hint">
            This date and meal already has a special date. Saving replaces it.
          </p>
        )}
        {formError && (
          <p
            ref={formErrorRef}
            id="override-form-error"
            className="tiffin-form-error"
            role="alert"
            tabIndex={-1}
          >
            {formError}
          </p>
        )}
        <div className="tiffin-actions">
          <button type="submit" className="tiffin-btn tiffin-primary" disabled={saving}>
            {saving ? "Saving…" : "Save special date"}
          </button>
        </div>
      </form>

      {list.length === 0 ? (
        <div className="tiffin-empty">
          <h3>No special dates yet</h3>
          <p>Your weekly menu applies every day until you add one.</p>
        </div>
      ) : (
        <ul className="tiffin-list" aria-label="Existing special dates">
          {list.map((o) => {
            const key = `${o.localDate}:${o.slotKind}`;
            const errorId = `override-error-${key}`;
            const when = `${SLOT_LABEL[o.slotKind].toLowerCase()} on ${formatLocalDate(o.localDate, locale)}`;
            return (
              <li key={key} className="tiffin-combo">
                <div className="tiffin-combo-head">
                  <h3>
                    {formatLocalDate(o.localDate, locale)}, {SLOT_LABEL[o.slotKind]}
                  </h3>
                  <p className="tiffin-badge">{o.closed ? "Closed" : "Menu replaced"}</p>
                </div>
                {!o.closed && (
                  <p className="tiffin-items">
                    <span className="tiffin-label">Combos </span>
                    {o.comboIds.length ? o.comboIds.map(nameOf).join(", ") : "None"}
                  </p>
                )}
                <div className="tiffin-actions">
                  <button
                    type="button"
                    className="tiffin-btn"
                    disabled={busyKey === key}
                    aria-label={`Clear special date for ${when}`}
                    aria-describedby={rowErrors[key] ? errorId : undefined}
                    onClick={() => void clear(o)}
                  >
                    {busyKey === key ? "Clearing…" : "Clear"}
                  </button>
                </div>
                <FieldError id={errorId} message={rowErrors[key]} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
