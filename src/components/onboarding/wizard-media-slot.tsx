"use client";

import { useState } from "react";
import Image from "next/image";

export type WizardStepId = "identity" | "location" | "operations" | "contact" | "launch";

interface WizardMediaSlotProps {
  step: WizardStepId;
  alt?: string;
  className?: string;
}

const customAssetMap: Record<WizardStepId, string> = {
  identity: "/brand/onboarding-wizard/wizard-hero-identity.svg",
  location: "/brand/onboarding-wizard/wizard-hero-location.svg",
  operations: "/brand/onboarding-wizard/wizard-hero-operations.svg",
  contact: "/brand/onboarding-wizard/wizard-hero-contact.svg",
  launch: "/brand/onboarding-wizard/wizard-hero-launch.svg",
};

/**
 * Placeholder & loader for future mediawork integration.
 * Renders high-fidelity, accessible vector art matching MenuMinute's Obsidian/Amber design system,
 * while automatically loading custom ChatGPT-generated SVGs when placed in /brand/onboarding-wizard/.
 */
export function WizardMediaSlot({ step, alt = "", className = "" }: WizardMediaSlotProps) {
  const [hasCustomAssetError, setHasCustomAssetError] = useState(false);
  const customAssetUrl = customAssetMap[step];

  return (
    <div
      className={`wizard-media-slot wizard-media-slot--${step} ${className}`.trim()}
      data-mediawork-slot={step}
      aria-hidden="true"
    >
      {!hasCustomAssetError ? (
        <Image
          src={customAssetUrl}
          alt={alt}
          width={400}
          height={240}
          className="wizard-media-custom"
          onError={() => setHasCustomAssetError(true)}
          priority
        />
      ) : (
        <InlineStepArt step={step} />
      )}
    </div>
  );
}

