"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  LIMITS,
  buildComboPayload,
  formatMinor,
  minorToInput,
  serverFieldErrors,
  summarizeItems,
  type ComboFormValues,
  type ComboView,
  type FieldErrors,
} from "./combo-form";

type Props = {
  outletId: string;
  /** Outlet currency; shown to the owner only. The server sets the combo currency itself. */
  currency: string;
  combos: ComboView[];
  archivedCombos: ComboView[];
};

type Mode = { kind: "new" } | { kind: "edit"; id: string } | null;

let rowCounter = 0;
const nextKey = () => `row-${++rowCounter}`;

function emptyForm(): ComboFormValues {
  return {
    name: "",
    description: "",
    price: "",
    items: [{ key: nextKey(), label: "", quantity: "1" }],
    addons: [],
  };
}

function formFrom(combo: ComboView): ComboFormValues {
  return {
    name: combo.name,
    description: combo.description,
    price: minorToInput(combo.priceMinor, combo.currency),
    items: combo.items.map((item) => ({
      key: nextKey(),
      label: item.label,
      quantity: String(item.quantity),
    })),
    addons: combo.addons.map((addon) => ({
      key: nextKey(),
      label: addon.label,
      price: minorToInput(addon.priceMinor, combo.currency),
    })),
  };
}

async function request(
  outletId: string,
  method: "POST" | "PATCH",
  body: unknown
): Promise<{ ok: true; combo: ComboView } | { ok: false; message: string; fields: FieldErrors }> {
  try {
    const response = await fetch(`/api/tiffin/${encodeURIComponent(outletId)}/combos`, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok) {
      const message =
        typeof data?.["message"] === "string"
          ? data["message"]
          : "Something went wrong. Nothing was changed.";
      return { ok: false, message, fields: serverFieldErrors(data?.["fields"]) };
    }
    return { ok: true, combo: data as unknown as ComboView };
  } catch {
    return {
      ok: false,
      message: "Could not reach the server. Check your connection and try again.",
      fields: {},
    };
  }
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="tiffin-field-error" role="alert">
      {message}
    </p>
  );
}

