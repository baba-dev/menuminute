"use client";

import { useState } from "react";
import { ArrowRight, Search, Sparkles, WandSparkles } from "lucide-react";

type Props = { onStart: (craving: string) => void };

export function ConciergeEntry({ onStart }: Props) {
  const [craving, setCraving] = useState("");
  return (
    <section className="concierge-entry" aria-labelledby="concierge-entry-title">
      <div className="concierge-entry-orb" aria-hidden="true"><WandSparkles size={36} /></div>
      <div className="concierge-entry-content">
        <span className="concierge-eyebrow"><Sparkles size={15} aria-hidden="true" /> YOUR DINING CONCIERGE</span>
        <h3 id="concierge-entry-title">What do you feel like eating?</h3>
        <p>Tell us what you&apos;re craving. We&apos;ll put together something wonderful from this restaurant&apos;s menu.</p>
        <form className="concierge-craving" onSubmit={(event) => { event.preventDefault(); onStart(craving.trim()); }}>
          <label htmlFor="concierge-craving-input" className="sr-only">What are you craving?</label>
          <Search size={19} aria-hidden="true" />
          <input id="concierge-craving-input" value={craving} onChange={(event) => setCraving(event.target.value.slice(0, 240))} maxLength={240}
            placeholder="Spicy, comforting, something for two..." />
          <button type="submit" aria-label="Start dining concierge"><ArrowRight size={20} /></button>
        </form>
        <div className="concierge-prompts" aria-label="Suggestions">
          {["Something comforting", "Surprise me", "Dinner for two"].map((prompt) => (
            <button type="button" key={prompt} onClick={() => onStart(prompt)}>{prompt}</button>
          ))}
        </div>
        <span className="concierge-classic-note"><Search size={14} aria-hidden="true" /> Or use classic menu search below</span>
      </div>
    </section>
  );
}
