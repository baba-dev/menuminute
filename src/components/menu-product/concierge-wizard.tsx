"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, ChefHat, Flame, Heart, ShieldAlert, Sparkles, Users, Wallet, X } from "lucide-react";
import { currencyExponent } from "@/lib/money";
import type { ConciergePreferences } from "@/modules/menu-product/concierge-contracts";

type Props = {
  craving: string;
  currency: string;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onRecommend: (preferences: ConciergePreferences) => void;
  children?: ReactNode;
};
const experiences = [
  { key: "bite", icon: "🥟", label: "A little bite", sub: "Starters and snacks" },
  { key: "single", icon: "🍲", label: "One good meal", sub: "One satisfying plate" },
  { key: "feast", icon: "🍽️", label: "The full feast", sub: "Multiple courses" },
] as const;
const moods = [
  { key: "comfort", icon: "🧡", label: "Cozy & comforting" },
  { key: "bold", icon: "🌶️", label: "Spicy & bold" },
  { key: "fresh", icon: "🥗", label: "Light & fresh" },
  { key: "indulgent", icon: "✨", label: "Rich & indulgent" },
  { key: "adventure", icon: "🌍", label: "Adventurous" },
  { key: "quick", icon: "⚡", label: "Quick & simple" },
] as const;
const diets = [
  ["all", "Anything"],
  ["vegetarian", "Vegetarian"],
  ["vegan", "Vegan"],
  ["gluten_free", "Gluten-free"],
  ["nut_free", "Nut-free"],
  ["dairy_free", "Dairy-free"],
] as const;
const spices = [["any", "Surprise me"], ["mild", "Mild"], ["medium", "Medium"], ["hot", "Hot"]] as const;
const steps = ["The occasion", "Your mood", "Your table", "Just right"];

