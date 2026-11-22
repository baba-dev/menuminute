import type {
  PublicCombo,
  PublicSlot,
  PublicWeek as PublicWeekData,
} from "@/modules/tiffin/service";
import { currencyExponent } from "@/lib/money";
import "./public-week.css";

/** Minor units arrive as decimal strings; values are <= 2147483647 so Number is safe for display. */
export function formatPublicMinor(minor: string | number, currency: string): string {
  const exponent = currencyExponent(currency);
  const value = Number(minor);
  if (exponent === null || !Number.isFinite(value)) return `${String(minor)} ${currency}`;
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).format(value / 10 ** exponent);
}

/** Minutes from local midnight as HH:MM; 1440 (end of day) reads 24:00. */
export function formatMinute(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** localDate is an outlet-local calendar date; parse it UTC-anchored so the runner zone is irrelevant. */
export function formatDayHeading(localDate: string): string {
  const [y, m, d] = localDate.split("-").map(Number);
  if (!y || !m || !d) return localDate;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

const MEAL_LABEL = { lunch: "Lunch", dinner: "Dinner" } as const;

function Combo({ combo, currency }: { combo: PublicCombo; currency: string }) {
  return (
    <li className="tiffin-public-combo">
      <div className="tiffin-public-combo-head">
        <span className="tiffin-public-combo-name">{combo.name}</span>
        <span className="tiffin-public-price">{formatPublicMinor(combo.priceMinor, currency)}</span>
      </div>
      {combo.description ? <p className="tiffin-public-desc">{combo.description}</p> : null}
      {combo.items.length > 0 ? (
        <ul className="tiffin-public-items" aria-label="Included">
          {combo.items.map((item, i) => (
            <li key={i}>
              {item.label} x{item.quantity}
            </li>
          ))}
        </ul>
      ) : null}
      {combo.addons.length > 0 ? (
        <div className="tiffin-public-addons">
          <p className="tiffin-public-addons-title">Add-ons</p>
          <ul>
            {combo.addons.map((a) => (
              <li key={a.id}>
                <span>{a.label}</span>{" "}
                <span className="tiffin-public-price">
                  {formatPublicMinor(a.priceMinor, currency)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  );
}

function Meal({ slot, currency }: { slot: PublicSlot; currency: string }) {
  return (
    <section className="tiffin-public-meal">
      <h3>
        {MEAL_LABEL[slot.kind]}{" "}
        <span className="tiffin-public-window">
          {formatMinute(slot.startMinute)}–{formatMinute(slot.endMinute)}
        </span>
      </h3>
      {slot.closed ? (
        <p className="tiffin-public-state">Closed</p>
      ) : slot.combos.length === 0 ? (
        <p className="tiffin-public-state">Nothing planned yet</p>
      ) : (
        <ul className="tiffin-public-combos">
          {slot.combos.map((c) => (
            <Combo key={c.id} combo={c} currency={currency} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function PublicWeek({ week }: { week: PublicWeekData }) {
  const { currency } = week.outlet;
  return (
    <main className="tiffin-public">
      <h1>{week.outlet.name}</h1>
      <p className="tiffin-public-notice" role="note">
        Booking opens soon. For now, this is a preview of what is planned.
      </p>
      {week.days.map((day) => {
        const slots = [day.slots.lunch, day.slots.dinner].filter((s): s is PublicSlot => !!s);
        return (
          <section key={day.localDate} className="tiffin-public-day">
            <h2>{formatDayHeading(day.localDate)}</h2>
            {slots.length === 0 ? (
              <p className="tiffin-public-state">Closed</p>
            ) : (
              slots.map((s) => <Meal key={s.kind} slot={s} currency={currency} />)
            )}
          </section>
        );
      })}
    </main>
  );
}
