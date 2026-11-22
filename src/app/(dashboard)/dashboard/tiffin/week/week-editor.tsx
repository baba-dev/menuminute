"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { ComboList, FieldError } from "./combo-list";
import { putMenu } from "./menu-request";
import {
  SLOT_KINDS,
  SLOT_LABEL,
  buildGrid,
  buildSlotPayload,
  cellKey,
  minutesToTime,
  orderedWeekdays,
  slotFor,
  validateWindow,
  weekdayName,
  type ComboRef,
  type SlotKind,
  type SlotView,
  type WeekEntry,
} from "./week-form";

type Props = {
  outletId: string;
  timezone: string;
  /** Non-archived combos, selectable in cells. */
  combos: ComboRef[];
  /** Archived combos, used only for naming. */
  archivedCombos: ComboRef[];
  slots: SlotView[];
  week: WeekEntry[];
  /** Called after a first successful slot save so sibling editors can enable that meal. */
  onSlotSaved?: (kind: SlotKind) => void;
};

const noopSubscribe = () => () => {};
/** The browser locale after hydration; undefined on the server so markup matches. */
function useLocale(): string | undefined {
  return useSyncExternalStore(
    noopSubscribe,
    () => (typeof navigator === "undefined" ? undefined : navigator.language),
    () => undefined
  );
}

