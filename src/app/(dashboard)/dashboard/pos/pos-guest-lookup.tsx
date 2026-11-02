"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Phone, UserRound, X } from "lucide-react";
import type { GuestMatch } from "@/modules/crm/service";

type Props = {
  organizationId: string; outletId: string; country: string;
  phone: string; onPhoneChange: (phone: string) => void;
};
export function PosGuestLookup({ organizationId, outletId, country, phone, onPhoneChange }: Props) {
  const [match, setMatch] = useState<GuestMatch | null>(null);
  const [searched, setSearched] = useState("");
  const [disabled, setDisabled] = useState(false);
  const validLength = phone.replace(/\D/g, "").length >= 8;
  const endpoint = "/api/organizations/" + encodeURIComponent(organizationId) +
    "/outlets/" + encodeURIComponent(outletId) + "/guests";

  useEffect(() => {
    if (!validLength || disabled) return;
    const abort = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(endpoint + "?view=lookup&phone=" + encodeURIComponent(phone), {
          signal: abort.signal, cache: "no-store",
        });
        if (response.status === 403) {
          if (!abort.signal.aborted) setDisabled(true);
          return;
        }
        if (!response.ok) return;
        const value = (await response.json()) as GuestMatch | null;
        if (!abort.signal.aborted) { setMatch(value); setSearched(phone); }
      } catch {
        // Recognition is advisory: network errors never interfere with checkout.
      }
    }, 450);
    return () => { window.clearTimeout(timer); abort.abort(); };
  }, [phone, validLength, disabled, endpoint]);

  const current = validLength && searched === phone;
  return (
    <div className="pos-guest-lookup">
      <label htmlFor="pos-guest-mobile">Mobile number (optional)</label>
      <div className="pos-guest-mobile-field">
        <Phone size={16} aria-hidden="true" />
        <input id="pos-guest-mobile" name="guestMobile" type="tel"
          autoComplete="off" inputMode="tel" maxLength={32} value={phone}
          onChange={(event) => onPhoneChange(event.target.value)}
          placeholder={country === "IN" ? "+91 98765 43210" : "International number, e.g. +971…"} />
        {phone && <button type="button" aria-label="Clear guest number"
          onClick={() => onPhoneChange("")}><X size={15} /></button>}
      </div>
      {current && match && !disabled && (
        <div className="pos-guest-match" role="status">
          <CheckCircle2 size={18} aria-hidden="true" />
          <div>
            <strong>{match.name || "Returning guest"}</strong>
            <small>{match.visits} {match.visits === 1 ? "visit" : "visits"} at this outlet
              {match.lastVisit ? " · Last seen " + new Date(match.lastVisit).toLocaleDateString() : ""}</small>
          </div>
          <Link href={"/dashboard/guests?guest=" + encodeURIComponent(match.id)}
            aria-label="View guest profile"><UserRound size={17} /></Link>
        </div>
      )}
      {current && !match && !disabled && (
        <span className="pos-guest-new">New guest · profile added after checkout</span>
      )}
    </div>
  );
}
