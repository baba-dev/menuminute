"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Check, Copy, Minus, Plus, Trash2, X } from "lucide-react";
import { useId, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { DashboardTooltip } from "@/app/(dashboard)/dashboard/dashboard-tooltip";
import {
  MAX_CHAIRS_PER_TABLE,
  type ChairKind,
  type CreateReservationInput,
  type FloorOverview,
  type FloorTableOverview,
  type TableShape,
} from "@/modules/hospitality/floor-contracts";
import { nextHalfHourLocal, zonedLocalToIso } from "@/modules/hospitality/zoned-time";
import styles from "./floor.module.css";

export const SECTIONS_HELP =
  "Sections are the areas of your restaurant, like Main Dining, Patio or Rooftop. Put each table in a section to find it faster and to see how busy each area is.";
export const SYSTEM_ID_HELP =
  "A permanent code the system uses for this table. It never changes, even if you rename or renumber the table.";

const SHAPES: Array<{ value: TableShape; label: string; icon: ReactNode }> = [
  {
    value: "round",
    label: "Round",
    icon: (
      <svg viewBox="0 0 44 30" aria-hidden="true">
        <circle cx="22" cy="15" r="11" fill="none" stroke="currentColor" strokeWidth="2.4" />
      </svg>
    ),
  },
  {
    value: "square",
    label: "Square",
    icon: (
      <svg viewBox="0 0 44 30" aria-hidden="true">
        <rect
          x="11"
          y="4"
          width="22"
          height="22"
          rx="4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
        />
      </svg>
    ),
  },
  {
    value: "rectangle",
    label: "Long",
    icon: (
      <svg viewBox="0 0 44 30" aria-hidden="true">
        <rect
          x="4"
          y="8"
          width="36"
          height="14"
          rx="4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
        />
      </svg>
    ),
  },
  {
    value: "booth",
    label: "Booth",
    icon: (
      <svg viewBox="0 0 44 30" aria-hidden="true">
        <rect
          x="5"
          y="6"
          width="34"
          height="12"
          rx="3"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
        />
        <rect x="3" y="19" width="38" height="6" rx="3" fill="currentColor" />
      </svg>
    ),
  },
];

export const KIND_OPTIONS: Array<{ value: ChairKind; label: string }> = [
  { value: "standard", label: "Standard chair" },
  { value: "high_chair", label: "High chair" },
  { value: "bar_stool", label: "Bar stool" },
  { value: "accessible", label: "Accessible seat" },
];

function Shell({
  open,
  onOpenChange,
  busy,
  eyebrow,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          className={styles.dialog}
          onEscapeKeyDown={(e) => busy && e.preventDefault()}
          onPointerDownOutside={(e) => busy && e.preventDefault()}
        >
          <div className={styles.dialogHead}>
            <div>
              <span className="mm-dashboard-eyebrow">{eyebrow}</span>
              <Dialog.Title className={styles.dialogTitle}>{title}</Dialog.Title>
              <Dialog.Description className={styles.dialogDesc}>{description}</Dialog.Description>
            </div>
            <Dialog.Close className={styles.close} disabled={busy} aria-label="Close">
              <X size={18} aria-hidden="true" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Stepper({
  value,
  onChange,
  min,
  max,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  label: string;
}) {
  return (
    <div className={styles.stepper} role="group" aria-label={label}>
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        aria-label={`Fewer ${label}`}
      >
        <Minus size={16} aria-hidden="true" />
      </button>
      <output aria-live="polite">{value}</output>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label={`More ${label}`}
      >
        <Plus size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

function CopyId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={styles.iconBtn}
      aria-label={copied ? "System ID copied" : "Copy system ID"}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(id);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          /* clipboard unavailable: the id stays selectable */
        }
      }}
    >
      {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
    </button>
  );
}

export { CopyId };

export type TableFormValues = {
  name: string;
  displayNumber: number;
  /** An existing section id, "" for none, or "__new" together with newSectionName. */
  sectionId: string;
  newSectionName: string;
  shape: TableShape;
  chairCount: number;
  chairKind: ChairKind;
};

/** Create or edit a table. In edit mode chairs are managed in the list below the form. */
export function TableDialog({
  open,
  onOpenChange,
  overview,
  table,
  onSubmit,
  onUpdateChair,
  onRemoveChair,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  overview: FloorOverview;
  /** Present when editing. */
  table: FloorTableOverview | null;
  onSubmit: (values: TableFormValues) => Promise<void>;
  onUpdateChair: (
    chairId: string,
    patch: { kind?: ChairKind; tableId?: string | null }
  ) => Promise<void>;
  onRemoveChair: (chairId: string) => Promise<void>;
}) {
  const uid = useId();
  const taken = useMemo(
    () => new Set(overview.tables.filter((t) => t.id !== table?.id).map((t) => t.displayNumber)),
    [overview.tables, table?.id]
  );
  const firstFree = useMemo(() => {
    for (let n = 1; n < 10000; n++) if (!taken.has(n)) return n;
    return 1;
  }, [taken]);

  // The board remounts this dialog (new key) each time it opens, so state starts from these values.
  const [name, setName] = useState(table?.name ?? "");
  const [number, setNumber] = useState(String(table?.displayNumber ?? firstFree));
  const [sectionId, setSectionId] = useState(
    table
      ? (table.sectionId ?? "")
      : (overview.sections[0]?.id ?? (overview.sections.length === 0 ? "__new" : ""))
  );
  const [newSection, setNewSection] = useState(
    !table && overview.sections.length === 0 ? "Main Dining" : ""
  );
  const [shape, setShape] = useState<TableShape>(table?.shape ?? "rectangle");
  const [chairCount, setChairCount] = useState(4);
  const [chairKind, setChairKind] = useState<ChairKind>("standard");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const parsed = Number(number);
  const numberValid = Number.isInteger(parsed) && parsed >= 1 && parsed <= 9999;
  const duplicate = numberValid && taken.has(parsed);
  const nameValid = name.trim().length > 0;
  const sectionValid = sectionId !== "__new" || newSection.trim().length > 0;
  const canSave = nameValid && numberValid && !duplicate && sectionValid && !busy;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    setBusy(true);
    setError("");
    try {
      await onSubmit({
        name: name.trim(),
        displayNumber: parsed,
        sectionId,
        newSectionName: newSection.trim(),
        shape,
        chairCount,
        chairKind,
      });
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the table.");
    } finally {
      setBusy(false);
    }
  }

  const otherTables = overview.tables.filter((t) => t.id !== table?.id);

  return (
    <Shell
      open={open}
      onOpenChange={onOpenChange}
      busy={busy}
      eyebrow={table ? "EDIT TABLE" : "NEW TABLE"}
      title={table ? `Edit ${table.name}` : "Add a table"}
      description={
        table
          ? "Rename it, renumber it or change how it looks. Its system ID never changes."
          : "Name it, number it and give it chairs. You can change anything later."
      }
    >
      <form className={styles.form} onSubmit={submit} noValidate>
        <div className={styles.row2}>
          <div className={styles.field}>
            <label htmlFor={`${uid}-name`}>Table name</label>
            <input
              id={`${uid}-name`}
              className={styles.input}
              value={name}
              maxLength={80}
              placeholder="Window booth"
              autoFocus
              aria-invalid={!nameValid && name.length > 0}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor={`${uid}-number`}>Table number</label>
            <input
              id={`${uid}-number`}
              className={styles.input}
              inputMode="numeric"
              value={number}
              aria-invalid={!numberValid || duplicate}
              aria-describedby={`${uid}-number-help`}
              onChange={(e) => setNumber(e.target.value.replace(/\D/g, "").slice(0, 4))}
            />
          </div>
        </div>
        <p
          id={`${uid}-number-help`}
          className={duplicate || !numberValid ? styles.err : styles.help}
        >
          {duplicate
            ? `Table ${parsed} already exists. Pick another number.`
            : !numberValid
              ? "Use a number from 1 to 9999."
              : "This is the number staff and guests see."}
        </p>

        <div className={styles.field}>
          <label htmlFor={`${uid}-section`}>
            Section <DashboardTooltip label="sections">{SECTIONS_HELP}</DashboardTooltip>
          </label>
          <select
            id={`${uid}-section`}
            className={styles.select}
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
          >
            <option value="">No section</option>
            {overview.sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            <option value="__new">＋ New section…</option>
          </select>
          {sectionId === "__new" && (
            <input
              className={styles.input}
              aria-label="New section name"
              placeholder="Patio"
              maxLength={64}
              value={newSection}
              onChange={(e) => setNewSection(e.target.value)}
            />
          )}
        </div>

        <fieldset className={styles.field}>
          <legend>Shape</legend>
          <div className={styles.shapes}>
            {SHAPES.map((s) => (
              <button
                key={s.value}
                type="button"
                className={styles.shape}
                aria-pressed={shape === s.value}
                onClick={() => setShape(s.value)}
              >
                {s.icon}
                {s.label}
              </button>
            ))}
          </div>
        </fieldset>

        {!table ? (
          <div className={styles.row2}>
            <div className={styles.field}>
              <label>Chairs to add</label>
              <Stepper
                value={chairCount}
                onChange={setChairCount}
                min={0}
                max={MAX_CHAIRS_PER_TABLE}
                label="chairs"
              />
            </div>
            <div className={styles.field}>
              <label htmlFor={`${uid}-kind`}>Chair type</label>
              <select
                id={`${uid}-kind`}
                className={styles.select}
                value={chairKind}
                onChange={(e) => setChairKind(e.target.value as ChairKind)}
              >
                {KIND_OPTIONS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className={styles.field}>
            <label>Chairs at this table ({table.chairs.length})</label>
            {table.chairs.length === 0 ? (
              <p className={styles.help}>No chairs yet. Use “Add chairs” on the table card.</p>
            ) : (
              <div className={styles.chairRows}>
                {table.chairs.map((chair, i) => (
                  <div className={styles.chairRow} key={chair.id}>
                    <span>{chair.label ?? `Chair ${i + 1}`}</span>
                    <select
                      className={styles.select}
                      aria-label={`Move chair ${i + 1}`}
                      value={table.id}
                      onChange={(e) =>
                        void onUpdateChair(chair.id, {
                          tableId: e.target.value === "__none" ? null : e.target.value,
                        }).catch(() => undefined)
                      }
                    >
                      <option value={table.id}>Stays here</option>
                      <option value="__none">Unassign</option>
                      {otherTables.map((t) => (
                        <option key={t.id} value={t.id}>
                          Move to {t.displayNumber} · {t.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      aria-label={`Remove chair ${i + 1}`}
                      onClick={() => void onRemoveChair(chair.id).catch(() => undefined)}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className={styles.systemId}>
          {table ? (
            <>
              <span>
                System ID <DashboardTooltip label="system ID">{SYSTEM_ID_HELP}</DashboardTooltip>
              </span>
              <code className={styles.mono}>{table.id}</code>
              <CopyId id={table.id} />
            </>
          ) : (
            <span>A permanent system ID is assigned when you save.</span>
          )}
        </div>

        {error && (
          <p className={styles.err} role="alert">
            {error}
          </p>
        )}
        <div className={styles.footer}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnQuiet}`}
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={!canSave}
          >
            {busy ? "Saving…" : table ? "Save changes" : "Create table"}
          </button>
        </div>
      </form>
    </Shell>
  );
}

/** Add one or many chairs, to a table or to the unassigned tray. */
export function ChairsDialog({
  open,
  onOpenChange,
  overview,
  defaultTableId,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  overview: FloorOverview;
  defaultTableId: string | null;
  onSubmit: (input: { count: number; kind: ChairKind; tableId: string | null }) => Promise<void>;
}) {
  const uid = useId();
  const [count, setCount] = useState(1);
  const [kind, setKind] = useState<ChairKind>("standard");
  const [tableId, setTableId] = useState<string>(defaultTableId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const target = overview.tables.find((t) => t.id === tableId) ?? null;
  const room = target ? MAX_CHAIRS_PER_TABLE - target.chairs.length : MAX_CHAIRS_PER_TABLE;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || count > room) return;
    setBusy(true);
    setError("");
    try {
      await onSubmit({ count, kind, tableId: tableId || null });
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add chairs.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell
      open={open}
      onOpenChange={onOpenChange}
      busy={busy}
      eyebrow="NEW CHAIRS"
      title="Add chairs"
      description="Chairs are what we count to know how many guests you can seat."
    >
      <form className={styles.form} onSubmit={submit}>
        <div className={styles.field}>
          <label htmlFor={`${uid}-table`}>Put them at</label>
          <select
            id={`${uid}-table`}
            className={styles.select}
            value={tableId}
            onChange={(e) => setTableId(e.target.value)}
          >
            <option value="">Leave unassigned for now</option>
            {overview.tables.map((t) => (
              <option key={t.id} value={t.id}>
                {t.displayNumber} · {t.name} ({t.chairs.length} chairs)
              </option>
            ))}
          </select>
        </div>
        <div className={styles.row2}>
          <div className={styles.field}>
            <label>How many</label>
            <Stepper
              value={count}
              onChange={setCount}
              min={1}
              max={Math.max(1, room)}
              label="chairs"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor={`${uid}-kind`}>Chair type</label>
            <select
              id={`${uid}-kind`}
              className={styles.select}
              value={kind}
              onChange={(e) => setKind(e.target.value as ChairKind)}
            >
              {KIND_OPTIONS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {room <= 0 && (
          <p className={styles.err}>This table already has {MAX_CHAIRS_PER_TABLE} chairs.</p>
        )}
        {error && (
          <p className={styles.err} role="alert">
            {error}
          </p>
        )}
        <div className={styles.footer}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnQuiet}`}
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={busy || room <= 0}
          >
            {busy ? "Adding…" : `Add ${count} chair${count === 1 ? "" : "s"}`}
          </button>
        </div>
      </form>
    </Shell>
  );
}

/** Tap on a table: seat a party of N, or clear everyone. */
export function SeatDialog({
  open,
  onOpenChange,
  table,
  onSeat,
  onClear,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table: FloorTableOverview | null;
  onSeat: (guests: number) => Promise<void>;
  onClear: () => Promise<void>;
}) {
  const free = table ? table.maxOccupancy - table.currentOccupancy : 0;
  const [guests, setGuests] = useState(Math.max(1, free));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!table) return null;

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the table.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell
      open={open}
      onOpenChange={onOpenChange}
      busy={busy}
      eyebrow={`TABLE ${table.displayNumber}`}
      title={table.name}
      description={`${table.currentOccupancy} of ${table.maxOccupancy} seats taken. Tap any chair to change a single seat.`}
    >
      <div className={styles.form}>
        {free > 0 && (
          <div className={styles.field}>
            <label>Seat a party of</label>
            <Stepper
              value={Math.min(guests, free)}
              onChange={setGuests}
              min={1}
              max={free}
              label="guests"
            />
            <p className={styles.help}>They take the next free chairs at this table.</p>
          </div>
        )}
        {error && (
          <p className={styles.err} role="alert">
            {error}
          </p>
        )}
        <div className={styles.footer}>
          {table.currentOccupancy > 0 && (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnQuiet}`}
              disabled={busy}
              onClick={() => void run(onClear)}
            >
              Clear table
            </button>
          )}
          {free > 0 && (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              disabled={busy}
              onClick={() => void run(() => onSeat(Math.min(guests, free)))}
            >
              {busy ? "Seating…" : `Seat ${Math.min(guests, free)}`}
            </button>
          )}
        </div>
      </div>
    </Shell>
  );
}

/** Reserve a table. Times are entered and shown in the outlet's own timezone. */
export function ReservationDialog({
  open,
  onOpenChange,
  overview,
  tableId,
  timezone,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  overview: FloorOverview;
  tableId: string | null;
  timezone: string;
  onSubmit: (input: CreateReservationInput) => Promise<void>;
}) {
  const uid = useId();
  const withChairs = overview.tables.filter((t) => t.maxOccupancy > 0);
  const initial = withChairs.find((t) => t.id === tableId) ?? withChairs[0];
  const [table, setTable] = useState(initial?.id ?? "");
  const [guest, setGuest] = useState("");
  const [phone, setPhone] = useState("");
  const [party, setParty] = useState(Math.min(2, initial?.maxOccupancy ?? 2));
  const [when, setWhen] = useState(() => nextHalfHourLocal(new Date(), timezone));
  const [minutes, setMinutes] = useState(90);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const chosen = withChairs.find((t) => t.id === table) ?? null;
  const over = chosen ? party > chosen.maxOccupancy : false;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!chosen || !guest.trim() || over || busy) return;
    setBusy(true);
    setError("");
    try {
      await onSubmit({
        tableId: chosen.id,
        guestName: guest.trim(),
        guestPhone: phone.trim() || null,
        partySize: party,
        reservationTime: zonedLocalToIso(when, timezone),
        durationMinutes: minutes,
        notes: notes.trim() || null,
      });
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the reservation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell
      open={open}
      onOpenChange={onOpenChange}
      busy={busy}
      eyebrow="RESERVATION"
      title="Reserve a table"
      description={`Times are in your restaurant’s timezone (${timezone}).`}
    >
      <form className={styles.form} onSubmit={submit}>
        {withChairs.length === 0 ? (
          <p className={styles.err}>
            Add a table with chairs first. Bookings are checked against chairs.
          </p>
        ) : (
          <>
            <div className={styles.field}>
              <label htmlFor={`${uid}-t`}>Table</label>
              <select
                id={`${uid}-t`}
                className={styles.select}
                value={table}
                onChange={(e) => setTable(e.target.value)}
              >
                {withChairs.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.displayNumber} · {t.name} (seats {t.maxOccupancy})
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.row2}>
              <div className={styles.field}>
                <label htmlFor={`${uid}-g`}>Guest name</label>
                <input
                  id={`${uid}-g`}
                  className={styles.input}
                  value={guest}
                  maxLength={100}
                  onChange={(e) => setGuest(e.target.value)}
                  autoFocus
                />
              </div>
              <div className={styles.field}>
                <label htmlFor={`${uid}-p`}>Phone (optional)</label>
                <input
                  id={`${uid}-p`}
                  className={styles.input}
                  inputMode="tel"
                  value={phone}
                  maxLength={30}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>
            <div className={styles.row2}>
              <div className={styles.field}>
                <label>Party size</label>
                <Stepper value={party} onChange={setParty} min={1} max={50} label="guests" />
                {over && <p className={styles.err}>This table seats {chosen?.maxOccupancy}.</p>}
              </div>
              <div className={styles.field}>
                <label htmlFor={`${uid}-d`}>Stay (minutes)</label>
                <select
                  id={`${uid}-d`}
                  className={styles.select}
                  value={minutes}
                  onChange={(e) => setMinutes(Number(e.target.value))}
                >
                  {[45, 60, 90, 120, 150, 180].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className={styles.field}>
              <label htmlFor={`${uid}-w`}>Date and time</label>
              <input
                id={`${uid}-w`}
                type="datetime-local"
                className={styles.input}
                value={when}
                onChange={(e) => setWhen(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor={`${uid}-n`}>Notes (optional)</label>
              <input
                id={`${uid}-n`}
                className={styles.input}
                value={notes}
                maxLength={500}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </>
        )}
        {error && (
          <p className={styles.err} role="alert">
            {error}
          </p>
        )}
        <div className={styles.footer}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnQuiet}`}
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={busy || !chosen || !guest.trim() || over || !when}
          >
            {busy ? "Booking…" : "Confirm booking"}
          </button>
        </div>
      </form>
    </Shell>
  );
}

export function ArchiveDialog({
  open,
  onOpenChange,
  table,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table: FloorTableOverview | null;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!table) return null;
  return (
    <Shell
      open={open}
      onOpenChange={onOpenChange}
      busy={busy}
      eyebrow="ARCHIVE TABLE"
      title={`Archive ${table.name}?`}
      description="The table leaves your floor. Its chairs are kept and move to the unassigned tray, so you can reuse them."
    >
      <div className={styles.form}>
        <p className={styles.help}>
          Tables with open orders, bookings, a live QR code or seated guests can’t be archived until
          those are resolved.
        </p>
        {error && (
          <p className={styles.err} role="alert">
            {error}
          </p>
        )}
        <div className={styles.footer}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnQuiet}`}
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Keep table
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnDanger}`}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await onConfirm();
                onOpenChange(false);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Could not archive the table.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Archiving…" : "Archive table"}
          </button>
        </div>
      </div>
    </Shell>
  );
}
