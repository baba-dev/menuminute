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
import { ArrowRight, Check, ChefHat, Minus, Plus, ScanLine, X } from "lucide-react";
import {
  CAPABILITY_CARDS,
  CURRENCY_SAMPLES,
  SAMPLE_CATEGORIES,
  SAMPLE_DISHES,
  SAMPLE_OUTLET_NAME,
  SAMPLE_SORTS,
  SAMPLE_TABLE,
  SCAN_TO_ORDER_NOTE,
  arrangeDishes,
  formatInr,
  sampleDish,
  type SortId,
} from "./scan-to-order-fixture";
import {
  cartTotals,
  changeCart,
  flipDelta,
  rollColumns,
  spotlightVars,
  tiltFor,
  type CartLine,
} from "./scan-to-order-motion";
import "./scan-to-order.css";

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

/** Rolling number: every digit is a column that slides to its value (Magic UI "number ticker"). */
function Roll({ text }: { text: string }) {
  const columns = rollColumns(text);
  return (
    <span className="sto-roll">
      <span className="sto-sr">{text}</span>
      <span className="sto-roll__visual" aria-hidden="true">
        {columns.map((column, index) => {
          const key = columns.length - index; // right-aligned, so a longer number keeps its low digits
          return column.kind === "digit" ? (
            <span
              className="sto-roll__col"
              key={key}
              style={{ "--d": column.digit } as CSSProperties}
            >
              <span className="sto-roll__strip">
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

function QrCorners() {
  return (
    <>
      <i className="sto-corner sto-corner--tl" />
      <i className="sto-corner sto-corner--tr" />
      <i className="sto-corner sto-corner--bl" />
      <i className="sto-corner sto-corner--br" />
    </>
  );
}

export function ScanToOrder({ qrDataUrl }: { qrDataUrl: string }) {
  const rootRef = useRef<HTMLElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLLIElement>());
  const lastBoxes = useRef(new Map<string, { left: number; top: number }>());
  const openerRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const userScanned = useRef(false);

  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [visible, setVisible] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<SortId>("popular");
  const [openDish, setOpenDish] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [sent, setSent] = useState(false);
  const [flight, setFlight] = useState(0);
  const [currencyIndex, setCurrencyIndex] = useState(0);
  const [currencyPicked, setCurrencyPicked] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const dishes = arrangeDishes(category, sort);
  const totals = cartTotals(cart, (id) => sampleDish(id)?.priceMinor ?? 0);

  // Mount: flag scripting, track reduced motion and visibility, reveal pieces once, sync theme-free.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => {
      setReduced(preference.matches);
      if (preference.matches) setScanned(true);
    };
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
      {
        threshold: 0.25,
      }
    );
    presence.observe(root);
    return () => {
      preference.removeEventListener("change", syncPreference);
      reveal.disconnect();
      presence.disconnect();
    };
  }, []);

  // The viewfinder scans on its own once the stage is seen; the button always works too.
  useEffect(() => {
    if (!ready || !visible || reduced || scanned || userScanned.current) return;
    const timer = window.setTimeout(() => setScanned(true), 1800);
    return () => window.clearTimeout(timer);
  }, [ready, visible, reduced, scanned]);

  // The currency card cycles gently until the visitor picks one.
  useEffect(() => {
    if (!ready || !visible || reduced || currencyPicked) return;
    const timer = window.setInterval(
      () => setCurrencyIndex((index) => (index + 1) % CURRENCY_SAMPLES.length),
      2600
    );
    return () => window.clearInterval(timer);
  }, [ready, visible, reduced, currencyPicked]);

  // FLIP: when the list reorders, each dish glides from its old position (transform only).
  useLayoutEffect(() => {
    const next = new Map<string, { left: number; top: number }>();
    for (const [id, element] of itemRefs.current) {
      next.set(id, { left: element.offsetLeft, top: element.offsetTop });
      const before = lastBoxes.current.get(id);
      if (!before || reduced || typeof element.animate !== "function") continue;
      const delta = flipDelta(
        { ...before, width: 0, height: 0 },
        { ...next.get(id)!, width: 0, height: 0 }
      );
      if (delta.x === 0 && delta.y === 0) continue;
      element.animate(
        [{ transform: `translate(${delta.x}px, ${delta.y}px)` }, { transform: "none" }],
        { duration: 340, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
      );
    }
    lastBoxes.current = next;
  }, [category, sort, reduced, scanned]);

  // Sheet focus: move into the sheet on open, back to the opener on close.
  useEffect(() => {
    if (openDish) closeRef.current?.focus();
  }, [openDish]);

  const closeSheet = useCallback(() => {
    setOpenDish(null);
    openerRef.current?.focus();
  }, []);

  const scan = () => {
    userScanned.current = true;
    setScanned(true);
  };

  const openSheet = (id: string, opener: HTMLElement) => {
    openerRef.current = opener;
    setQuantity(1);
    setOpenDish(id);
  };

  const addToCart = (id: string, amount: number) => {
    const dish = sampleDish(id);
    if (!dish || sent) return;
    setCart((lines) => changeCart(lines, id, amount));
    setAnnouncement(`Added ${amount} ${dish.name}. Preview basket updated.`);
  };

  const send = () => {
    if (cart.length === 0 || sent) return;
    setSent(true);
    setFlight((value) => value + 1);
    setAnnouncement(
      "Preview order sent. The kitchen tile now shows one request awaiting acceptance."
    );
  };

  const resetPreview = () => {
    setCart([]);
    setSent(false);
    setOpenDish(null);
    setAnnouncement("Preview reset.");
  };

  // Phone tilt follows the pointer (mouse or pen), written to CSS variables, never to React state.
  const tilt = useRef<{ frame: number; x: number; y: number }>({ frame: 0, x: 0, y: 0 });
  const onStageMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (reduced || event.pointerType === "touch") return;
    const stage = event.currentTarget;
    tilt.current.x = event.clientX;
    tilt.current.y = event.clientY;
    if (tilt.current.frame) return;
    tilt.current.frame = requestAnimationFrame(() => {
      tilt.current.frame = 0;
      const rect = stage.getBoundingClientRect();
      const { rx, ry } = tiltFor(
        { x: tilt.current.x, y: tilt.current.y },
        { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
      );
      phoneRef.current?.style.setProperty("--rx", `${rx}deg`);
      phoneRef.current?.style.setProperty("--ry", `${ry}deg`);
    });
  };
  const onStageLeave = () => {
    phoneRef.current?.style.setProperty("--rx", "0deg");
    phoneRef.current?.style.setProperty("--ry", "0deg");
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

  const sheetDish = openDish ? sampleDish(openDish) : undefined;
  const currency = CURRENCY_SAMPLES[currencyIndex]!;
  const marqueeChips = SAMPLE_DISHES.flatMap((dish) => [dish, dish]).map((dish, index) => (
    <li key={`${dish.id}-${index}`}>
      {dish.name} <b>{formatInr(dish.priceMinor)}</b>
    </li>
  ));

  return (
    <section
      ref={rootRef}
      className="sto"
      aria-labelledby="sto-heading"
      data-testid="scan-to-order"
      data-ready={ready}
      data-paused={!visible}
      data-scanned={scanned}
    >
      <div className="sto-container">
        <header className="sto-intro" data-reveal>
          <span className="sto-eyebrow">02 / THE GUEST SIDE</span>
          <span className="sto-badge">PREVIEW · SAMPLE MENU · NO REAL ORDERS</span>
          <h2 id="sto-heading">
            {["Scan.", "Tap.", "Ordered."].map((word, index) => (
              <span className="sto-word" key={word} style={{ "--i": index } as CSSProperties}>
                {word}{" "}
              </span>
            ))}
          </h2>
          <p className="sto-lead">
            Here is what the order that landed on Table 11 looked like from the other side of the
            table.
          </p>
        </header>

        <div className="sto-grid">
          {/* Stage: a phone that tilts toward the pointer and scans a real QR. */}
          <div
            className="sto-stage"
            data-reveal
            onPointerMove={onStageMove}
            onPointerLeave={onStageLeave}
          >
            <div className="sto-phone" ref={phoneRef}>
              <div className="sto-phone__notch" aria-hidden="true" />
              <div className="sto-screen" data-scanned={scanned}>
                <div className="sto-menu" inert={ready && !scanned}>
                  <header className="sto-menu__head">
                    <strong>{SAMPLE_OUTLET_NAME}</strong>
                    <span>{SAMPLE_TABLE} · sample menu</span>
                  </header>

                  <div className="sto-pills" role="group" aria-label="Menu category">
                    {SAMPLE_CATEGORIES.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        aria-pressed={category === item.id}
                        onClick={() => setCategory(item.id)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <div className="sto-sorts" role="group" aria-label="Sort dishes">
                    {SAMPLE_SORTS.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        aria-pressed={sort === item.id}
                        onClick={() => setSort(item.id)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  <ul className="sto-dishes" aria-label="Sample dishes">
                    {dishes.map((dish, index) => (
                      <li
                        key={dish.id}
                        ref={(element) => {
                          if (element) itemRefs.current.set(dish.id, element);
                          else itemRefs.current.delete(dish.id);
                        }}
                        style={{ "--i": index } as CSSProperties}
                      >
                        <button
                          type="button"
                          className="sto-dish"
                          onClick={(event) => openSheet(dish.id, event.currentTarget)}
                          aria-haspopup="dialog"
                        >
                          <span className="sto-dish__name">{dish.name}</span>
                          <span className="sto-dish__price">{formatInr(dish.priceMinor)}</span>
                        </button>
                        <button
                          type="button"
                          className="sto-plus"
                          aria-label={`Add ${dish.name} to the preview basket`}
                          disabled={sent}
                          onClick={() => addToCart(dish.id, 1)}
                        >
                          <Plus size={16} aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>

                  <div className="sto-basket">
                    <span className="sto-basket__sum">
                      <Roll text={String(totals.count)} />
                      <span>{totals.count === 1 ? "item" : "items"}</span>
                      <Roll text={formatInr(totals.totalMinor)} />
                    </span>
                    <button
                      type="button"
                      className="sto-shimmer"
                      onClick={send}
                      disabled={cart.length === 0 || sent}
                    >
                      {sent ? (
                        <>
                          <Check size={15} aria-hidden="true" /> Sent
                        </>
                      ) : (
                        "Send to kitchen"
                      )}
                    </button>
                  </div>

                  {sheetDish && (
                    <div
                      className="sto-sheet"
                      role="dialog"
                      aria-label={`${sheetDish.name} details`}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") closeSheet();
                      }}
                    >
                      <button
                        type="button"
                        ref={closeRef}
                        className="sto-sheet__close"
                        aria-label="Close dish details"
                        onClick={closeSheet}
                      >
                        <X size={16} aria-hidden="true" />
                      </button>
                      <h3>{sheetDish.name}</h3>
                      <p>{sheetDish.blurb}</p>
                      <p className="sto-sheet__note">
                        Sample dish. No allergen or dietary information is claimed.
                      </p>
                      <div className="sto-stepper">
                        <button
                          type="button"
                          aria-label="Decrease quantity"
                          disabled={quantity <= 1}
                          onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                        >
                          <Minus size={15} aria-hidden="true" />
                        </button>
                        <Roll text={String(quantity)} />
                        <button
                          type="button"
                          aria-label="Increase quantity"
                          disabled={quantity >= 9}
                          onClick={() => setQuantity((value) => Math.min(9, value + 1))}
                        >
                          <Plus size={15} aria-hidden="true" />
                        </button>
                      </div>
                      <button
                        type="button"
                        className="sto-shimmer sto-shimmer--wide"
                        disabled={sent}
                        onClick={() => {
                          addToCart(sheetDish.id, quantity);
                          closeSheet();
                        }}
                      >
                        Add {quantity} · {formatInr(sheetDish.priceMinor * quantity)}
                      </button>
                    </div>
                  )}
                </div>

                <div className="sto-scan" aria-hidden={scanned}>
                  <div className="sto-viewfinder">
                    {/* eslint-disable-next-line @next/next/no-img-element -- inline data URL, server generated */}
                    <img
                      src={qrDataUrl}
                      alt="QR code to the sample menu"
                      width={176}
                      height={176}
                    />
                    <QrCorners />
                    <span className="sto-laser" aria-hidden="true" />
                  </div>
                  <p>Point your phone at the table QR</p>
                  <button
                    type="button"
                    className="sto-shimmer"
                    onClick={scan}
                    tabIndex={scanned ? -1 : 0}
                  >
                    <ScanLine size={15} aria-hidden="true" /> Scan the QR
                  </button>
                </div>
              </div>
            </div>
            <span className="sto-beam" aria-hidden="true" />
          </div>

          {/* The order's journey: tickets build up, then fly to a kitchen tile. */}
          <aside className="sto-card sto-flight" data-reveal aria-label="Order flight preview">
            <h3>The order, as the kitchen sees it</h3>
            <ol className="sto-tickets" aria-label="Preview tickets">
              {cart.length === 0 && (
                <li className="sto-tickets__empty">Add a dish on the phone to start a ticket.</li>
              )}
              {cart.map((line) => (
                <li key={line.dishId} className="sto-ticket" data-sent={sent}>
                  <span>{sampleDish(line.dishId)?.name}</span>
                  <b>× {line.quantity}</b>
                </li>
              ))}
            </ol>
            <div className="sto-kitchen" data-sent={sent}>
              <span className="sto-kitchen__icon" aria-hidden="true">
                <ChefHat size={18} />
              </span>
              <div>
                <small>Awaiting acceptance</small>
                <strong>
                  <Roll text={sent ? "1" : "0"} />
                </strong>
                <small>{SAMPLE_TABLE} · restaurant accepts or declines</small>
              </div>
              {sent && (
                <span className="sto-particles" aria-hidden="true" key={flight}>
                  {[0, 1, 2, 3, 4].map((index) => (
                    <i key={index} style={{ "--i": index } as CSSProperties} />
                  ))}
                </span>
              )}
            </div>
            {sent && (
              <button type="button" className="sto-reset" onClick={resetPreview}>
                Reset the preview
              </button>
            )}
          </aside>

          {/* Same dish, priced by outlets in their own currencies. */}
          <div className="sto-card sto-currency" data-reveal>
            <h3>Priced in your currency</h3>
            <div className="sto-currency__price" data-code={currency.code}>
              <Roll text={`${currency.symbol}${currency.amount}`} />
            </div>
            <div className="sto-currency__tabs" role="group" aria-label="Sample currency">
              {CURRENCY_SAMPLES.map((item, index) => (
                <button
                  type="button"
                  key={item.code}
                  aria-pressed={currencyIndex === index}
                  onClick={() => {
                    setCurrencyPicked(true);
                    setCurrencyIndex(index);
                  }}
                >
                  {item.code}
                </button>
              ))}
            </div>
            <small>Illustrative price points. Each outlet sets its own prices.</small>
          </div>
        </div>

        <div className="sto-marquee" aria-hidden="true">
          {[false, true].map((reverse) => (
            <div className="sto-marquee__row" data-reverse={reverse} key={String(reverse)}>
              <ul>{marqueeChips}</ul>
              <ul>{marqueeChips}</ul>
            </div>
          ))}
        </div>

        <div className="sto-cards">
          {CAPABILITY_CARDS.map((card) => (
            <article
              className="sto-card sto-spot"
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

        <p className="sto-note">{SCAN_TO_ORDER_NOTE}</p>
        <div className="sto-sr" role="status" aria-live="polite">
          {announcement}
        </div>
      </div>
    </section>
  );
}
