"use client";

import { useEffect, useRef } from "react";
import "./food-orbit.css";

/** Original SVG linework; only the approved free QR menu is represented on the phone. */
const Toppings = [
  [88,84,13],[159,72,16],[192,119,14],[84,155,16],
  [135,137,15],[158,194,14],[104,196,13],[196,166,11],
] as const;

function Pizza() {
  return <g transform="translate(118 263) rotate(-16 135 135)">
    <g className="food-orbit__enter food-orbit__enter--pizza"><g className="food-orbit__bob food-orbit__bob--pizza">
      <ellipse cx="142" cy="260" rx="128" ry="30" fill="var(--shadow)" opacity=".17"/>
      <circle cx="135" cy="130" r="126" fill="var(--paper)" stroke="var(--ink)" strokeWidth="6"/>
      <circle cx="135" cy="130" r="112" fill="#D58A3C" stroke="#934714" strokeWidth="5"/>
      <circle cx="135" cy="130" r="99" fill="#C94923" stroke="#D96F25" strokeWidth="4"/>
      <path d="M58 84q35 -44 82 -35t69 51q28 53 -7 90t-91 37q-56 -4 -71 -64t18 -79" fill="#FFD36B" stroke="#F7AB42" strokeWidth="5"/>
      {Toppings.map(([cx,cy,r],i)=><circle key={i} cx={cx} cy={cy} r={r} fill="#D73D27" stroke="#9E281D" strokeWidth="2"/>)}
      <g fill="#3F873E" stroke="#285B2E" strokeWidth="2.5">
        <path d="M101 107q10 -25 25 -23q4 25 -25 23zM106 107q-25 -16 -27 -4q7 16 27 4z"/>
        <path d="M162 147q13 -23 25 -17q0 24 -25 17zM161 148q-24 -12 -26 3q14 11 26 -3z"/>
        <path d="M105 177q-22 -24 -32 -11q6 21 32 11zM105 178q-2 -28 14 -23q6 14 -14 23z"/>
      </g>
      <g fill="#FFF3C4"><circle cx="73" cy="118" r="5"/><circle cx="152" cy="105" r="7"/><circle cx="202" cy="143" r="4"/><circle cx="123" cy="210" r="5"/></g>
      <path d="M37 130q0 -69 61 -94M168 234q48 -17 60 -58" fill="none" stroke="#FFE6A3" strokeWidth="6" opacity=".7" strokeLinecap="round"/>
    </g></g>
  </g>;
}
function Coffee() {
  return <g transform="translate(839 140) rotate(13 118 124)">
    <g className="food-orbit__enter food-orbit__enter--coffee"><g className="food-orbit__bob food-orbit__bob--coffee">
      <ellipse cx="122" cy="233" rx="112" ry="26" fill="var(--shadow)" opacity=".16"/>
      <ellipse cx="120" cy="194" rx="115" ry="38" fill="var(--paper)" stroke="var(--ink)" strokeWidth="5"/>
      <ellipse cx="120" cy="192" rx="85" ry="24" fill="var(--quiet)" stroke="var(--ink)" strokeWidth="2"/>
      <path d="M185 90c72 -25 93 83 14 105l-7 -24c36 -12 39 -48 -3 -56" fill="var(--paper)" stroke="var(--ink)" strokeWidth="5" strokeLinejoin="round"/>
      <path d="M37 90h165l-14 97q-68 35 -135 -2z" fill="var(--paper)" stroke="var(--ink)" strokeWidth="6" strokeLinejoin="round"/>
      <ellipse cx="119" cy="91" rx="83" ry="29" fill="var(--paper)" stroke="var(--ink)" strokeWidth="5"/>
      <ellipse cx="119" cy="91" rx="71" ry="21" fill="url(#orbit-coffee)"/>
      <path d="M119 105c-44 -30 1 -41 12 -24 19 -29 52 12 -12 24z" fill="#FFF1D0"/>
      <path d="M117 104c-5 -17 8 -24 12 -24M117 104c-12 -15 -22 -15 -28 -15" fill="none" stroke="#B77849" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M57 131q60 19 123 -2" fill="none" stroke="var(--soft)" strokeWidth="3"/>
      <path className="food-orbit__steam" d="M82 55q-18 -20 1 -38t-2 -28" fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round"/>
      <path className="food-orbit__steam food-orbit__steam--two" d="M120 48q-16 -22 2 -38t-1 -26" fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round"/>
      <path className="food-orbit__steam food-orbit__steam--three" d="M156 52q-15 -22 2 -37" fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round"/>
    </g></g>
  </g>;
}
function Bowl() {
  return <g transform="translate(148 579) rotate(10 147 97)">
    <g className="food-orbit__enter food-orbit__enter--bowl"><g className="food-orbit__bob food-orbit__bob--bowl">
      <ellipse cx="148" cy="188" rx="132" ry="23" fill="var(--shadow)" opacity=".16"/>
      <path d="M15 74q7 113 130 123q134 -5 137 -123" fill="url(#orbit-bowl)" stroke="var(--ink)" strokeWidth="6"/>
      <path d="M37 114q22 68 110 72" fill="none" stroke="#FFD28C" strokeWidth="6" strokeLinecap="round" opacity=".8"/>
      <ellipse cx="148" cy="72" rx="140" ry="60" fill="var(--paper)" stroke="var(--ink)" strokeWidth="6"/>
      <ellipse cx="148" cy="68" rx="123" ry="46" fill="#E5A442" stroke="#AB571B" strokeWidth="3"/>
      <path d="M39 73q53 -54 109 -36q86 -23 111 40q-51 34 -113 29q-82 7 -107 -33" fill="#F9D681"/>
      <g fill="none" strokeLinecap="round" strokeWidth="3.5">
        {Array.from({length:23},(_,i)=>{
          const x=55+(i%8)*27+((i*7)%11);
          const y=45+Math.floor(i/8)*20+((i*5)%8);
          return <path key={i} d={"M"+x+" "+y+"q6 -5 11 1"} stroke={i%3?"#FDF1B9":"#C87D2B"}/>;
        })}
      </g>
      <g fill="#43803C" stroke="#28572B" strokeWidth="2"><path d="M114 61q-6 -23 8 -25q15 15 -8 25zM116 62q-21 -9 -22 5q14 9 22 -5zM193 87q-12 -21 2 -25q13 13 -2 25z"/></g>
      <circle cx="158" cy="59" r="5" fill="#B94724"/><circle cx="78" cy="80" r="5" fill="#B94724"/>
    </g></g>
  </g>;
}
function Cake() {
  return <g transform="translate(882 624) rotate(-8 120 97)">
    <g className="food-orbit__enter food-orbit__enter--cake"><g className="food-orbit__bob food-orbit__bob--cake">
      <ellipse cx="120" cy="161" rx="122" ry="24" fill="var(--shadow)" opacity=".17"/>
      <ellipse cx="116" cy="144" rx="118" ry="34" fill="var(--paper)" stroke="var(--ink)" strokeWidth="5"/>
      <ellipse cx="116" cy="140" rx="91" ry="21" fill="var(--quiet)" stroke="var(--soft)" strokeWidth="2"/>
      <path d="M37 99l84 -71 98 63 -99 48z" fill="url(#orbit-cake)" stroke="#5F2D1A" strokeWidth="5" strokeLinejoin="round"/>
      <path d="M37 99l83 40v-35L37 64z" fill="#8E492A" stroke="#5F2D1A" strokeWidth="4" strokeLinejoin="round"/>
      <path d="M120 139l99 -48v-37l-99 50z" fill="#5B2C1D" stroke="#452016" strokeWidth="4" strokeLinejoin="round"/>
      <path d="M39 75l80 39 96 -47M39 93l80 39 96 -47" fill="none" stroke="#F3CE9F" strokeWidth="8" strokeLinecap="round"/>
      <path d="M35 61l84 42 101 -47 -99 -40z" fill="#6B351F" stroke="#482619" strokeWidth="4" strokeLinejoin="round"/>
      <path d="M38 58q31 6 45 20t42 12q24 -11 45 -23t48 -12" fill="none" stroke="#D99557" strokeWidth="5" strokeLinecap="round"/>
      <path d="M114 27q-4 -20 13 -25q19 4 6 26" fill="#5B913D" stroke="#285C36" strokeWidth="3"/>
      <path d="M123 29q-21 -25 1 -29q20 5 8 28z" fill="#CE4030" stroke="#8F251F" strokeWidth="3"/>
      <circle cx="125" cy="12" r="3" fill="#FFE7BE"/>
    </g></g>
  </g>;
}
function MenuPhone() {
  return <g transform="translate(459 129) rotate(-7 145 294)">
    <g className="food-orbit__enter food-orbit__enter--phone"><g className="food-orbit__bob food-orbit__bob--phone">
      <rect x="16" y="24" width="290" height="575" rx="49" fill="var(--shadow)" opacity=".20"/>
      <rect x="0" y="0" width="290" height="575" rx="46" fill="url(#orbit-phone)" stroke="var(--edge)" strokeWidth="5"/>
      <rect x="10" y="11" width="270" height="553" rx="38" fill="var(--screen)" stroke="var(--edge)" strokeWidth="2"/>
      <rect x="104" y="16" width="83" height="19" rx="10" fill="#171717"/><circle cx="166" cy="25" r="3" fill="#655F58"/>
      <g transform="translate(24 51)" fontFamily="Arial, sans-serif">
        <rect width="242" height="477" rx="18" fill="var(--screen)"/>
        <path d="M0 18q0 -18 18 -18h206q18 0 18 18v66H0z" fill="url(#orbit-ember)"/>
        <circle cx="27" cy="26" r="11" fill="#211600" opacity=".8"/>
        <path d="M21 28h12m-8 -6v12m4 -12v12" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
        <text x="46" y="29" fontSize="15" fontWeight="800" fill="#211600">YOUR MENU</text>
        <text x="16" y="57" fontSize="10" fontWeight="600" fill="#42250D">Fresh favourites, beautifully served</text>
        <rect x="13" y="96" width="216" height="31" rx="14" fill="var(--field)" stroke="var(--soft)" strokeWidth="1.5"/>
        <circle cx="28" cy="111" r="5" fill="none" stroke="var(--muted)" strokeWidth="2"/><path d="M32 115l5 5" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round"/>
        <text x="46" y="115" fontSize="10" fill="var(--muted)">Search dishes</text>
        <g fontSize="9" fontWeight="700">
          <rect x="13" y="139" width="48" height="22" rx="11" fill="url(#orbit-ember)"/><text x="37" y="153" textAnchor="middle" fill="#211600">All</text>
          <rect x="67" y="139" width="69" height="22" rx="11" fill="var(--field)"/><text x="101" y="153" textAnchor="middle" fill="var(--muted)">Mains</text>
          <rect x="142" y="139" width="87" height="22" rx="11" fill="var(--field)"/><text x="185" y="153" textAnchor="middle" fill="var(--muted)">Beverages</text>
        </g>
        <text x="13" y="183" fontSize="13" fontWeight="800" fill="var(--screen-ink)">Explore dishes</text>
        <g className="food-orbit__screen-dishes">
          <rect x="13" y="194" width="216" height="82" rx="12" fill="var(--card)" stroke="var(--soft)"/>
          <rect x="21" y="202" width="67" height="66" rx="10" fill="#FFE5AD"/>
          <ellipse cx="54" cy="235" rx="25" ry="19" fill="#D76522" stroke="#A83500" strokeWidth="2"/>
          <path d="M37 230q17 -14 32 6m-29 6q21 -8 30 2" fill="none" stroke="#FFE18C" strokeWidth="4" strokeLinecap="round"/>
          <path d="M45 221l4 8m11 -3l-5 10" stroke="#2D7A42" strokeWidth="3" strokeLinecap="round"/>
          <text x="97" y="224" fontSize="11" fontWeight="800" fill="var(--screen-ink)">House favourites</text>
          <text x="97" y="242" fontSize="9" fill="var(--muted)">Discover the menu</text>
          <path d="M97 252h56" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round"/>
          <rect x="13" y="285" width="216" height="82" rx="12" fill="var(--card)" stroke="var(--soft)"/>
          <rect x="21" y="293" width="67" height="66" rx="10" fill="#F4C88B"/>
          <path d="M29 341q24 -61 49 0z" fill="#7F4128" stroke="#5C2912" strokeWidth="2"/><path d="M31 341h45" stroke="#FFF0CB" strokeWidth="6" strokeLinecap="round"/><circle cx="56" cy="313" r="4" fill="#E44B30"/>
          <text x="97" y="315" fontSize="11" fontWeight="800" fill="var(--screen-ink)">Something sweet</text>
          <text x="97" y="334" fontSize="9" fill="var(--muted)">Browse at your table</text>
          <path d="M97 345h69" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round"/>
        </g>
        <rect x="13" y="386" width="216" height="47" rx="12" fill="url(#orbit-ember)"/>
        <text x="121" y="404" textAnchor="middle" fontSize="11" fontWeight="800" fill="#211600">FREE QR MENU</text>
        <text x="121" y="419" textAnchor="middle" fontSize="9" fill="#42250D">No guest signup required</text>
        <path d="M87 449h68" stroke="var(--muted)" opacity=".5" strokeWidth="3" strokeLinecap="round"/>
      </g>
      <path d="M-3 139v54M-3 214v40M293 191v62" stroke="var(--edge)" strokeWidth="5" strokeLinecap="round"/>
    </g></g>
  </g>;
}
function DecorativeQrStand() {
  return <g transform="translate(795 438) rotate(11 107 138)">
    <g className="food-orbit__enter food-orbit__enter--qr"><g className="food-orbit__bob food-orbit__bob--qr">
      <ellipse cx="103" cy="244" rx="94" ry="17" fill="var(--shadow)" opacity=".2"/>
      <path d="M84 208h39l12 25H70z" fill="var(--ticket)" stroke="var(--ink)" strokeWidth="4" strokeLinejoin="round"/>
      <rect x="15" y="2" width="188" height="205" rx="12" fill="var(--ticket)" stroke="var(--ink)" strokeWidth="6"/>
      <path d="M24 17h171v25H24z" fill="url(#orbit-ember)"/>
      <text x="110" y="34" textAnchor="middle" fill="#211600" fontFamily="Arial, sans-serif" fontWeight="800" fontSize="14">SCAN TO EXPLORE</text>
      {/* An intentionally non-scannable, decorative QR glyph — never a false QR destination. */}
      <g fill="none" stroke="var(--ticket-ink)" strokeWidth="7" strokeLinejoin="round">
        <path d="M44 69h37v37H44zM56 81h13v13H56zM126 69h37v37h-37zM138 81h13v13h-13zM44 124h37v37H44zM56 136h13v13H56z"/>
        <path d="M122 125h14v11h-14zM149 125h14v14h-14zM122 148h12v12h-12zM147 150h16v10h-16z" strokeWidth="4"/>
      </g>
      <text x="107" y="188" fill="var(--ticket-ink)" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="12" fontWeight="800">YOUR MENU, ONLINE</text>
    </g></g>
  </g>;
}