export function ComboEditor({ outletId, currency, combos, archivedCombos }: Props) {
  const [active, setActive] = useState(combos);
  const [archived, setArchived] = useState(archivedCombos);
  const [mode, setMode] = useState<Mode>(null);
  const [form, setForm] = useState<ComboFormValues>(emptyForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [announce, setAnnounce] = useState("");
  const savingRef = useRef(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const focusRow = useRef<string | null>(null);

  useEffect(() => {
    if (mode) nameRef.current?.focus();
  }, [mode]);
  useEffect(() => {
    if (!focusRow.current) return;
    const target = formRef.current?.querySelector<HTMLElement>(
      `[data-focus="${focusRow.current}"]`
    );
    focusRow.current = null;
    target?.focus();
  });

  function open(next: Mode, combo?: ComboView) {
    setForm(combo ? formFrom(combo) : emptyForm());
    setErrors({});
    setFormError("");
    setNotice("");
    setMode(next);
  }
  function close() {
    setMode(null);
    setErrors({});
    setFormError("");
  }

  function patch(update: Partial<ComboFormValues>) {
    setForm((current) => ({ ...current, ...update }));
  }
  function addItem() {
    if (form.items.length >= LIMITS.itemsMax) return;
    const key = nextKey();
    focusRow.current = `items-${key}`;
    patch({ items: [...form.items, { key, label: "", quantity: "1" }] });
    setAnnounce(`Item row ${form.items.length + 1} added.`);
  }
  function removeItem(key: string) {
    if (form.items.length <= 1) return;
    const index = form.items.findIndex((row) => row.key === key);
    const next = form.items.filter((row) => row.key !== key);
    focusRow.current = `items-${next[Math.max(0, index - 1)]!.key}`;
    patch({ items: next });
    setAnnounce(`Item row ${index + 1} removed.`);
  }
  function addAddon() {
    if (form.addons.length >= LIMITS.addonsMax) return;
    const key = nextKey();
    focusRow.current = `addons-${key}`;
    patch({ addons: [...form.addons, { key, label: "", price: "" }] });
    setAnnounce(`Add-on row ${form.addons.length + 1} added.`);
  }
  function removeAddon(key: string) {
    const index = form.addons.findIndex((row) => row.key === key);
    const next = form.addons.filter((row) => row.key !== key);
    focusRow.current = next.length ? `addons-${next[Math.max(0, index - 1)]!.key}` : "add-addon";
    patch({ addons: next });
    setAnnounce(`Add-on row ${index + 1} removed.`);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (savingRef.current || !mode) return;
    setFormError("");
    const built = buildComboPayload(form, currency, mode.kind === "edit" ? mode.id : undefined);
    if (!built.ok) {
      setErrors(built.errors);
      setFormError("Please fix the highlighted fields.");
      return;
    }
    setErrors({});
    savingRef.current = true;
    setSaving(true);
    const result = await request(outletId, "POST", built.payload);
    savingRef.current = false;
    setSaving(false);
    if (!result.ok) {
      setErrors(result.fields);
      setFormError(result.message);
      return;
    }
    const saved = result.combo;
    const replace = (list: ComboView[]) => list.map((c) => (c.id === saved.id ? saved : c));
    if (active.some((c) => c.id === saved.id)) setActive(replace(active));
    else if (archived.some((c) => c.id === saved.id)) setArchived(replace(archived));
    else setActive([...active, saved]);
    setNotice(`Saved “${saved.name}”.`);
    close();
  }

  async function setArchivedState(combo: ComboView, nextArchived: boolean) {
    if (busyId) return;
    setBusyId(combo.id);
    setNotice("");
    setRowErrors(({ [combo.id]: _drop, ...rest }) => rest);
    const result = await request(outletId, "PATCH", { id: combo.id, archived: nextArchived });
    setBusyId(null);
    if (!result.ok) {
      const repricing = /repricing/i.test(result.message);
      setRowErrors((current) => ({
        ...current,
        [combo.id]: repricing
          ? `${result.message}. This combo was priced in another currency. Choose Edit, save it with a price in ${currency}, then restore it.`
          : result.message,
      }));
      return;
    }
    const saved = result.combo;
    if (nextArchived) {
      setActive(active.filter((c) => c.id !== combo.id));
      setArchived([saved, ...archived.filter((c) => c.id !== combo.id)]);
      setNotice(`Archived “${saved.name}”. It is no longer offered.`);
    } else {
      setArchived(archived.filter((c) => c.id !== combo.id));
      setActive([...active.filter((c) => c.id !== combo.id), saved]);
      setNotice(`Restored “${saved.name}”.`);
    }
  }

  const editing =
    mode?.kind === "edit" ? [...active, ...archived].find((c) => c.id === mode.id) : null;
  const heading = mode?.kind === "edit" ? "Edit combo" : "New combo";
  const hasAny = active.length + archived.length > 0;

  function renderCombo(combo: ComboView, isArchived: boolean) {
    const errorId = `combo-error-${combo.id}`;
    const busy = busyId === combo.id;
    return (
      <li key={combo.id} className="tiffin-combo">
        <div className="tiffin-combo-head">
          <h3>{combo.name}</h3>
          <p className="tiffin-price">{formatMinor(combo.priceMinor, combo.currency)}</p>
        </div>
        {isArchived && <p className="tiffin-badge">Archived: not offered</p>}
        {combo.description && <p className="tiffin-muted">{combo.description}</p>}
        <p className="tiffin-items">
          <span className="tiffin-label">Includes </span>
          {summarizeItems(combo.items)}
        </p>
        {combo.addons.length > 0 && (
          <p className="tiffin-items">
            <span className="tiffin-label">Add-ons </span>
            {combo.addons
              .map((a) => `${a.label} (${formatMinor(a.priceMinor, combo.currency)})`)
              .join(", ")}
          </p>
        )}
        <div className="tiffin-actions">
          <button
            type="button"
            className="tiffin-btn"
            onClick={() => open({ kind: "edit", id: combo.id }, combo)}
            aria-label={`Edit ${combo.name}`}
          >
            Edit
          </button>
          <button
            type="button"
            className="tiffin-btn"
            disabled={busy}
            aria-describedby={rowErrors[combo.id] ? errorId : undefined}
            aria-label={`${isArchived ? "Restore" : "Archive"} ${combo.name}`}
            onClick={() => void setArchivedState(combo, !isArchived)}
          >
            {busy ? "Working…" : isArchived ? "Restore" : "Archive"}
          </button>
        </div>
        <FieldError id={errorId} message={rowErrors[combo.id]} />
      </li>
    );
  }

  return (
    <div className="tiffin-combos">
      <div className="tiffin-sr" role="status" aria-live="polite">
        {announce}
      </div>
      {notice && (
        <p className="tiffin-notice" role="status">
          {notice}
        </p>
      )}

      {mode ? (
        <form
          ref={formRef}
          className="tiffin-form"
          onSubmit={submit}
          noValidate
          aria-labelledby="combo-form-title"
        >
          <h2 id="combo-form-title">{heading}</h2>
          {editing?.archived && (
            <p className="tiffin-muted">
              This combo is archived. Saving updates it; use Restore afterwards to offer it again.
            </p>
          )}
          {formError && (
            <p className="tiffin-form-error" role="alert">
              {formError}
            </p>
          )}

          <div className="tiffin-field">
            <label htmlFor="combo-name">Combo name</label>
            <input
              id="combo-name"
              ref={nameRef}
              value={form.name}
              maxLength={LIMITS.name}
              required
              aria-invalid={errors["name"] ? true : undefined}
              aria-describedby={errors["name"] ? "combo-name-error" : undefined}
              onChange={(e) => patch({ name: e.target.value })}
            />
            <FieldError id="combo-name-error" message={errors["name"]} />
          </div>

          <div className="tiffin-field">
            <label htmlFor="combo-description">
              Description <span className="tiffin-muted">(optional)</span>
            </label>
            <textarea
              id="combo-description"
              rows={3}
              value={form.description}
              maxLength={LIMITS.description}
              aria-invalid={errors["description"] ? true : undefined}
              aria-describedby={
                errors["description"] ? "combo-description-error" : "combo-description-hint"
              }
              onChange={(e) => patch({ description: e.target.value })}
            />
            <p id="combo-description-hint" className="tiffin-hint">
              {form.description.length} of {LIMITS.description} characters. Write only what you can
              stand behind.
            </p>
            <FieldError id="combo-description-error" message={errors["description"]} />
          </div>

          <div className="tiffin-field">
            <label htmlFor="combo-price">Price ({currency})</label>
            <input
              id="combo-price"
              inputMode="decimal"
              autoComplete="off"
              value={form.price}
              required
              aria-invalid={errors["price"] ? true : undefined}
              aria-describedby={errors["price"] ? "combo-price-error" : undefined}
              onChange={(e) => patch({ price: e.target.value })}
            />
            <FieldError id="combo-price-error" message={errors["price"]} />
          </div>

          <fieldset className="tiffin-fieldset" aria-describedby="combo-items-hint">
            <legend>Items in this combo</legend>
            <p id="combo-items-hint" className="tiffin-hint">
              1 to {LIMITS.itemsMax} items. Quantity is how many of each come in one combo.
            </p>
            <FieldError id="combo-items-error" message={errors["items"]} />
            <ul className="tiffin-rows">
              {form.items.map((row, index) => {
                const labelErr = errors[`items.${index}.label`];
                const qtyErr = errors[`items.${index}.quantity`];
                return (
                  <li key={row.key} className="tiffin-row">
                    <div className="tiffin-field tiffin-grow">
                      <label htmlFor={`item-label-${row.key}`}>Item {index + 1} name</label>
                      <input
                        id={`item-label-${row.key}`}
                        data-focus={`items-${row.key}`}
                        value={row.label}
                        maxLength={LIMITS.label}
                        aria-invalid={labelErr ? true : undefined}
                        aria-describedby={labelErr ? `item-label-${row.key}-error` : undefined}
                        onChange={(e) =>
                          patch({
                            items: form.items.map((r) =>
                              r.key === row.key ? { ...r, label: e.target.value } : r
                            ),
                          })
                        }
                      />
                      <FieldError id={`item-label-${row.key}-error`} message={labelErr} />
                    </div>
                    <div className="tiffin-field tiffin-narrow">
                      <label htmlFor={`item-qty-${row.key}`}>Item {index + 1} quantity</label>
                      <input
                        id={`item-qty-${row.key}`}
                        inputMode="numeric"
                        value={row.quantity}
                        aria-invalid={qtyErr ? true : undefined}
                        aria-describedby={qtyErr ? `item-qty-${row.key}-error` : undefined}
                        onChange={(e) =>
                          patch({
                            items: form.items.map((r) =>
                              r.key === row.key ? { ...r, quantity: e.target.value } : r
                            ),
                          })
                        }
                      />
                      <FieldError id={`item-qty-${row.key}-error`} message={qtyErr} />
                    </div>
                    <button
                      type="button"
                      className="tiffin-btn tiffin-remove"
                      disabled={form.items.length <= 1}
                      onClick={() => removeItem(row.key)}
                      aria-label={`Remove item ${index + 1}${row.label ? `: ${row.label}` : ""}`}
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              className="tiffin-btn"
              onClick={addItem}
              disabled={form.items.length >= LIMITS.itemsMax}
            >
              Add item
            </button>
          </fieldset>

          <fieldset className="tiffin-fieldset" aria-describedby="combo-addons-hint">
            <legend>Add-ons (optional)</legend>
            <p id="combo-addons-hint" className="tiffin-hint">
              Extras a customer can add to this combo, each with its own price. Up to{" "}
              {LIMITS.addonsMax}.
            </p>
            <ul className="tiffin-rows">
              {form.addons.map((row, index) => {
                const labelErr = errors[`addons.${index}.label`];
                const priceErr = errors[`addons.${index}.price`];
                return (
                  <li key={row.key} className="tiffin-row">
                    <div className="tiffin-field tiffin-grow">
                      <label htmlFor={`addon-label-${row.key}`}>Add-on {index + 1} name</label>
                      <input
                        id={`addon-label-${row.key}`}
                        data-focus={`addons-${row.key}`}
                        value={row.label}
                        maxLength={LIMITS.label}
                        aria-invalid={labelErr ? true : undefined}
                        aria-describedby={labelErr ? `addon-label-${row.key}-error` : undefined}
                        onChange={(e) =>
                          patch({
                            addons: form.addons.map((r) =>
                              r.key === row.key ? { ...r, label: e.target.value } : r
                            ),
                          })
                        }
                      />
                      <FieldError id={`addon-label-${row.key}-error`} message={labelErr} />
                    </div>
                    <div className="tiffin-field tiffin-narrow">
                      <label htmlFor={`addon-price-${row.key}`}>
                        Add-on {index + 1} price ({currency})
                      </label>
                      <input
                        id={`addon-price-${row.key}`}
                        inputMode="decimal"
                        autoComplete="off"
                        value={row.price}
                        aria-invalid={priceErr ? true : undefined}
                        aria-describedby={priceErr ? `addon-price-${row.key}-error` : undefined}
                        onChange={(e) =>
                          patch({
                            addons: form.addons.map((r) =>
                              r.key === row.key ? { ...r, price: e.target.value } : r
                            ),
                          })
                        }
                      />
                      <FieldError id={`addon-price-${row.key}-error`} message={priceErr} />
                    </div>
                    <button
                      type="button"
                      className="tiffin-btn tiffin-remove"
                      onClick={() => removeAddon(row.key)}
                      aria-label={`Remove add-on ${index + 1}${row.label ? `: ${row.label}` : ""}`}
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              className="tiffin-btn"
              data-focus="add-addon"
              onClick={addAddon}
              disabled={form.addons.length >= LIMITS.addonsMax}
            >
              Add an add-on
            </button>
          </fieldset>

          <div className="tiffin-actions">
            <button type="submit" className="tiffin-btn tiffin-primary" disabled={saving}>
              {saving ? "Saving…" : mode.kind === "edit" ? "Save changes" : "Save combo"}
            </button>
            <button type="button" className="tiffin-btn" onClick={close} disabled={saving}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="tiffin-toolbar">
          <button
            type="button"
            className="tiffin-btn tiffin-primary"
            onClick={() => open({ kind: "new" })}
          >
            Create a combo
          </button>
        </div>
      )}

      {!hasAny && !mode && (
        <div className="tiffin-empty">
          <h2>No combos yet</h2>
          <p>
            A combo is a meal you sell as one unit, such as a thali with its items and a price.
            Create your first combo to build your weekly menu from it.
          </p>
        </div>
      )}

      {active.length > 0 && (
        <section aria-labelledby="active-combos-title">
          <h2 id="active-combos-title">Combos ({active.length})</h2>
          <ul className="tiffin-list">{active.map((combo) => renderCombo(combo, false))}</ul>
        </section>
      )}
      {active.length === 0 && archived.length > 0 && (
        <p className="tiffin-muted">No active combos. Restore one below or create a new combo.</p>
      )}

      {archived.length > 0 && (
        <details className="tiffin-archived">
          <summary>Archived ({archived.length})</summary>
          <ul className="tiffin-list">{archived.map((combo) => renderCombo(combo, true))}</ul>
        </details>
      )}
    </div>
  );
}