const sameIds = (a: string[], b: string[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

function SlotPanel({
  outletId,
  stored,
  configured,
  onSaved,
  announce,
}: {
  outletId: string;
  stored: SlotView;
  /** False when no slot row is stored: the values are a proposal, not saved settings. */
  configured: boolean;
  onSaved: (slot: SlotView) => void;
  announce: (message: string) => void;
}) {
  const kind = stored.kind;
  const id = `slot-${kind}`;
  const [start, setStart] = useState(minutesToTime(stored.startMinute));
  const [end, setEnd] = useState(minutesToTime(stored.endMinute));
  const [enabled, setEnabled] = useState(stored.enabled);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [focusErr, setFocusErr] = useState(0);
  useEffect(() => {
    if (focusErr) errorRef.current?.focus();
  }, [focusErr]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (savingRef.current) return;
    setNotice("");
    const parsed = validateWindow(start, end);
    if (!parsed.ok) {
      setError(parsed.error);
      setFocusErr((n) => n + 1);
      return;
    }
    setError("");
    savingRef.current = true;
    setSaving(true);
    const result = await putMenu(outletId, {
      kind: "slot",
      slot: buildSlotPayload(stored, parsed, enabled),
    });
    savingRef.current = false;
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      setFocusErr((n) => n + 1);
      return;
    }
    const saved = result.data as unknown as SlotView;
    onSaved({ ...stored, ...saved, kind });
    setNotice(`${SLOT_LABEL[kind]} settings saved.`);
    announce(`${SLOT_LABEL[kind]} settings saved.`);
  }

  return (
    <form className="tiffin-slot" onSubmit={submit} noValidate aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>{SLOT_LABEL[kind]} settings</h3>
      {!configured && (
        <p className="tiffin-badge" id={`${id}-unsaved`}>
          Not saved yet — save meal times first. These times are a suggestion you can change.
        </p>
      )}
      <div className="tiffin-slot-fields">
        <div className="tiffin-field">
          <label htmlFor={`${id}-start`}>{SLOT_LABEL[kind]} start time</label>
          <input
            id={`${id}-start`}
            type="time"
            value={start}
            disabled={saving}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>
        <div className="tiffin-field">
          <label htmlFor={`${id}-end`}>{SLOT_LABEL[kind]} end time</label>
          <input
            id={`${id}-end`}
            type="time"
            value={end}
            disabled={saving}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>
      </div>
      <label className="tiffin-check">
        <input
          type="checkbox"
          checked={enabled}
          disabled={saving}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        {SLOT_LABEL[kind]} is on the menu
      </label>
      <dl className="tiffin-readonly">
        <div>
          <dt>Order cutoff</dt>
          <dd>
            {stored.cutoffMinutesBefore} minutes before the slot starts. Used when booking opens (a
            later step).
          </dd>
        </div>
        <div>
          <dt>Capacity</dt>
          <dd>
            {stored.capacity === null ? "Not set" : stored.capacity}. Used when booking opens (a
            later step).
          </dd>
        </div>
      </dl>
      {error && (
        <p
          ref={errorRef}
          id={`${id}-error`}
          className="tiffin-field-error"
          role="alert"
          tabIndex={-1}
        >
          {error}
        </p>
      )}
      <div className="tiffin-actions">
        <button type="submit" className="tiffin-btn tiffin-primary" disabled={saving}>
          {saving
            ? "Saving…"
            : configured
              ? `Save ${SLOT_LABEL[kind].toLowerCase()} settings`
              : `Save ${SLOT_LABEL[kind].toLowerCase()} meal times`}
        </button>
      </div>
      {notice && (
        <p className="tiffin-notice" role="status">
          {notice}
        </p>
      )}
    </form>
  );
}

export function WeekEditor({
  outletId,
  timezone,
  combos,
  archivedCombos,
  slots,
  week,
  onSlotSaved,
}: Props) {
  const locale = useLocale();
  const allCombos = [...combos, ...archivedCombos.map((c) => ({ ...c, archived: true }))];
  const [saved, setSaved] = useState(() => buildGrid(week, combos));
  const [draft, setDraft] = useState(saved);
  const [slotState, setSlotState] = useState(slots);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [announce, setAnnounce] = useState("");
  const savingRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const [focusCell, setFocusCell] = useState<{ key: string; n: number } | null>(null);
  useEffect(() => {
    if (!focusCell) return;
    rootRef.current?.querySelector<HTMLElement>(`[id="week-error-${focusCell.key}"]`)?.focus();
  }, [focusCell]);

  async function saveCell(slotKind: SlotKind, weekday: number) {
    const key = cellKey(slotKind, weekday);
    if (savingRef.current) return;
    const ids = draft[key]!;
    savingRef.current = true;
    setSavingKey(key);
    setNotice("");
    setErrors(({ [key]: _drop, ...rest }) => rest);
    const result = await putMenu(outletId, {
      kind: "week",
      week: { slotKind, weekday, comboIds: ids },
    });
    savingRef.current = false;
    setSavingKey(null);
    const name = `${weekdayName(weekday, locale)} ${SLOT_LABEL[slotKind].toLowerCase()}`;
    if (!result.ok) {
      setErrors((current) => ({ ...current, [key]: result.message }));
      setFocusCell((c) => ({ key, n: (c?.n ?? 0) + 1 }));
      return;
    }
    setSaved((current) => ({ ...current, [key]: ids }));
    setNotice(`Saved ${name}.`);
    setAnnounce(`Saved ${name}.`);
  }

  const isConfigured = (kind: SlotKind) => slotState.some((s) => s.kind === kind);
  const hasCombos = combos.length > 0;
  const days = orderedWeekdays(locale);

  return (
    <div ref={rootRef} className="tiffin-week">
      <div className="tiffin-sr" role="status" aria-live="polite">
        {announce}
      </div>
      <p className="tiffin-muted">Times are in the outlet’s timezone: {timezone}.</p>

      <section aria-labelledby="slots-title">
        <h2 id="slots-title">Meal times</h2>
        <div className="tiffin-slots">
          {SLOT_KINDS.map((kind) => {
            const stored = slotFor(slotState, kind);
            return (
              <SlotPanel
                key={`${kind}-${stored.startMinute}-${stored.endMinute}-${stored.enabled}`}
                outletId={outletId}
                stored={stored}
                configured={slotState.some((s) => s.kind === kind)}
                announce={setAnnounce}
                onSaved={(slot) => {
                  setSlotState((current) => [...current.filter((s) => s.kind !== kind), slot]);
                  onSlotSaved?.(kind);
                }}
              />
            );
          })}
        </div>
      </section>

      <section aria-labelledby="grid-title">
        <h2 id="grid-title">Weekly menu</h2>
        <p className="tiffin-muted">
          Choose the combos you offer for each meal on each weekday, in the order you want them
          shown. Save each meal after changing it. Dates you close or change below take priority.
        </p>
        {notice && (
          <p className="tiffin-notice" role="status">
            {notice}
          </p>
        )}
        {!hasCombos ? (
          <div className="tiffin-empty">
            <h3>Create combos first</h3>
            <p>
              Your weekly menu is built from your combos.{" "}
              <Link href="/dashboard/tiffin/combos">Go to combos</Link> to create one.
            </p>
          </div>
        ) : (
          <div className="tiffin-table-wrap">
            <table className="tiffin-grid">
              <caption className="tiffin-sr">Combos offered by weekday and meal</caption>
              <thead>
                <tr>
                  <th scope="col">Day</th>
                  {SLOT_KINDS.map((kind) => (
                    <th key={kind} scope="col">
                      {SLOT_LABEL[kind]}
                      {slotFor(slotState, kind).enabled ? "" : " (off the menu)"}
                      {!isConfigured(kind) && (
                        <span className="tiffin-hint" id={`week-needs-${kind}`}>
                          <br />
                          Save {kind} meal times first
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {days.map((weekday) => (
                  <tr key={weekday}>
                    <th scope="row">{weekdayName(weekday, locale)}</th>
                    {SLOT_KINDS.map((kind) => {
                      const key = cellKey(kind, weekday);
                      const ids = draft[key]!;
                      const dirty = !sameIds(ids, saved[key]!);
                      const busy = savingKey === key;
                      const needsSlot = !isConfigured(kind);
                      const label = `${weekdayName(weekday, locale)} ${SLOT_LABEL[kind].toLowerCase()}`;
                      const errorId = `week-error-${key}`;
                      return (
                        <td key={kind} data-cell={key}>
                          <ComboList
                            idPrefix={`cell-${kind}-${weekday}`}
                            label={label}
                            ids={ids}
                            allCombos={allCombos}
                            disabled={busy}
                            describedBy={errors[key] ? errorId : undefined}
                            onAnnounce={setAnnounce}
                            onChange={(next) => {
                              setNotice("");
                              setDraft((current) => ({ ...current, [key]: next }));
                            }}
                          />
                          <FieldError id={errorId} message={errors[key]} />
                          <button
                            type="button"
                            className="tiffin-btn tiffin-primary"
                            disabled={busy || !dirty || needsSlot}
                            aria-describedby={needsSlot ? `week-needs-${kind}` : undefined}
                            aria-label={`Save ${label}`}
                            onClick={() => void saveCell(kind, weekday)}
                          >
                            {busy ? "Saving…" : needsSlot ? "Save" : dirty ? "Save" : "Saved"}
                          </button>
                          {dirty && !busy && <span className="tiffin-dirty"> Unsaved changes</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