function InlineStepArt({ step }: { step: WizardStepId }) {
  switch (step) {
    case "identity":
      return (
        <svg
          viewBox="0 0 400 240"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="wizard-media-svg"
        >
          <defs>
            <radialGradient id="identGlow" cx="50%" cy="40%" r="55%">
              <stop offset="0%" stopColor="#f97316" stopOpacity="0.32" />
              <stop offset="60%" stopColor="#ea580c" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#1c1917" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="identCanopy" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#9a3412" />
            </linearGradient>
          </defs>
          <rect width="400" height="240" rx="16" fill="#1c1917" />
          <rect width="400" height="240" rx="16" fill="url(#identGlow)" />
          {/* Subtle grid */}
          <path
            d="M40 200h320M60 170h280M80 140h240"
            stroke="#292524"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          {/* Storefront silhouette */}
          <rect
            x="110"
            y="90"
            width="180"
            height="110"
            rx="8"
            fill="#292524"
            stroke="#44403c"
            strokeWidth="1.5"
          />
          <path
            d="M100 90h200l-15-28H115L100 90z"
            fill="url(#identCanopy)"
            stroke="#ea580c"
            strokeWidth="1.5"
          />
          {/* Windows and door */}
          <rect
            x="130"
            y="110"
            width="40"
            height="50"
            rx="4"
            fill="#1c1917"
            stroke="#f97316"
            strokeWidth="1"
            strokeOpacity="0.6"
          />
          <rect
            x="230"
            y="110"
            width="40"
            height="50"
            rx="4"
            fill="#1c1917"
            stroke="#f97316"
            strokeWidth="1"
            strokeOpacity="0.6"
          />
          <rect
            x="182"
            y="120"
            width="36"
            height="80"
            rx="4"
            fill="#1c1917"
            stroke="#78716c"
            strokeWidth="1"
          />
          <circle cx="212" cy="160" r="2.5" fill="#f97316" />
          {/* Hanging Sign */}
          <line x1="85" y1="80" x2="85" y2="108" stroke="#f97316" strokeWidth="2" />
          <rect
            x="70"
            y="108"
            width="30"
            height="22"
            rx="3"
            fill="#44403c"
            stroke="#f97316"
            strokeWidth="1.5"
          />
          <path d="M78 119h14" stroke="#f97316" strokeWidth="2" strokeLinecap="round" />
          {/* Stars */}
          <circle cx="310" cy="55" r="2" fill="#fed7aa" />
          <circle cx="95" cy="45" r="1.5" fill="#fed7aa" opacity="0.8" />
          <circle cx="340" cy="90" r="1.5" fill="#f97316" opacity="0.6" />
        </svg>
      );

    case "location":
      return (
        <svg
          viewBox="0 0 400 240"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="wizard-media-svg"
        >
          <defs>
            <radialGradient id="locGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f97316" stopOpacity="0.35" />
              <stop offset="70%" stopColor="#ea580c" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#1c1917" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="400" height="240" rx="16" fill="#1c1917" />
          <rect width="400" height="240" rx="16" fill="url(#locGlow)" />
          {/* Isometric grid lines */}
          <path
            d="M50 160l150 50 150-50-150-50-150 50z"
            stroke="#44403c"
            strokeWidth="1.5"
            strokeDasharray="6 4"
          />
          <path d="M90 145l110 38 110-38-110-38-110 38z" stroke="#292524" strokeWidth="1" />
          <path
            d="M125 135l75 25 75-25-75-25-75 25z"
            stroke="#f97316"
            strokeWidth="1"
            strokeOpacity="0.4"
          />
          {/* Radar ripple rings */}
          <ellipse
            cx="200"
            cy="150"
            rx="80"
            ry="28"
            stroke="#f97316"
            strokeWidth="1"
            strokeOpacity="0.25"
          />
          <ellipse
            cx="200"
            cy="150"
            rx="45"
            ry="16"
            stroke="#f97316"
            strokeWidth="1.5"
            strokeOpacity="0.5"
          />
          {/* GPS Pin */}
          <g transform="translate(200, 115)">
            <path
              d="M0 -42c-14 0-25 11-25 25 0 18 25 42 25 42s25-24 25-42c0-14-11-25-25-25z"
              fill="#ea580c"
              stroke="#fed7aa"
              strokeWidth="2"
            />
            <circle cx="0" cy="-17" r="8" fill="#1c1917" />
            <circle cx="0" cy="-17" r="4.5" fill="#f97316" />
          </g>
          {/* Coordinate pills */}
          <rect
            x="50"
            y="40"
            width="100"
            height="26"
            rx="6"
            fill="#292524"
            stroke="#44403c"
            strokeWidth="1"
          />
          <text x="60" y="57" fill="#fed7aa" fontSize="11" fontFamily="monospace">
            LAT 19.0760°
          </text>
          <rect
            x="250"
            y="40"
            width="100"
            height="26"
            rx="6"
            fill="#292524"
            stroke="#44403c"
            strokeWidth="1"
          />
          <text x="260" y="57" fill="#fed7aa" fontSize="11" fontFamily="monospace">
            LNG 72.8777°
          </text>
        </svg>
      );

    case "operations":
      return (
        <svg
          viewBox="0 0 400 240"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="wizard-media-svg"
        >
          <defs>
            <radialGradient id="opGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f97316" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#1c1917" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="400" height="240" rx="16" fill="#1c1917" />
          <rect width="400" height="240" rx="16" fill="url(#opGlow)" />
          {/* Clock wheel */}
          <circle cx="200" cy="120" r="65" stroke="#44403c" strokeWidth="2" strokeDasharray="6 6" />
          <circle cx="200" cy="120" r="50" fill="#292524" stroke="#f97316" strokeWidth="1.5" />
          {/* Clock ticks and hands */}
          <line
            x1="200"
            y1="78"
            x2="200"
            y2="86"
            stroke="#fed7aa"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <line
            x1="242"
            y1="120"
            x2="234"
            y2="120"
            stroke="#fed7aa"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <line
            x1="200"
            y1="162"
            x2="200"
            y2="154"
            stroke="#fed7aa"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <line
            x1="158"
            y1="120"
            x2="166"
            y2="120"
            stroke="#fed7aa"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <line
            x1="200"
            y1="120"
            x2="200"
            y2="95"
            stroke="#f97316"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <line
            x1="200"
            y1="120"
            x2="225"
            y2="135"
            stroke="#fed7aa"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="200" cy="120" r="4" fill="#f97316" />
          {/* Cloche icons */}
          <path
            d="M80 140c0-22 18-40 40-40s40 18 40 40H80z"
            stroke="#78716c"
            strokeWidth="1.5"
            fill="#292524"
            opacity="0.7"
          />
          <path
            d="M240 140c0-22 18-40 40-40s40 18 40 40H240z"
            stroke="#78716c"
            strokeWidth="1.5"
            fill="#292524"
            opacity="0.7"
          />
        </svg>
      );

    case "contact":
      return (
        <svg
          viewBox="0 0 400 240"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="wizard-media-svg"
        >
          <defs>
            <radialGradient id="ctGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f97316" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#1c1917" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="400" height="240" rx="16" fill="#1c1917" />
          <rect width="400" height="240" rx="16" fill="url(#ctGlow)" />
          {/* Table */}
          <ellipse
            cx="200"
            cy="165"
            rx="90"
            ry="32"
            fill="#292524"
            stroke="#44403c"
            strokeWidth="2"
          />
          <line
            x1="200"
            y1="165"
            x2="200"
            y2="215"
            stroke="#44403c"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <ellipse
            cx="200"
            cy="215"
            rx="35"
            ry="10"
            fill="#1c1917"
            stroke="#44403c"
            strokeWidth="2"
          />
          {/* Tabletop QR Stand */}
          <g transform="translate(182, 100)">
            <rect
              x="0"
              y="0"
              width="36"
              height="52"
              rx="4"
              fill="#1c1917"
              stroke="#f97316"
              strokeWidth="2"
            />
            <rect x="6" y="8" width="24" height="24" fill="#292524" rx="2" />
            <rect x="9" y="11" width="6" height="6" fill="#f97316" />
            <rect x="21" y="11" width="6" height="6" fill="#f97316" />
            <rect x="9" y="23" width="6" height="6" fill="#f97316" />
            <rect x="18" y="20" width="3" height="3" fill="#fed7aa" />
            <rect x="21" y="23" width="3" height="3" fill="#fed7aa" />
            <line
              x1="10"
              y1="42"
              x2="26"
              y2="42"
              stroke="#78716c"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </g>
          {/* Signal rings */}
          <path
            d="M170 85c18-12 42-12 60 0M160 70c24-16 56-16 80 0"
            stroke="#f97316"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.75"
          />
        </svg>
      );

    case "launch":
      return (
        <svg
          viewBox="0 0 400 240"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="wizard-media-svg"
        >
          <defs>
            <radialGradient id="lnchGlow" cx="50%" cy="50%" r="55%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#ea580c" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#1c1917" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="400" height="240" rx="16" fill="#1c1917" />
          <rect width="400" height="240" rx="16" fill="url(#lnchGlow)" />
          {/* Confetti particles */}
          <rect
            x="80"
            y="50"
            width="6"
            height="6"
            rx="1"
            fill="#f97316"
            transform="rotate(25 80 50)"
          />
          <rect
            x="120"
            y="80"
            width="5"
            height="5"
            rx="1"
            fill="#f59e0b"
            transform="rotate(45 120 80)"
          />
          <circle cx="100" cy="110" r="3" fill="#fed7aa" />
          <rect
            x="290"
            y="45"
            width="6"
            height="6"
            rx="1"
            fill="#f59e0b"
            transform="rotate(15 290 45)"
          />
          <rect
            x="315"
            y="85"
            width="5"
            height="5"
            rx="1"
            fill="#f97316"
            transform="rotate(35 315 85)"
          />
          <circle cx="280" cy="115" r="3" fill="#fed7aa" />
          {/* Star bursts */}
          <path d="M190 35l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#fed7aa" />
          <path d="M225 45l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" fill="#f59e0b" />
          {/* Glowing central badge */}
          <circle cx="200" cy="130" r="48" fill="#292524" stroke="#f59e0b" strokeWidth="2" />
          <rect
            x="180"
            y="110"
            width="40"
            height="40"
            rx="6"
            fill="#1c1917"
            stroke="#f97316"
            strokeWidth="1.5"
          />
          {/* Stylized QR in badge */}
          <rect x="186" y="116" width="10" height="10" rx="2" fill="#f59e0b" />
          <rect x="204" y="116" width="10" height="10" rx="2" fill="#f59e0b" />
          <rect x="186" y="134" width="10" height="10" rx="2" fill="#f59e0b" />
          <circle cx="209" cy="139" r="3" fill="#fed7aa" />
        </svg>
      );
  }
}
