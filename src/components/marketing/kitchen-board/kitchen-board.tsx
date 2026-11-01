"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ArrowRight, Check, ChefHat, Circle, Play, RotateCcw } from "lucide-react";
import { RollingNumber } from "../rolling-number/rolling-number";
import { spotlightVars } from "../scan-to-order/scan-to-order-motion";
import { sampleDish } from "../scan-to-order/scan-to-order-fixture";
import { KITCHEN_CARDS, KITCHEN_NOTE } from "./kitchen-board-fixture";
import {
  ACTION_LABEL,
  FOCUS_TICKET_ID,
  SAMPLE_MINUTES_PER_SECOND,
  STAGE_LABEL,
  advanceTicket,
  ageMinutes,
  ageTone,
  autoStep,
  canAdvance,
  confettiBurst,
  isAutoplayDone,
  lineName,
  seedTickets,
  stationOf,
  summarise,
  toggleLine,
  trackerSteps,
  type Stage,
  type Ticket,
} from "./kitchen-board-logic";
import "./kitchen-board.css";

const COLUMNS: readonly Exclude<Stage, "served">[] = ["new", "preparing", "ready"];
const AUTOPLAY_MS = 1300;

export function KitchenBoard() {
  const rootRef = useRef<HTMLElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLLIElement>());
  const lastBoxes = useRef(new Map<string, { left: number; top: number }>());

  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [visible, setVisible] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>(seedTickets);
  const [clock, setClock] = useState(0);
  const [autoplay, setAutoplay] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const running = autoplay && !isAutoplayDone(tickets);
  const focus = tickets.find((ticket) => ticket.id === FOCUS_TICKET_ID);
  const focusStage = focus?.stage ?? "new";
  const tracker = trackerSteps(focusStage);
  const doneCount = tracker.steps.filter((step) => step.state === "done").length;
  const progress = focusStage === "served" ? 1 : doneCount / (tracker.steps.length - 1);
  const summary = summarise(tickets, tickets.filter((ticket) => ticket.stage === "served").length);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setReduced(preference.matches);
    setReady(true);
    syncPreference();
    preference.addEventListener("change", syncPreference);
    const reveal = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).dataset.in = "true";
            reveal.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12 }
    );
    for (const element of root.querySelectorAll<HTMLElement>("[data-reveal]")) {
      reveal.observe(element);
    }
    const presence = new IntersectionObserver(
      ([entry]) => setVisible(Boolean(entry?.isIntersecting)),
      { threshold: 0.2 }
    );
    presence.observe(root);
    return () => {
      preference.removeEventListener("change", syncPreference);
      reveal.disconnect();
      presence.disconnect();
    };
  }, []);

  // The sample clock only runs while the board is on screen and the tab is visible.
  useEffect(() => {
    if (!ready || !visible) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setClock((value) => value + SAMPLE_MINUTES_PER_SECOND);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [ready, visible]);

  // "Watch it run" walks the Table 11 ticket through every stage.
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setTickets((current) => autoStep(current)), AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [running]);

  // FLIP: tickets glide to their new column (transform only), measured relative to the board.
  const signature = tickets.map((ticket) => `${ticket.id}:${ticket.stage}`).join("|");
  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const origin = board.getBoundingClientRect();
    const next = new Map<string, { left: number; top: number }>();
    for (const [id, element] of itemRefs.current) {
      const rect = element.getBoundingClientRect();
      const position = { left: rect.left - origin.left, top: rect.top - origin.top };
      next.set(id, position);
      const before = lastBoxes.current.get(id);
      if (!before || reduced || typeof element.animate !== "function") continue;
      const dx = Math.round(before.left - position.left);
      const dy = Math.round(before.top - position.top);
      if (dx === 0 && dy === 0) continue;
      element.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], {
        duration: 420,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      });
    }
    lastBoxes.current = next;
  }, [signature, reduced]);

  const advance = (ticket: Ticket) => {
    if (!canAdvance(ticket) || ticket.stage === "served") return;
    setTickets((current) => advanceTicket(current, ticket.id));
    const to =
      ticket.stage === "new" ? "preparing" : ticket.stage === "preparing" ? "ready" : "served";
    setAnnouncement(`${ticket.label} moved to ${STAGE_LABEL[to]}.`);
  };

  const reset = useCallback(() => {
    setAutoplay(false);
    setTickets(seedTickets());
    setClock(0);
    setAnnouncement("Preview reset.");
  }, []);

  const watch = () => {
    setTickets(seedTickets());
    setClock(0);
    setAutoplay(true);
    setAnnouncement("Watching the Table 11 ticket run.");
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
      className="kb"
      aria-labelledby="kb-heading"
      data-testid="kitchen-board"
      data-ready={ready}
      data-paused={!visible}
      data-focus-stage={focusStage}
    >
      <div className="kb-container">
        <header className="kb-intro" data-reveal>
          <span className="kb-eyebrow">03 / THE KITCHEN SIDE</span>
          <span className="kb-badge">PREVIEW · KITCHEN PRO IS IN DEVELOPMENT · SAMPLE TICKETS</span>
          <h2 id="kb-heading">
            {["Fired.", "Plated.", "Served."].map((word, index) => (
              <span className="kb-word" key={word} style={{ "--i": index } as CSSProperties}>
                {word}{" "}
              </span>
            ))}
          </h2>
          <p className="kb-lead">
            The Table 11 order lands on the pass. Accept it, tick off each dish, and watch the
            guest&apos;s screen follow along.
          </p>
        </header>

        <div className="kb-controls" data-reveal>
          <button type="button" className="kb-shimmer" onClick={watch} disabled={running}>
            <Play size={15} aria-hidden="true" /> {running ? "Running…" : "Watch it run"}
          </button>
          <button type="button" className="kb-ghost" onClick={reset}>
            <RotateCcw size={15} aria-hidden="true" /> Reset
          </button>
          <span className="kb-clock">Sample clock: one second is one minute</span>
        </div>

        <div className="kb-grid">
          <div className="kb-board" ref={boardRef} data-reveal>
            <span className="kb-beam" aria-hidden="true" />
            {COLUMNS.map((stage) => {
              const inColumn = tickets.filter((ticket) => ticket.stage === stage);
              return (
                <section
                  className="kb-col"
                  key={stage}
                  aria-label={`${STAGE_LABEL[stage]} tickets`}
                >
                  <h3>
                    {STAGE_LABEL[stage]} <b>{inColumn.length}</b>
                  </h3>
                  <ul>
                    {inColumn.length === 0 && (
                      <li className="kb-empty">
                        {stage === "new"
                          ? "No new tickets"
                          : `Nothing ${STAGE_LABEL[stage].toLowerCase()}`}
                      </li>
                    )}
                    {inColumn.map((ticket) => {
                      const minutes = ageMinutes(ticket, clock);
                      const age = ageTone(minutes);
                      return (
                        <li
                          key={ticket.id}
                          ref={(element) => {
                            if (element) itemRefs.current.set(ticket.id, element);
                            else itemRefs.current.delete(ticket.id);
                          }}
                          className="kb-ticket"
                          data-stage={ticket.stage}
                          data-tone={age.tone}
                          data-focus={Boolean(ticket.focus)}
                          data-testid={`ticket-${ticket.id}`}
                        >
                          <div className="kb-ticket__head">
                            <strong>{ticket.label}</strong>
                            <span className="kb-chip">
                              {ticket.kind === "pickup" ? "Pickup" : "Dine-in"}
                            </span>
                          </div>
                          <div className="kb-age" data-tone={age.tone}>
                            <RollingNumber text={String(minutes)} /> min · <b>{age.label}</b>
                          </div>
                          <ul className="kb-lines" aria-label={`${ticket.label} dishes`}>
                            {ticket.lines.map((line) => (
                              <li key={line.dishId}>
                                {ticket.stage === "preparing" ? (
                                  <button
                                    type="button"
                                    className="kb-line"
                                    aria-pressed={line.done}
                                    onClick={() =>
                                      setTickets((current) =>
                                        toggleLine(current, ticket.id, line.dishId)
                                      )
                                    }
                                  >
                                    {line.done ? (
                                      <Check size={14} aria-hidden="true" />
                                    ) : (
                                      <Circle size={14} aria-hidden="true" />
                                    )}
                                    <span>
                                      {line.quantity}× {lineName(line)}
                                    </span>
                                    <small>{stationOf(sampleDish(line.dishId))}</small>
                                  </button>
                                ) : (
                                  <span className="kb-line kb-line--static">
                                    <span>
                                      {line.quantity}× {lineName(line)}
                                    </span>
                                    <small>{stationOf(sampleDish(line.dishId))}</small>
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                          <button
                            type="button"
                            className="kb-action"
                            disabled={!canAdvance(ticket)}
                            onClick={() => advance(ticket)}
                            aria-label={`${ACTION_LABEL[stage]} ${ticket.label} ticket`}
                            title={
                              canAdvance(ticket)
                                ? undefined
                                : "Tick every dish done before marking ready"
                            }
                          >
                            {ACTION_LABEL[stage]}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>

          <aside className="kb-guest" data-reveal aria-label="Guest view preview">
            <div className="kb-guest__bar">
              <span className="kb-guest__icon" aria-hidden="true">
                <ChefHat size={16} />
              </span>
              <div>
                <strong>Guest view</strong>
                <small>Table 11 · illustrative</small>
              </div>
            </div>
            <ol
              className="kb-track"
              style={{ "--p": progress } as CSSProperties}
              aria-label="Order progress"
            >
              {tracker.steps.map((step) => (
                <li key={step.id} data-state={step.state}>
                  <span className="kb-dot" aria-hidden="true" />
                  <span>
                    {step.label}
                    {step.state !== "todo" && (
                      <span className="kb-sr"> ({step.state === "done" ? "done" : "current"})</span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
            <p className="kb-guest__msg" data-stage={focusStage}>
              {tracker.message}
            </p>
            {focusStage === "served" && (
              <span className="kb-confetti" aria-hidden="true">
                {confettiBurst().map((piece, index) => (
                  <i
                    key={index}
                    data-hue={piece.hue}
                    style={{ "--x": `${piece.x}px`, "--y": `${piece.y}px` } as CSSProperties}
                  />
                ))}
              </span>
            )}
          </aside>
        </div>

        <div className="kb-stats" data-reveal aria-label="Sample board totals">
          <div>
            <strong>
              <RollingNumber text={String(summary.onPass)} />
            </strong>
            <span>On the pass</span>
          </div>
          <div>
            <strong>
              <RollingNumber text={String(summary.ready)} />
            </strong>
            <span>Ready to serve</span>
          </div>
          <div>
            <strong>
              <RollingNumber text={String(summary.served)} />
            </strong>
            <span>Served</span>
          </div>
        </div>

        <div className="kb-cards">
          {KITCHEN_CARDS.map((card) => (
            <article className="kb-card" key={card.title} data-reveal onPointerMove={onCardMove}>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
              <Link href={card.href}>
                {card.cta} <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>

        <p className="kb-note">{KITCHEN_NOTE}</p>
        <div className="kb-sr" role="status" aria-live="polite">
          {announcement}
        </div>
      </div>
    </section>
  );
}
