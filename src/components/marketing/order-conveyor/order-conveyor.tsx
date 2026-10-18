"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  ClipboardCheck,
  ListChecks,
  RotateCcw,
  ShoppingBasket,
  UtensilsCrossed,
} from "lucide-react";
import { DESKTOP_ORDER_CONVEYOR, MOBILE_ORDER_CONVEYOR } from "./order-conveyor-art";
import "./order-conveyor.css";

const capabilities = [
  {
    title: "Build a basket",
    detail: "Dish selections, quantities, variants and add-ons.",
    Icon: ShoppingBasket,
  },
  {
    title: "Dine-in or pickup",
    detail: "Ordering options suited to your outlet.",
    Icon: UtensilsCrossed,
  },
  {
    title: "Receive requests",
    detail: "Restaurant-controlled acceptance and decline.",
    Icon: ClipboardCheck,
  },
  {
    title: "Follow progress",
    detail: "A clearer guest journey after submission.",
    Icon: ListChecks,
  },
] as const;

/** Inline only our static, repository-reviewed SVGs: never user-submitted markup. */
export function OrderConveyor() {
  const rootRef = useRef<HTMLElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  const replay = useCallback(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    root.dataset.state = "playing";
    for (const svg of root.querySelectorAll<SVGSVGElement>("svg.oc-svg")) {
      svg.classList.remove("oc-play");
      void svg.getBoundingClientRect();
      svg.classList.add("oc-play");
    }
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const artwork = Array.from(root.querySelectorAll<SVGSVGElement>("svg.oc-svg"));
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    let started = false;

    const syncTheme = () => {
      const theme = document.documentElement.dataset.theme;
      for (const svg of artwork) {
        if (theme === "light" || theme === "dark") svg.dataset.theme = theme;
        else svg.removeAttribute("data-theme");
      }
    };
    const syncPause = () => {
      const paused = document.hidden || !visible;
      for (const svg of artwork) svg.dataset.paused = String(paused);
      root.dataset.paused = String(paused);
    };
    const syncPreference = () => {
      setReducedMotion(preference.matches);
      if (preference.matches) {
        root.dataset.state = "static";
        for (const svg of artwork) svg.classList.remove("oc-play");
      } else if (visible && !started) {
        started = true;
        root.dataset.state = "playing";
        for (const svg of artwork) svg.classList.add("oc-play");
      }
      syncPause();
    };
    const onAnimationEnd = (event: AnimationEvent) => {
      if (event.animationName === "oc-accepted") root.dataset.state = "complete";
    };

    const themeObserver = new MutationObserver(syncTheme);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            ([entry]) => {
              visible = Boolean(entry?.isIntersecting);
              if (visible && !started && !preference.matches) {
                started = true;
                root.dataset.state = "playing";
                for (const svg of artwork) svg.classList.add("oc-play");
              }
              syncPause();
            },
            { threshold: 0.08 }
          );

    root.dataset.state = "ready";
    syncTheme();
    syncPreference();
    if (observer) observer.observe(root.querySelector(".oc-artwork") ?? root);
    else {
      visible = true;
      syncPreference();
    }
    preference.addEventListener("change", syncPreference);
    document.addEventListener("visibilitychange", syncPause);
    root.addEventListener("animationend", onAnimationEnd);

    return () => {
      observer?.disconnect();
      themeObserver.disconnect();
      preference.removeEventListener("change", syncPreference);
      document.removeEventListener("visibilitychange", syncPause);
      root.removeEventListener("animationend", onAnimationEnd);
    };
  }, []);

  return (
    <section
      ref={rootRef}
      className="order-conveyor"
      aria-labelledby="order-conveyor-heading"
      data-testid="order-conveyor"
      data-state="ready"
      data-paused="true"
    >
      <div className="oc-container">
        <header className="oc-intro">
          <span className="oc-eyebrow">04 / WHAT&apos;S COOKING NEXT</span>
          <span className="oc-roadmap">ONLINE ORDERING · IN DEVELOPMENT</span>
          <h2 id="order-conveyor-heading">From craving to <em>counter.</em></h2>
          <p className="oc-lead">Your menu could soon do more than look delicious.</p>
          <p className="oc-description">
            We&apos;re building an effortless way for guests to choose their favourites,
            customise dishes and send dine-in or pickup requests directly to your restaurant.
          </p>
        </header>

        <div
          className="oc-artwork"
          data-testid="order-conveyor-stage"
          aria-label="Illustrative future ordering journey: menu, basket, order request and restaurant acceptance"
          role="img"
        >
          <div
            className="oc-desktop-art"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: DESKTOP_ORDER_CONVEYOR }}
          />
          <div
            className="oc-mobile-art"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: MOBILE_ORDER_CONVEYOR }}
          />
        </div>

        <div className="oc-toolbar">
          <span>Concept preview · No real orders or payments are placed</span>
          <button
            type="button"
            onClick={replay}
            disabled={reducedMotion}
            aria-label="Replay Order Conveyor animation"
            title={reducedMotion ? "Static preview for reduced motion" : "Replay animation"}
          >
            <RotateCcw size={16} aria-hidden="true" />
            Replay
          </button>
          {reducedMotion && <span className="oc-reduced">Static preview for reduced motion</span>}
        </div>

        <div className="oc-capabilities" aria-label="Planned ordering capabilities">
          {capabilities.map(({ title, detail, Icon }) => (
            <div className="oc-capability" key={title}>
              <span className="oc-capability-icon"><Icon size={21} strokeWidth={1.8} aria-hidden="true" /></span>
              <span><strong>{title}</strong><small>{detail}</small></span>
            </div>
          ))}
        </div>

        <div className="oc-outro">
          <div>
            <h3>Great food deserves an easier way to order.</h3>
            <p>Online Ordering is in development and is not yet available for purchase. Start with a free QR menu today.</p>
          </div>
          <div className="oc-links">
            <Link className="oc-primary" href="/pricing">
              Explore future plans <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
            <Link className="oc-secondary" href="/register">
              Create your free menu <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
