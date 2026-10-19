/** Decorative original vector storefront; all actual QR pixels live in accessible HTML. */
export function StorefrontScene() {
  return (
    <svg
      viewBox="0 0 840 610"
      className="ss-scene"
      xmlns="http://www.w3.org/2000/svg"
      focusable="false"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ss7-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" className="ss-stop-glass-top" />
          <stop offset="1" className="ss-stop-glass-bottom" />
        </linearGradient>
        <linearGradient id="ss7-warm" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F9BE68" />
          <stop offset="1" stopColor="#B65B27" />
        </linearGradient>
        <linearGradient id="ss7-reflection" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".25" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <filter id="ss7-blur">
          <feGaussianBlur stdDeviation="23" />
        </filter>
        <pattern id="ss7-tiles" width="54" height="20" patternUnits="userSpaceOnUse">
          <path d="M0 0H54M0 0V20" fill="none" stroke="#865432" opacity=".15" />
        </pattern>
      </defs>
      <rect width="840" height="610" rx="28" fill="var(--ss-scene-back)" />
      <ellipse
        cx="440"
        cy="280"
        rx="300"
        ry="180"
        fill="#F28A29"
        opacity=".14"
        filter="url(#ss7-blur)"
      />
      <g className="ss-building">
        <path d="M67 101H774V571H67Z" fill="var(--ss-store-trim)" />
        <path d="M83 117H758V554H83Z" fill="url(#ss7-glass)" />
        <path d="M83 377Q330 339 758 378V554H83Z" fill="var(--ss-store-floor)" />
        <path d="M83 405H758V554H83Z" fill="url(#ss7-tiles)" />
        <g
          opacity=".62"
          fill="none"
          stroke="var(--ss-furnish)"
          strokeWidth="9"
          strokeLinecap="round"
        >
          <path d="M143 378H311M158 380V461M298 380V461M506 379H700M521 379V461M682 379V461" />
        </g>
        <g className="ss-lamps" fill="none" stroke="var(--ss-lamp-wire)" strokeWidth="3">
          <path d="M204 118V201M438 118V175M647 118V205" />
          <path d="M181 201H227L238 221H170Z" fill="url(#ss7-warm)" stroke="none" />
          <path d="M414 175H462L476 198H401Z" fill="url(#ss7-warm)" stroke="none" />
          <path d="M623 205H672L685 226H610Z" fill="url(#ss7-warm)" stroke="none" />
        </g>
        <g fill="var(--ss-green)">
          <path d="M110 411Q64 377 119 335Q132 375 128 409Q146 363 172 355Q172 401 133 418Z" />
          <path d="M714 426Q671 389 726 356Q741 383 731 423Q742 383 771 387Q756 416 734 431Z" />
        </g>
        <g fill="var(--ss-pot)">
          <path d="M108 409h40l-6 40h-28zM713 427h36l-5 31h-25z" />
        </g>
        <g className="ss-window" fill="none" stroke="var(--ss-frame)" strokeWidth="15">
          <path d="M83 117H758V554H83Z" />
          <path d="M420 116V554" />
        </g>
        <path
          className="ss-reflection"
          d="M115 132H260L140 542H90ZM482 133H555L427 551H370Z"
          fill="url(#ss7-reflection)"
        />
        <g className="ss-door" fill="none" stroke="var(--ss-frame)" strokeWidth="10">
          <path d="M485 122V551H751V122Z" />
          <path d="M718 306v94" stroke="var(--ss-handle)" strokeWidth="12" strokeLinecap="round" />
          <path d="M698 302h20m-20 102h20" stroke="var(--ss-handle)" strokeWidth="4" />
        </g>
        <g className="ss-counter">
          <path d="M90 468L441 449L711 469L684 512L120 512Z" fill="var(--ss-counter-top)" />
          <path d="M120 512H684V559H120Z" fill="var(--ss-counter-front)" />
          <path d="M120 558H684" stroke="var(--ss-frame)" strokeWidth="7" />
          <path
            d="M168 492h56m30 0h57m29 0h49"
            stroke="var(--ss-counter-rule)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
        <g className="ss-counter-display">
          <path d="M402 443V471" stroke="var(--ss-frame)" strokeWidth="8" strokeLinecap="round" />
          <ellipse cx="402" cy="473" rx="36" ry="7" fill="var(--ss-counter-front)" />
          <path
            d="M373 470h58"
            stroke="var(--ss-counter-rule)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
        <path d="M64 96H778" stroke="var(--ss-gilt)" strokeWidth="5" strokeLinecap="round" />
        <g className="ss-shop-sign">
          <rect
            x="253"
            y="53"
            width="334"
            height="68"
            rx="13"
            fill="var(--ss-sign-back)"
            stroke="var(--ss-gilt)"
            strokeWidth="2"
          />
          <path d="M268 61H572M268 113H572" stroke="var(--ss-gilt)" strokeOpacity=".35" />
          <circle cx="276" cy="87" r="2.5" fill="var(--ss-gilt)" />
          <circle cx="564" cy="87" r="2.5" fill="var(--ss-gilt)" />
          <text
            x="420"
            y="78"
            fill="var(--ss-gilt)"
            fontSize="9"
            fontWeight="750"
            textAnchor="middle"
            letterSpacing="3"
          >
            WELCOME TO
          </text>
          <text
            x="420"
            y="105"
            fill="var(--ss-sign-text)"
            fontSize="20"
            fontWeight="800"
            textAnchor="middle"
            letterSpacing="1"
          >
            YOUR RESTAURANT
          </text>
        </g>
        <path
          d="M85 575H755"
          stroke="var(--ss-ground-rule)"
          strokeWidth="8"
          strokeLinecap="round"
        />
      </g>
      <g
        className="ss-reflection-lines"
        fill="none"
        stroke="#fff"
        strokeOpacity=".4"
        strokeWidth="2"
      >
        <path d="M158 136l-52 126M181 136l-35 81M557 143l-45 104" />
      </g>
      <g className="ss-sparkle" fill="none" stroke="#FBAA55" strokeWidth="3" strokeLinecap="round">
        <path d="M104 275v22m-11-11h22M680 179v16m-8-8h16" />
      </g>
    </svg>
  );
}