export function FoodOrbit() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    let frame = 0;
    let x = 0, y = 0;
    const reset = () => {
      cancelAnimationFrame(frame); frame = 0; x = 0; y = 0;
      for (const depth of ["near","mid","far"]) {
        el.style.setProperty("--"+depth+"-x","0px");
        el.style.setProperty("--"+depth+"-y","0px");
      }
    };
    const paint = () => {
      frame = 0;
      for (const [depth, distance] of [["near",13],["mid",7],["far",3]] as const) {
        el.style.setProperty("--"+depth+"-x",(x*distance).toFixed(2)+"px");
        el.style.setProperty("--"+depth+"-y",(y*distance).toFixed(2)+"px");
      }
    };
    const move = (event: PointerEvent) => {
      if (reduced.matches || !fine.matches || document.hidden) return;
      const bounds = el.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      x = Math.max(-1,Math.min(1,((event.clientX-bounds.left)/bounds.width-.5)*2));
      y = Math.max(-1,Math.min(1,((event.clientY-bounds.top)/bounds.height-.5)*2));
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const sync = () => {
      el.dataset.paused = document.hidden || reduced.matches ? "true" : "false";
      if (document.hidden || reduced.matches) reset();
    };
    const observer = new IntersectionObserver(([entry]) => {
      el.dataset.offscreen = entry?.isIntersecting ? "false" : "true";
      if (!entry?.isIntersecting) reset();
    }, {threshold:.05});
    observer.observe(el);
    el.addEventListener("pointermove",move);
    el.addEventListener("pointerleave",reset);
    document.addEventListener("visibilitychange",sync);
    reduced.addEventListener("change",sync);
    fine.addEventListener("change",reset);
    sync();
    return () => {
      observer.disconnect(); cancelAnimationFrame(frame);
      el.removeEventListener("pointermove",move); el.removeEventListener("pointerleave",reset);
      document.removeEventListener("visibilitychange",sync);
      reduced.removeEventListener("change",sync); fine.removeEventListener("change",reset);
    };
  },[]);
  return <div className="food-orbit" ref={root} data-testid="food-orbit" data-paused="false" data-offscreen="false">
    <svg viewBox="0 0 1200 900" role="img" aria-labelledby="food-orbit-title food-orbit-description" xmlns="http://www.w3.org/2000/svg">
      <title id="food-orbit-title">The Food Orbit</title>
      <desc id="food-orbit-description">An illustrated MenuMinute digital restaurant menu floats between a pizza, a coffee, a bowl of food, cake and a decorative QR table sign.</desc>
      <defs>
        <linearGradient id="orbit-ember" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FF5B1A"/><stop offset=".54" stopColor="#FF8A1E"/><stop offset="1" stopColor="#FFD046"/></linearGradient>
        <linearGradient id="orbit-phone" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#474039"/><stop offset=".5" stopColor="#171717"/><stop offset="1" stopColor="#46372A"/></linearGradient>
        <linearGradient id="orbit-coffee" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#A75320"/><stop offset="1" stopColor="#5C2912"/></linearGradient>
        <linearGradient id="orbit-bowl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FF9238"/><stop offset="1" stopColor="#B93B11"/></linearGradient>
        <linearGradient id="orbit-cake" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#D38B52"/><stop offset="1" stopColor="#8B401D"/></linearGradient>
      </defs>
      <g className="food-orbit__far" fill="none" stroke="var(--detail)" strokeWidth="3" strokeLinecap="round" opacity=".65">
        <path d="M126 318l-31 -9M134 294l-23 -22M1044 241l28 -22M1051 267l37 -5M161 734l-35 22M1042 715l30 27"/>
        <path d="M304 118q28 -29 59 -7M849 805q28 15 60 -8" strokeWidth="2"/>
        <circle cx="112" cy="450" r="4" fill="var(--detail)" stroke="none"/><circle cx="1048" cy="480" r="4" fill="var(--detail)" stroke="none"/>
      </g>
      <g className="food-orbit__far" fill="none">
        <ellipse className="food-orbit__line" cx="599" cy="448" rx="508" ry="324" transform="rotate(-14 599 448)" stroke="var(--ring)" strokeWidth="2.5" strokeDasharray="12 19"/>
        <path className="food-orbit__trace" d="M153 502C99 347 234 175 457 138C708 96 997 233 1080 390" stroke="url(#orbit-ember)" strokeWidth="5" strokeLinecap="round" pathLength="100"/>
        <path d="M1032 555C948 747 719 822 495 781" stroke="var(--ring)" strokeWidth="3" strokeLinecap="round"/>
        <ellipse cx="599" cy="446" rx="371" ry="250" transform="rotate(19 599 446)" stroke="var(--ring-soft)" strokeWidth="2" strokeDasharray="5 16"/>
        <path d="M260 542c32 98 148 168 267 177" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round"/>
        <circle cx="257" cy="240" r="10" fill="var(--accent)"/><circle cx="997" cy="605" r="7" fill="var(--ink)"/>
      </g>
      <g className="food-orbit__far"><Coffee/></g>
      <g className="food-orbit__far food-orbit__small-detail" strokeLinecap="round" strokeLinejoin="round">
        <path d="M315 177q-40 -36 -56 -87q53 7 56 87z" fill="#5A9A42" stroke="#255E36" strokeWidth="4"/><path d="M263 97l46 73" stroke="#D7E8A1" strokeWidth="3"/>
        <path d="M787 118q-18 31 -50 32q4 -40 50 -32z" fill="#80AD41" stroke="#255E36" strokeWidth="4"/><path d="M741 146l40 -24" stroke="#D7E8A1" strokeWidth="2"/>
      </g>
      <g className="food-orbit__mid"><MenuPhone/></g>
      <g className="food-orbit__near"><Pizza/></g>
      <g className="food-orbit__near"><Bowl/></g>
      <g className="food-orbit__near"><Cake/></g>
      <g className="food-orbit__near"><DecorativeQrStand/></g>
      <g className="food-orbit__near food-orbit__small-detail" strokeLinecap="round" strokeLinejoin="round">
        <path d="M746 753q18 -38 66 -27q-14 49 -66 27z" fill="#4D943D" stroke="#276132" strokeWidth="4"/><path d="M747 754l59 -23" stroke="#D6E9A4" strokeWidth="3"/>
        <path d="M425 739q-18 -6 -3 -24q16 -8 18 3q25 -14 31 0q-16 33 -46 21z" fill="#D93C24" stroke="#8E2618" strokeWidth="4"/>
        <path d="M762 171q26 -27 53 0q-3 28 -53 0z" fill="#FFE184" stroke="#C78825" strokeWidth="4"/>
        <path d="M384 265l5 -16m5 17l15 -13M1077 532l10 -18m1 20l18 -7" stroke="var(--accent)" strokeWidth="4"/>
        <g fill="var(--accent)"><circle cx="441" cy="142" r="4"/><circle cx="804" cy="790" r="4"/><circle cx="1090" cy="327" r="3"/></g>
      </g>
    </svg>
  </div>;
}
