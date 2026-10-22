"use client";
import { useState } from "react";
export function PrintActions() {
  const [format, setFormat] = useState<"a4" | "thermal">("a4");
  return (
    <div className="document-actions">
      <label>
        Paper format{" "}
        <select
          value={format}
          onChange={(e) => {
            const next = e.target.value as typeof format;
            setFormat(next);
            document.documentElement.dataset.receiptFormat = next;
          }}
        >
          <option value="a4">A4</option>
          <option value="thermal">80 mm thermal</option>
        </select>
      </label>
      <button type="button" onClick={() => window.print()}>
        Print / save PDF
      </button>
      <p>
        Use your browser’s print dialog to print or save a PDF. Reprinting preserves the original
        document number.
      </p>
    </div>
  );
}
