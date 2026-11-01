"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, BellRing, Flame, Wallet, X } from "lucide-react";
import { EMBER_POPUP_EVENT } from "@/lib/ember-events";
import { usePopupPreference } from "@/lib/use-popup-preference";
import {
  POPUP_LIFETIME_MS,
  POPUP_META,
  pushPopup,
  type EmberPopup,
  type PopupKind,
} from "@/modules/dashboard/ember-popups";
import "./ember.css";

const ICONS = { bell: Bell, flame: Flame, "bell-ring": BellRing, wallet: Wallet } as const;

function Popup({ popup, onDone }: { popup: EmberPopup; onDone: (id: string) => void }) {
  const meta = POPUP_META[popup.kind];
  const Icon = ICONS[meta.icon];
  const [leaving, setLeaving] = useState(false);
  const [hold, setHold] = useState(false);
  const paused = useRef(false);
  const remaining = useRef(POPUP_LIFETIME_MS);
  const started = useRef(0);
  const timer = useRef<number | null>(null);

  const close = useCallback(() => {
    setLeaving(true);
    window.setTimeout(() => onDone(popup.id), 140);
  }, [onDone, popup.id]);

  const start = useCallback(() => {
    started.current = Date.now();
    timer.current = window.setTimeout(close, remaining.current);
  }, [close]);
  const stop = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    remaining.current = Math.max(500, remaining.current - (Date.now() - started.current));
  }, []);

  useEffect(() => {
    start();
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, [start]);

  const pause = () => {
    if (paused.current) return;
    paused.current = true;
    stop();
    setHold(true);
  };
  const resume = () => {
    if (!paused.current) return;
    paused.current = false;
    setHold(false);
    start();
  };

  return (
    <li
      className="mm-ember-popup"
      data-kind={popup.kind}
      data-leaving={leaving ? "true" : undefined}
      data-paused={hold ? "true" : undefined}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
      onKeyDown={(event) => {
        if (event.key === "Escape") close();
      }}
    >
      <span className="mm-ember-popup-chip" aria-hidden="true">
        <Icon size={16} />
      </span>
      <div className="mm-ember-popup-copy">
        <span className="mm-ember-popup-kind">{meta.label}</span>
        <strong>{popup.title}</strong>
        {popup.detail && <small>{popup.detail}</small>}
        {popup.href && (
          <Link href={popup.href} className="mm-ember-popup-link" onClick={close}>
            View
          </Link>
        )}
      </div>
      <button type="button" className="mm-ember-popup-close" aria-label="Dismiss" onClick={close}>
        <X size={14} aria-hidden="true" />
      </button>
      <span
        className="mm-ember-popup-timer"
        aria-hidden="true"
        style={{ animationDuration: POPUP_LIFETIME_MS + "ms" }}
      />
    </li>
  );
}

/** Subtle, dismissible, auto-hiding notices. Never takes focus; at most three at a time. */
export function EmberPopups() {
  const [popups, setPopups] = useState<EmberPopup[]>([]);
  const { preference } = usePopupPreference();
  const prefRef = useRef(preference);
  useEffect(() => {
    prefRef.current = preference;
  }, [preference]);

  useEffect(() => {
    const onPopup = (event: Event) => {
      const incoming = (event as CustomEvent<{ popups?: EmberPopup[] }>).detail?.popups;
      if (!Array.isArray(incoming)) return;
      const pref = prefRef.current;
      if (!pref.enabled) return;
      const allowed = incoming.filter((p) => pref.kinds[p.kind as PopupKind]);
      if (allowed.length) setPopups((current) => pushPopup(current, allowed));
    };
    window.addEventListener(EMBER_POPUP_EVENT, onPopup);
    return () => window.removeEventListener(EMBER_POPUP_EVENT, onPopup);
  }, []);

  const done = useCallback(
    (id: string) => setPopups((current) => current.filter((p) => p.id !== id)),
    []
  );

  return (
    <ul className="mm-ember-popups" aria-label="Ember notices" role="status" aria-live="polite">
      {popups.map((popup) => (
        <Popup key={popup.id} popup={popup} onDone={done} />
      ))}
    </ul>
  );
}
