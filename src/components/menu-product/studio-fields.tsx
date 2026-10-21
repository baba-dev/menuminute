"use client";
import { useState } from "react";
import { displayToMinor, currencyExponent } from "@/lib/money";

export function Money({
  value,
  currency,
  onChange,
  label,
}: {
  value: number;
  currency: string;
  onChange: (v: number) => void;
  label: string;
}) {
  const [text, setText] = useState(
    (value / 10 ** (currencyExponent(currency) ?? 2)).toFixed(currencyExponent(currency) ?? 2)
  );
  return (
    <label className="field">
      {label} ({currency})
      <input
        aria-label={label}
        inputMode="decimal"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          try {
            const n = displayToMinor(e.target.value, currency);
            e.target.setCustomValidity("");
            onChange(n);
          } catch {
            e.target.setCustomValidity(
              "Enter a nonnegative price in this currency’s supported precision"
            );
          }
        }}
      />
    </label>
  );
}
export function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="field">
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} maxLength={100} required />
    </label>
  );
}

