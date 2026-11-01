import type { CSSProperties } from "react";
import { rollColumns } from "../scan-to-order/scan-to-order-motion";
import "./rolling-number.css";

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

/**
 * Rolling number: every digit is a column that slides to its value (Magic UI "number ticker").
 * The value is exposed once as visually hidden text; the moving columns are decorative.
 */
export function RollingNumber({ text }: { text: string }) {
  const columns = rollColumns(text);
  return (
    <span className="mm-roll">
      <span className="mm-roll__sr">{text}</span>
      <span className="mm-roll__visual" aria-hidden="true">
        {columns.map((column, index) => {
          const key = columns.length - index; // right-aligned, so a longer number keeps its low digits
          return column.kind === "digit" ? (
            <span
              className="mm-roll__col"
              key={key}
              style={{ "--d": column.digit } as CSSProperties}
            >
              <span className="mm-roll__strip">
                {DIGITS.map((digit) => (
                  <span key={digit}>{digit}</span>
                ))}
              </span>
            </span>
          ) : (
            <span key={key}>{column.glyph}</span>
          );
        })}
      </span>
    </span>
  );
}