function initial(craving: string): ConciergePreferences {
  const lower = craving.toLowerCase();
  const count = lower.match(/(?:for|party of)\s+(\d+|two|three|four)/);
  const n = count?.[1] === "two" ? 2 : count?.[1] === "three" ? 3 : count?.[1] === "four" ? 4 : Number(count?.[1] ?? 1);
  return {
    mode: /snack|starter|bite/i.test(craving) ? "bite" : /full course|feast/i.test(craving) ? "feast" : "single",
    mood: /spicy|hot|bold/i.test(craving) ? "bold" : "comfort",
    guests: Math.min(12, Math.max(1, Number.isFinite(n) ? n : 1)),
    budgetMinor: 0,
    diet: /vegan/i.test(craving) ? "vegan" : /vegetarian|veg only/i.test(craving) ? "vegetarian" : "all",
    spice: /mild|not spicy/i.test(craving) ? "mild" : "any",
    avoid: "",
    craving,
    refinement: "",
  };
}
export function ConciergeWizard({ craving, currency, busy, error, onClose, onRecommend, children }: Props) {
  const [step, setStep] = useState(0);
  const [choices, setChoices] = useState<ConciergePreferences>(() => initial(craving));
  const [budget, setBudget] = useState(() => {
    const match = craving.match(/(?:under|below|up to|upto|budget(?: of)?|₹|rs\.?)\s*(?:₹|rs\.?\s*)?(\d+(?:\.\d+)?)/i);
    return match?.[1] ?? "";
  });
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.body.style.overflow;
    const focusBefore = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    function keys(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key !== "Tab") return;
      const nodes = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]') ?? []);
      if (!nodes.length) return;
      if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1)?.focus(); }
      if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0]?.focus(); }
    }
    document.addEventListener("keydown", keys);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", keys); focusBefore?.focus(); };
  }, [onClose]);
  const set = <K extends keyof ConciergePreferences>(key: K, value: ConciergePreferences[K]) => setChoices((previous) => ({ ...previous, [key]: value }));
  const submit = () => {
    if (busy) return;
    const exponent = currencyExponent(currency) ?? 2;
    const value = budget.trim() ? Number(budget) : 0;
    if (!Number.isFinite(value) || value < 0 || value * Math.pow(10, exponent) > 2147483647) return;
    const next = { ...choices, budgetMinor: Math.round(value * Math.pow(10, exponent)) };
    setChoices(next); setStep(4); onRecommend(next);
  };
  return (
    <div className="concierge-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="concierge-modal" role="dialog" aria-modal="true" aria-labelledby="concierge-wizard-title" ref={dialogRef}>
        <header className="concierge-modal-header">
          <span className="concierge-eyebrow"><Sparkles size={16} aria-hidden="true" /> MENU MINUTE CONCIERGE</span>
          <button ref={closeRef} type="button" className="concierge-icon-button" onClick={onClose} aria-label="Close dining concierge"><X size={20}/></button>
        </header>
        <div className="concierge-progress" aria-label={step < 4 ? "Step " + (step + 1) + " of 4" : "Your recommendations"}>
          {steps.map((label, index) => <span key={label} className={step >= index ? "is-current" : ""} />)}
        </div>
        <div className="concierge-modal-body">
          {step === 0 && <>
            <span className="concierge-step-name">01 / YOUR OCCASION</span>
            <h2 id="concierge-wizard-title">What are we making?</h2>
            <p className="concierge-step-description">A delicious bite or an entire evening? You choose.</p>
            <div className="concierge-choice-grid">
              {experiences.map((item) => <button key={item.key} type="button" className={"concierge-choice "+(choices.mode===item.key?"is-selected":"")} aria-pressed={choices.mode===item.key} onClick={() => set("mode",item.key)}>
                <span className="concierge-choice-art" aria-hidden="true">{item.icon}</span><strong>{item.label}</strong><small>{item.sub}</small>{choices.mode===item.key&&<Check size={17} aria-hidden="true" className="concierge-check"/>}
              </button>)}
            </div>
          </>}
          {step === 1 && <>
            <span className="concierge-step-name">02 / THE FEELING</span>
            <h2 id="concierge-wizard-title">What&apos;s your mood?</h2>
            <p className="concierge-step-description">There are no wrong answers when you&apos;re hungry.</p>
            <div className="concierge-mood-grid">
              {moods.map((item) => <button key={item.key} type="button" className={"concierge-choice concierge-mood "+(choices.mood===item.key?"is-selected":"")} aria-pressed={choices.mood===item.key} onClick={() => set("mood",item.key)}>
                <span aria-hidden="true">{item.icon}</span><strong>{item.label}</strong>
              </button>)}
            </div>
          </>}
          {step === 2 && <>
            <span className="concierge-step-name">03 / YOUR TABLE</span>
            <h2 id="concierge-wizard-title">How many are joining?</h2>
            <p className="concierge-step-description">We&apos;ll size the meal and help you stay comfortable with the price.</p>
            <div className="concierge-form-card">
              <label htmlFor="concierge-guests"><Users size={18}/> Guests</label>
              <div className="concierge-stepper"><button type="button" onClick={() => set("guests",Math.max(1,choices.guests-1))} disabled={choices.guests===1} aria-label="One fewer guest">−</button><output id="concierge-guests">{choices.guests}</output><button type="button" onClick={() => set("guests",Math.min(12,choices.guests+1))} disabled={choices.guests===12} aria-label="One more guest">+</button></div>
            </div>
            <div className="concierge-form-card">
              <label htmlFor="concierge-budget"><Wallet size={18}/> Total budget ({currency})</label>
              <input id="concierge-budget" inputMode="decimal" type="number" min="0" step="any" placeholder="No strict limit" value={budget} onChange={(event) => setBudget(event.target.value)} />
              <small>Leave blank for recommendations at different prices. Prices are estimated subtotals; taxes and fees may be extra.</small>
            </div>
          </>}
          {step === 3 && <>
            <span className="concierge-step-name">04 / PERSONAL TOUCH</span>
            <h2 id="concierge-wizard-title">Let&apos;s get it just right.</h2>
            <p className="concierge-step-description">Tell us what you enjoy—and anything you must avoid.</p>
            <div className="concierge-form-card"><div className="concierge-form-label"><ShieldAlert size={18}/> Dietary preference or restriction</div>
              <div className="concierge-chips">{diets.map(([key,label]) => <button type="button" key={key} aria-pressed={choices.diet===key} className={choices.diet===key?"is-selected":""} onClick={() => set("diet",key)}>{label}</button>)}</div>
            </div>
            <div className="concierge-form-card"><div className="concierge-form-label"><Flame size={18}/> Spice preference</div>
              <div className="concierge-chips">{spices.map(([key,label]) => <button type="button" key={key} aria-pressed={choices.spice===key} className={choices.spice===key?"is-selected":""} onClick={() => set("spice",key)}>{label}</button>)}</div>
            </div>
            <div className="concierge-form-card"><label htmlFor="concierge-avoid"><Heart size={18}/> Ingredients to avoid (optional)</label>
              <input id="concierge-avoid" maxLength={120} value={choices.avoid} onChange={(event) => set("avoid",event.target.value)} placeholder="e.g. mushrooms, peanuts" />
              <small>For allergies, always confirm preparation and cross-contact directly with staff.</small>
            </div>
            <div className="concierge-form-card"><label htmlFor="concierge-extra"><ChefHat size={18}/> Anything else? (optional)</label>
              <textarea id="concierge-extra" rows={2} maxLength={240} value={choices.craving} onChange={(event) => set("craving",event.target.value)} placeholder="Something light, comforting, with paneer…" /></div>
          </>}
          {step === 4 && <>
            <span className="concierge-step-name">MADE FOR YOUR TABLE</span>
            <h2 id="concierge-wizard-title">{busy?"Finding your perfect match…":"Here's what sounds good."}</h2>
            {busy && <p className="concierge-loading" role="status"><Sparkles size={20} aria-hidden="true"/> Checking the restaurant&apos;s dishes and building a meal.</p>}
            {error && <div role="alert" className="concierge-error">{error}<button type="button" onClick={() => onRecommend(choices)}>Try again</button></div>}
            {!busy && children}
          </>}
        </div>
        <footer className="concierge-modal-footer">
          <button type="button" className="concierge-secondary" disabled={busy} onClick={() => step===0?onClose():setStep(step===4?3:step-1)}><ArrowLeft size={17}/>{step===0?"Close":step===4?"Edit preferences":"Back"}</button>
          {step<4 && <button type="button" className="concierge-primary" onClick={() => step===3?submit():setStep(step+1)}>
            {step===3?"Curate my meal":"Continue"}{step===3?<Sparkles size={18}/>:<ArrowRight size={18}/>}
          </button>}
        </footer>
      </div>
    </div>
  );
}
