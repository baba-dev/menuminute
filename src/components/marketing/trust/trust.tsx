"use client";

import Link from "next/link";
import {
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ArrowRight, Ban, Check, Minus, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { RollingNumber } from "../rolling-number/rolling-number";
import { formatInr } from "../scan-to-order/scan-to-order-fixture";
import { spotlightVars } from "../scan-to-order/scan-to-order-motion";
import { useSectionMotion } from "../shared/use-section-motion";
import { LEGAL_LINKS, TRUST_CARDS, TRUST_NOTE } from "./trust-fixture";
import {
  HISTORY,
  OUTLETS,
  PEOPLE,
  PERMISSIONS,
  checkAccess,
  initialSubmitState,
  ordersCreated,
  serverTotal,
  submitOrder,
  tryDeleteOrder,
  type Outcome,
  type OutletId,
  type PermissionId,
  type SubmitState,
} from "./trust-logic";
import "./trust.css";

const STATUS_WORD: Record<Outcome["kind"], string> = {
  created: "201 Created",
  duplicate: "200 Same order",
  "key-conflict": "409 Refused",
  "price-conflict": "409 Refused",
};

export function TrustSection() {
  const rootRef = useRef<HTMLElement>(null);
  const { ready, visible } = useSectionMotion(rootRef);

  const [personId, setPersonId] = useState("chen");
  const [outletId, setOutletId] = useState<OutletId>("outlet-a");
  const [permission, setPermission] = useState<PermissionId>("orders.accept");

  const [submitState, setSubmitState] = useState<SubmitState>(initialSubmitState);
  const [keyNo, setKeyNo] = useState(1);
  const [quantity, setQuantity] = useState(1);
  const [quoted, setQuoted] = useState(String(serverTotal(1)));
  const [taps, setTaps] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const [deleteMessage, setDeleteMessage] = useState("");
  const [announcement, setAnnouncement] = useState("");

  const person = PEOPLE.find((item) => item.id === personId) ?? PEOPLE[0]!;
  const access = checkAccess(person, outletId, permission);

  const send = () => {
    const quotedTotalMinor = Number(quoted.replace(/\D/g, "") || "0");
    const result = submitOrder(submitState, `key-${keyNo}`, { quantity, quotedTotalMinor });
    setSubmitState(result.state);
    setOutcome(result.outcome);
    setTaps((value) => value + 1);
    setAnnouncement(`${STATUS_WORD[result.outcome.kind]}. ${result.outcome.message}`);
  };

  const changeQuantity = (next: number) => {
    const value = Math.min(3, Math.max(1, next));
    setQuantity(value);
    setQuoted(String(serverTotal(value))); // a phone quotes what the menu says; tampering is a separate edit
  };

  const onCardMove = (event: ReactPointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const { mx, my } = spotlightVars(
      { x: event.clientX, y: event.clientY },
      { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
    );
    event.currentTarget.style.setProperty("--mx", mx);
    event.currentTarget.style.setProperty("--my", my);
  };

  return (
    <section
      ref={rootRef}
      className="tr"
      aria-labelledby="tr-heading"
      data-testid="trust-section"
      data-ready={ready}
      data-paused={!visible}
    >
      <div className="tr-container">
        <header className="tr-intro" data-reveal>
          <span className="tr-eyebrow">05 / BUILT TO BE TRUSTED</span>
          <span className="tr-badge">TRY TO BREAK IT · ILLUSTRATIVE MODELS · SAMPLE DATA</span>
          <h2 id="tr-heading">
            {["Checked.", "Recorded.", "Reviewed."].map((word, index) => (
              <span className="tr-word" key={word} style={{ "--i": index } as CSSProperties}>
                {word}
              </span>
            ))}
          </h2>
          <p className="tr-lead">
            Don&apos;t take our word for it. Try to do something you shouldn&apos;t, and see what
            the product does about it.
          </p>
        </header>

        <div className="tr-grid">
          {/* 1. Who can do what */}
          <div className="tr-card tr-access" data-reveal>
            <span className="tr-beam" aria-hidden="true" />
            <h3>
              <ShieldCheck size={18} aria-hidden="true" /> Who can do what?
            </h3>
            <p className="tr-hint">
              Every private action asks the database whether this person may do it at this outlet.
              Pick someone and an action.
            </p>
            <div className="tr-people" role="group" aria-label="Person">
              {PEOPLE.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  aria-pressed={personId === item.id}
                  onClick={() => setPersonId(item.id)}
                >
                  <strong>{item.name}</strong>
                  <small>{item.title}</small>
                </button>
              ))}
            </div>
            <div className="tr-row">
              <label className="tr-field">
                <span>Action</span>
                <select
                  value={permission}
                  onChange={(event) => setPermission(event.target.value as PermissionId)}
                >
                  {PERMISSIONS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="tr-outlets" role="group" aria-label="Outlet">
                {OUTLETS.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    aria-pressed={outletId === item.id}
                    onClick={() => setOutletId(item.id)}
                  >
                    {item.name.replace("Spice Route · ", "")}
                  </button>
                ))}
              </div>
            </div>
            <ol
              className="tr-pipe"
              data-allowed={access.allowed}
              key={`${personId}-${outletId}-${permission}`}
              aria-label="Checks"
            >
              {access.steps.map((step, index) => (
                <li
                  key={step.id}
                  data-result={step.result}
                  style={{ "--i": index } as CSSProperties}
                >
                  <span className="tr-mark" aria-hidden="true">
                    {step.result === "pass" ? (
                      <Check size={14} />
                    ) : step.result === "fail" ? (
                      <X size={14} />
                    ) : null}
                  </span>
                  <span>
                    {step.label}
                    <span className="tr-sr">
                      {" "}
                      (
                      {step.result === "pass"
                        ? "passed"
                        : step.result === "fail"
                          ? "failed"
                          : "not reached"}
                      )
                    </span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="tr-verdict" data-allowed={access.allowed} role="status">
              <strong>{access.allowed ? "Allowed" : "Blocked (403)"}</strong> {access.reason}
            </p>
          </div>

          {/* 2. Try to cheat the checkout */}
          <div className="tr-card tr-checkout" data-reveal>
            <h3>
              <Ban size={18} aria-hidden="true" /> Try to cheat the checkout
            </h3>
            <p className="tr-hint">
              The phone sends dishes and a quoted total. The server prices the cart itself and keeps
              one order per key.
            </p>
            <div className="tr-cart">
              <span>Butter Chicken</span>
              <div className="tr-stepper">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  disabled={quantity <= 1}
                  onClick={() => changeQuantity(quantity - 1)}
                >
                  <Minus size={14} aria-hidden="true" />
                </button>
                <b aria-live="off">{quantity}</b>
                <button
                  type="button"
                  aria-label="Increase quantity"
                  disabled={quantity >= 3}
                  onClick={() => changeQuantity(quantity + 1)}
                >
                  <Plus size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
            <dl className="tr-prices">
              <div>
                <dt>Server price</dt>
                <dd>{formatInr(serverTotal(quantity))}</dd>
              </div>
              <div>
                <dt>
                  <label htmlFor="tr-quote">Total the phone sends</label>
                </dt>
                <dd>
                  <span aria-hidden="true">₹</span>
                  <input
                    id="tr-quote"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={String(Math.round(Number(quoted || "0") / 100))}
                    onChange={(event) => {
                      const rupees = event.target.value.replace(/\D/g, "").slice(0, 6);
                      setQuoted(String(Number(rupees || "0") * 100));
                    }}
                  />
                </dd>
              </div>
            </dl>
            <div className="tr-actions">
              <button type="button" className="tr-shimmer" onClick={send}>
                Send order
              </button>
              <button
                type="button"
                className="tr-ghost"
                onClick={() => {
                  setKeyNo((value) => value + 1);
                  setOutcome(null);
                  setAnnouncement("New submission key.");
                }}
              >
                New key
              </button>
              <span className="tr-key">key-{keyNo}</span>
            </div>
            <p className="tr-outcome" data-kind={outcome?.kind ?? "none"} key={taps}>
              {outcome ? (
                <>
                  <b>{STATUS_WORD[outcome.kind]}</b> {outcome.message}
                </>
              ) : (
                "Try sending, then tap again, change the cart, or edit the total."
              )}
            </p>
            <div className="tr-counters">
              <span>
                Taps <RollingNumber text={String(taps)} />
              </span>
              <span>
                Orders created <RollingNumber text={String(ordersCreated(submitState))} />
              </span>
            </div>
          </div>

          {/* 3. History */}
          <div className="tr-card tr-history" data-reveal>
            <h3>
              <Trash2 size={18} aria-hidden="true" /> Try to erase what happened
            </h3>
            <p className="tr-hint">
              Every status change is recorded with who made it: a guest, staff or the system.
            </p>
            <ol className="tr-ledger" aria-label="Table 11 order history">
              {HISTORY.map((event, index) => (
                <li key={event.id} style={{ "--i": index } as CSSProperties}>
                  <span className="tr-actor" data-actor={event.actor}>
                    {event.actor}
                  </span>
                  <span>
                    {event.from ? `${event.from} → ` : "Submitted as "}
                    <b>{event.to}</b>
                  </span>
                </li>
              ))}
            </ol>
            <div className="tr-actions">
              <button
                type="button"
                className="tr-ghost"
                onClick={() => {
                  const result = tryDeleteOrder(HISTORY);
                  setDeleteMessage(result.message);
                  setAnnouncement(result.message);
                }}
              >
                <Trash2 size={14} aria-hidden="true" /> Try to delete this order
              </button>
            </div>
            <p
              className="tr-outcome"
              data-kind={deleteMessage ? "key-conflict" : "none"}
              role="status"
            >
              {deleteMessage || "Orders are never removed along with their history."}
            </p>
          </div>
        </div>

        <div className="tr-cards">
          {TRUST_CARDS.map((card) => (
            <article
              className="tr-card tr-spot"
              key={card.title}
              data-reveal
              onPointerMove={onCardMove}
            >
              <h3>{card.title}</h3>
              <p>{card.body}</p>
              <Link href={card.href}>
                {card.cta} <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>

        <p className="tr-legal">
          {LEGAL_LINKS.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </p>
        <p className="tr-note">{TRUST_NOTE}</p>
        <div className="tr-sr" role="status" aria-live="polite">
          {announcement}
        </div>
      </div>
    </section>
  );
}
