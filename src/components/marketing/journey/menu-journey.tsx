"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Images,
  QrCode,
  Smartphone,
  UtensilsCrossed,
} from "lucide-react";
import "./menu-journey.css";

/** Original decorative SVG artwork; adjacent HTML carries the accessible story. */
function CreateArtwork() {
  return (
    <svg viewBox="0 0 340 300" aria-hidden="true" focusable="false" className="mj-art-svg">
      <defs>
        <linearGradient id="mj-create-cover" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFB449" />
          <stop offset="1" stopColor="#F36829" />
        </linearGradient>
      </defs>
      <ellipse cx="161" cy="272" rx="120" ry="12" fill="var(--mj-shadow)" opacity=".13" />
      <g className="mj-float mj-float-one">
        <g transform="rotate(-5 163 158)">
          <rect
            x="50"
            y="47"
            width="234"
            height="212"
            rx="16"
            fill="var(--mj-sheet)"
            stroke="var(--mj-ink)"
            strokeWidth="4"
          />
          <path d="M75 47v212" stroke="var(--mj-ink)" strokeWidth="2" opacity=".4" />
          <g fill="var(--mj-paper)" stroke="var(--mj-ink)" strokeWidth="2">
            <circle cx="75" cy="75" r="5" />
            <circle cx="75" cy="108" r="5" />
            <circle cx="75" cy="141" r="5" />
            <circle cx="75" cy="174" r="5" />
            <circle cx="75" cy="207" r="5" />
            <circle cx="75" cy="238" r="5" />
          </g>
          <text
            x="100"
            y="85"
            fill="var(--mj-ink)"
            fontSize="15"
            fontWeight="800"
            fontFamily="Arial, sans-serif"
          >
            TODAY'S MENU
          </text>
          <path d="M100 94h151" stroke="var(--mj-rule)" strokeWidth="2" />
          <ellipse
            cx="151"
            cy="172"
            rx="54"
            ry="48"
            fill="var(--mj-paper)"
            stroke="var(--mj-ink)"
            strokeWidth="3.5"
          />
          <ellipse
            cx="151"
            cy="170"
            rx="42"
            ry="35"
            fill="#ECA33F"
            stroke="#AA531D"
            strokeWidth="2.5"
          />
          <path d="M117 163q35 -36 69 0q-1 40 -36 40q-33 -4 -33 -40" fill="#F8D575" />
          <path
            d="M125 164q14 -15 28 2m3 -12q16 -9 26 12m-54 13q17 13 39 6"
            stroke="#C76B27"
            strokeWidth="3.5"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M144 157q-16 -17 -20 -5q6 10 20 5m1 0q0 -22 13 -17q1 12 -13 17m19 23q17 -15 20 -5q-6 12 -20 5"
            fill="#448643"
            stroke="#285B31"
            strokeWidth="1.5"
          />
          <circle cx="125" cy="184" r="4" fill="#D64A2C" />
          <circle cx="171" cy="159" r="4" fill="#D64A2C" />
          <path
            d="M215 132h42m-42 15h35m-35 15h44m-44 15h28"
            stroke="var(--mj-rule)"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path d="M101 227h149" stroke="var(--mj-rule)" strokeWidth="3" strokeLinecap="round" />
          <path
            className="mj-pencil-trace"
            d="M104 238q27 -10 49 1q25 13 49 -2"
            fill="none"
            stroke="var(--mj-accent)"
            strokeWidth="4"
            strokeLinecap="round"
            pathLength="100"
          />
        </g>
        <g className="mj-pencil">
          <path
            d="M270 62l15 7l-33 71l-15 -7z"
            fill="url(#mj-create-cover)"
            stroke="var(--mj-ink)"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <path
            d="M237 133l15 7l-15 17z"
            fill="#F4CF9F"
            stroke="var(--mj-ink)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M237 157l4 -12l-4 -2l-4 11z" fill="var(--mj-ink)" />
          <path
            d="M270 62l5 -10l15 7l-5 10z"
            fill="#F8C8A0"
            stroke="var(--mj-ink)"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
        </g>
      </g>
      <g
        className="mj-spark"
        fill="none"
        stroke="var(--mj-accent)"
        strokeWidth="3"
        strokeLinecap="round"
      >
        <path d="M28 101v13m-6.5 -6.5h13M303 179v13m-6.5 -6.5h13" />
      </g>
      <path
        d="M21 219q12 9 23 0"
        fill="none"
        stroke="var(--mj-detail)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M306 234q9 -7 18 0"
        fill="none"
        stroke="var(--mj-detail)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PersonaliseArtwork() {
  return (
    <svg viewBox="0 0 340 300" aria-hidden="true" focusable="false" className="mj-art-svg">
      <defs>
        <linearGradient id="mj-brand-band" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FF5B1A" />
          <stop offset=".65" stopColor="#FF9629" />
          <stop offset="1" stopColor="#FFD046" />
        </linearGradient>
      </defs>
      <ellipse cx="172" cy="280" rx="104" ry="11" fill="var(--mj-shadow)" opacity=".13" />
      <g className="mj-float mj-float-two">
        <rect
          x="84"
          y="21"
          width="173"
          height="247"
          rx="24"
          fill="var(--mj-device)"
          stroke="var(--mj-edge)"
          strokeWidth="4"
        />
        <rect x="93" y="30" width="155" height="228" rx="17" fill="var(--mj-screen)" />
        <path d="M93 47q0 -17 17 -17h121q17 0 17 17v60H93z" fill="url(#mj-brand-band)" />
        <rect x="145" y="32" width="51" height="7" rx="3.5" fill="#3F2A1B" opacity=".9" />
        <text
          x="170"
          y="66"
          textAnchor="middle"
          fontSize="13"
          fontWeight="800"
          fill="#321A09"
          fontFamily="Arial, sans-serif"
        >
          YOUR PLACE
        </text>
        <text
          x="170"
          y="84"
          textAnchor="middle"
          fontSize="8.5"
          fontWeight="700"
          fill="#512707"
          fontFamily="Arial, sans-serif"
        >
          FRESHLY MADE · DAILY
        </text>
        <rect
          x="104"
          y="116"
          width="133"
          height="22"
          rx="11"
          fill="var(--mj-input)"
          stroke="var(--mj-rule)"
          strokeWidth="1"
        />
        <text x="114" y="130" fontSize="8" fill="var(--mj-muted)" fontFamily="Arial, sans-serif">
          Search dishes
        </text>
        <rect
          x="104"
          y="148"
          width="132"
          height="53"
          rx="9"
          fill="var(--mj-card)"
          stroke="var(--mj-rule)"
          strokeWidth="1.5"
        />
        <rect x="110" y="154" width="41" height="41" rx="7" fill="#F9D698" />
        <path
          d="M116 181q15 -35 29 -1q-11 14 -29 1"
          fill="#D57229"
          stroke="#A64B1F"
          strokeWidth="1.5"
        />
        <path d="M125 164l5 11m9 -7l-6 10" stroke="#42833D" strokeWidth="2" />
        <path
          d="M159 164h63m-63 11h47m-47 10h31"
          stroke="var(--mj-rule)"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <rect x="104" y="208" width="132" height="31" rx="9" fill="url(#mj-brand-band)" />
        <text
          x="170"
          y="227"
          textAnchor="middle"
          fontSize="8.5"
          fontWeight="800"
          fill="#321A09"
          fontFamily="Arial, sans-serif"
        >
          EXPLORE THE MENU
        </text>
      </g>
      <g className="mj-swatch mj-swatch-one" stroke="var(--mj-ink)" strokeWidth="2.5">
        <circle cx="59" cy="98" r="17" fill="#FF722B" />
        <circle cx="56" cy="92" r="5" fill="#FFCE8D" stroke="none" />
      </g>
      <g className="mj-swatch mj-swatch-two" stroke="var(--mj-ink)" strokeWidth="2.5">
        <circle cx="284" cy="148" r="16" fill="#FFD046" />
      </g>
      <g className="mj-swatch mj-swatch-three" stroke="var(--mj-ink)" strokeWidth="2.5">
        <circle cx="49" cy="215" r="14" fill="#438548" />
      </g>
      <g fill="none" stroke="var(--mj-detail)" strokeWidth="2.5" strokeLinecap="round">
        <path d="M42 44q13 -12 24 0M268 65q16 -5 25 9M281 232q-10 12 -23 8" />
      </g>
      <g className="mj-spark" stroke="var(--mj-accent)" strokeWidth="3" strokeLinecap="round">
        <path d="M303 101v12m-6 -6h12" />
      </g>
    </svg>
  );
}

function PublishArtwork() {
  return (
    <svg viewBox="0 0 340 300" aria-hidden="true" focusable="false" className="mj-art-svg">
      <ellipse cx="164" cy="280" rx="121" ry="11" fill="var(--mj-shadow)" opacity=".12" />
      <path d="M26 256h291" stroke="var(--mj-ink)" strokeWidth="3.5" strokeLinecap="round" />
      <g className="mj-float mj-float-three">
        {/* Decorative, deliberately not a scannable QR destination. */}
        <path
          d="M103 219h97l12 25H91z"
          fill="var(--mj-ticket)"
          stroke="var(--mj-ink)"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
        <rect
          x="74"
          y="52"
          width="156"
          height="171"
          rx="11"
          fill="var(--mj-ticket)"
          stroke="var(--mj-ink)"
          strokeWidth="4"
        />
        <path d="M81 64h142v27H81z" fill="#FFAA39" />
        <text
          x="152"
          y="81"
          textAnchor="middle"
          fontSize="11.5"
          fontWeight="800"
          fill="#321A09"
          fontFamily="Arial, sans-serif"
        >
          YOUR MENU
        </text>
        <g fill="none" stroke="var(--mj-ticket-ink)" strokeWidth="4.5" strokeLinejoin="round">
          <path d="M101 105h29v29h-29zM110 114h11v11h-11zM171 105h29v29h-29zM180 114h11v11h-11zM101 151h29v29h-29zM110 160h11v11h-11z" />
          <path
            d="M159 149h10v10h-10zM181 149h18v9h-18zM158 170h14v9h-14zM187 168h11v12h-11z"
            strokeWidth="3.2"
          />
        </g>
        <text
          x="152"
          y="206"
          textAnchor="middle"
          fontSize="8"
          fontWeight="800"
          fill="var(--mj-ticket-ink)"
          fontFamily="Arial, sans-serif"
        >
          SCAN TO BROWSE
        </text>
        <g
          className="mj-scan-frame"
          fill="none"
          stroke="var(--mj-accent)"
          strokeWidth="3.2"
          strokeLinecap="round"
        >
          <path d="M94 107v-10h10M201 97h10v10M211 177v10h-10M104 187H94v-10" />
        </g>
        <path
          className="mj-scan-beam"
          d="M103 115h98"
          fill="none"
          stroke="var(--mj-accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity=".7"
        />
      </g>
      <g transform="rotate(10 269 174)">
        <rect
          x="240"
          y="118"
          width="64"
          height="112"
          rx="10"
          fill="var(--mj-device)"
          stroke="var(--mj-ink)"
          strokeWidth="2.5"
        />
        <rect x="246" y="126" width="52" height="97" rx="6" fill="var(--mj-screen)" />
        <rect x="246" y="126" width="52" height="22" rx="5" fill="#FF9A2B" />
        <path
          d="M253 157h36m-36 8h28"
          stroke="var(--mj-rule)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <rect x="253" y="176" width="36" height="27" rx="4" fill="#F6CC80" />
        <circle cx="270" cy="188" r="9" fill="#D16E26" />
        <path d="M253 212h31" stroke="var(--mj-rule)" strokeWidth="3" strokeLinecap="round" />
      </g>
      <g
        className="mj-steam"
        fill="none"
        stroke="var(--mj-accent)"
        strokeWidth="2.8"
        strokeLinecap="round"
      >
        <path d="M40 174q-8 -10 0 -18t0 -12M50 176q-7 -10 1 -17" />
      </g>
      <path
        d="M27 187h38l-5 44q-14 12 -27 0z"
        fill="var(--mj-paper)"
        stroke="var(--mj-ink)"
        strokeWidth="2.8"
      />
      <path
        d="M64 192q22 -1 10 20q-5 7 -12 4"
        fill="none"
        stroke="var(--mj-ink)"
        strokeWidth="2.8"
      />
      <ellipse
        cx="46"
        cy="187"
        rx="19"
        ry="6"
        fill="#975025"
        stroke="var(--mj-ink)"
        strokeWidth="2"
      />
      <g
        className="mj-spark"
        fill="none"
        stroke="var(--mj-accent)"
        strokeWidth="3"
        strokeLinecap="round"
      >
        <path d="M265 74v14m-7 -7h14" />
      </g>
    </svg>
  );
}

const steps = [
  {
    index: "01 / CREATE",
    title: "Add your dishes.",
    description: "Give your favourites a home with categories, descriptions, photos and variants.",
    Artwork: CreateArtwork,
  },
  {
    index: "02 / PERSONALISE",
    title: "Make it yours.",
    description: "Bring your restaurant identity to a menu that feels like your place.",
    Artwork: PersonaliseArtwork,
  },
  {
    index: "03 / PUBLISH",
    title: "Share one QR.",
    description: "Publish a permanent menu link. Guests scan and browse without an app or account.",
    Artwork: PublishArtwork,
  },
] as const;

const features = [
  { title: "Beautiful menus", detail: "Categories and variants", Icon: UtensilsCrossed },
  { title: "Your food, showcased", detail: "Photos and descriptions", Icon: Images },
  { title: "A QR that lasts", detail: "Permanent menu link", Icon: QrCode },
  { title: "Easy for every guest", detail: "Mobile-first, no sign-up", Icon: Smartphone },
] as const;

export function MenuJourney() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    element.dataset.enhanced = "true";
    const sync = () => {
      element.dataset.paused = document.hidden || reduced.matches ? "true" : "false";
    };
    if (typeof IntersectionObserver === "undefined") {
      element.dataset.revealed = "true";
      element.dataset.offscreen = "false";
      sync();
      return () => {
        element.dataset.enhanced = "false";
      };
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = Boolean(entry?.isIntersecting);
        element.dataset.offscreen = visible ? "false" : "true";
        if (visible) element.dataset.revealed = "true";
      },
      { rootMargin: "0px 0px -5% 0px", threshold: 0.08 }
    );
    observer.observe(element);
    document.addEventListener("visibilitychange", sync);
    reduced.addEventListener("change", sync);
    sync();
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
      reduced.removeEventListener("change", sync);
    };
  }, []);

  return (
    <section
      ref={root}
      className="menu-journey"
      aria-labelledby="menu-journey-heading"
      data-testid="menu-journey"
      data-revealed="false"
      data-offscreen="false"
      data-paused="false"
    >
      <div className="mj-container">
        <header className="mj-intro">
          <span className="mj-eyebrow">
            <span aria-hidden="true" className="mj-eyebrow-mark" /> 02 / THE MENU JOURNEY
          </span>
          <h2 id="menu-journey-heading">
            From your kitchen to <em>their fingertips.</em>
          </h2>
          <p>
            Your menu should look as good as the food you serve. Create it, make it yours, and share
            it with one permanent QR.
          </p>
        </header>

        <div className="mj-story">
          <svg
            className="mj-rail"
            viewBox="0 0 1200 318"
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            <path
              className="mj-route-base"
              d="M191 192C283 192 314 118 414 163S526 230 600 188S725 118 795 163S909 222 1009 192"
              fill="none"
              pathLength="100"
            />
            <path
              className="mj-route-progress"
              d="M191 192C283 192 314 118 414 163S526 230 600 188S725 118 795 163S909 222 1009 192"
              fill="none"
              pathLength="100"
            />
          </svg>
          <ol className="mj-steps">
            {steps.map(({ index, title, description, Artwork }, i) => (
              <li className="mj-step" key={index}>
                <div className="mj-scene">
                  <Artwork />
                </div>
                <div className="mj-copy">
                  <span className="mj-index">
                    <span className="mj-index-dot" aria-hidden="true" />
                    {index}
                  </span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
                {i < 2 && <span className="mj-mobile-connector" aria-hidden="true" />}
              </li>
            ))}
          </ol>
        </div>

        <div className="mj-free">
          <div className="mj-free-heading">
            <span className="mj-free-kicker">THE FREE ESSENTIALS</span>
            <h3>All the good stuff. No unnecessary extras.</h3>
          </div>
          <ul className="mj-features">
            {features.map(({ title, detail, Icon }) => (
              <li key={title}>
                <span className="mj-feature-icon">
                  <Icon size={21} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <span className="mj-feature-text">
                  <strong>{title}</strong>
                  <small>{detail}</small>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <nav className="mj-links" aria-label="Explore MenuMinute">
          <Link className="mj-link mj-link-primary" href="/register">
            <span>
              <small>YOUR NEXT STEP</small>
              <strong>Create your free menu</strong>
            </span>
            <ArrowRight size={22} strokeWidth={2} aria-hidden="true" />
          </Link>
          <Link className="mj-link" href="/demo">
            <span>
              <small>SEE IT FIRST</small>
              <strong>Explore the live demo</strong>
            </span>
            <ArrowUpRight size={21} strokeWidth={2} aria-hidden="true" />
          </Link>
          <Link className="mj-link" href="/pricing">
            <span>
              <small>THE ROAD AHEAD</small>
              <strong>Ordering &amp; kitchen plans</strong>
              <span className="mj-soon">In development</span>
            </span>
            <ArrowUpRight size={21} strokeWidth={2} aria-hidden="true" />
          </Link>
        </nav>
      </div>
    </section>
  );
}
