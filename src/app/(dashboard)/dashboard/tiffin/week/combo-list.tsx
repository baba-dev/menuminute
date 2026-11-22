"use client";

import { useEffect, useRef, useState } from "react";
import { addableCombos, moveItem, type ComboRef } from "./week-form";

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="tiffin-field-error" role="alert" tabIndex={-1}>
      {message}
    </p>
  );
}

type Props = {
  /** Unique within the page; prefixes element ids. */
  idPrefix: string;
  /** Accessible context such as "Monday Lunch". */
  label: string;
  ids: string[];
  /** Every known combo (archived included) so existing ids always have a name. */
  allCombos: ComboRef[];
  disabled?: boolean;
  describedBy?: string;
  onChange: (ids: string[]) => void;
  onAnnounce: (message: string) => void;
  maxItems?: number;
};

/** Ordered combo list with keyboard-operable add, remove and move up/down buttons. */
export function ComboList({
  idPrefix,
  label,
  ids,
  allCombos,
  disabled,
  describedBy,
  onChange,
  onAnnounce,
  maxItems = 50,
}: Props) {
  const [choice, setChoice] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const focusTarget = useRef<string[] | null>(null);
  const nameOf = (id: string) => allCombos.find((c) => c.id === id)?.name ?? "Unknown combo";
  const options = addableCombos(allCombos, ids);

  useEffect(() => {
    const targets = focusTarget.current;
    if (!targets) return;
    focusTarget.current = null;
    for (const target of targets) {
      const el = root.current?.querySelector<HTMLElement>(`[data-focus="${target}"]`);
      if (el && !(el as HTMLButtonElement).disabled) {
        el.focus();
        return;
      }
    }
  });

  function add() {
    if (!choice || ids.includes(choice) || ids.length >= maxItems) return;
    const name = nameOf(choice);
    onChange([...ids, choice]);
    setChoice("");
    focusTarget.current = ["add"];
    onAnnounce(`${name} added to ${label}, position ${ids.length + 1}.`);
  }
  function remove(index: number) {
    const id = ids[index]!;
    const next = ids.filter((_, i) => i !== index);
    onChange(next);
    const neighbour = next[Math.min(index, next.length - 1)];
    focusTarget.current = neighbour ? [`remove-${neighbour}`, "add"] : ["add"];
    onAnnounce(`${nameOf(id)} removed from ${label}.`);
  }
  function move(index: number, direction: -1 | 1) {
    const id = ids[index]!;
    onChange(moveItem(ids, index, direction));
    focusTarget.current =
      direction === -1 ? [`up-${id}`, `down-${id}`] : [`down-${id}`, `up-${id}`];
    onAnnounce(`${nameOf(id)} moved to position ${index + direction + 1} of ${ids.length}.`);
  }

  return (
    <div ref={root} className="tiffin-combolist">
      {ids.length === 0 ? (
        <p className="tiffin-muted" id={`${idPrefix}-empty`}>
          No combos
        </p>
      ) : (
        <ol className="tiffin-picks" aria-label={`${label} combos in order`}>
          {ids.map((id, index) => (
            <li key={id} className="tiffin-pick">
              <span className="tiffin-pick-name">
                {index + 1}. {nameOf(id)}
              </span>
              <span className="tiffin-pick-actions">
                <button
                  type="button"
                  className="tiffin-btn"
                  data-focus={`up-${id}`}
                  disabled={disabled || index === 0}
                  aria-label={`Move ${nameOf(id)} up in ${label}`}
                  onClick={() => move(index, -1)}
                >
                  Up
                </button>
                <button
                  type="button"
                  className="tiffin-btn"
                  data-focus={`down-${id}`}
                  disabled={disabled || index === ids.length - 1}
                  aria-label={`Move ${nameOf(id)} down in ${label}`}
                  onClick={() => move(index, 1)}
                >
                  Down
                </button>
                <button
                  type="button"
                  className="tiffin-btn"
                  data-focus={`remove-${id}`}
                  disabled={disabled}
                  aria-label={`Remove ${nameOf(id)} from ${label}`}
                  onClick={() => remove(index)}
                >
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}
      <div className="tiffin-add">
        <label htmlFor={`${idPrefix}-add`} className="tiffin-sr">
          Add a combo to {label}
        </label>
        <select
          id={`${idPrefix}-add`}
          data-focus="add"
          value={choice}
          disabled={disabled || options.length === 0 || ids.length >= maxItems}
          aria-describedby={describedBy}
          onChange={(e) => setChoice(e.target.value)}
        >
          <option value="">{options.length ? "Choose a combo" : "No more combos"}</option>
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="tiffin-btn"
          disabled={disabled || !choice}
          aria-label={`Add selected combo to ${label}`}
          onClick={add}
        >
          Add
        </button>
      </div>
    </div>
  );
}
