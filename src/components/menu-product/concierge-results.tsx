"use client";

import { useState } from "react";
import { ArrowLeftRight, ArrowRight, Check, Flame, ShoppingBag, Sparkles } from "lucide-react";
import { projectMenu } from "@/modules/menu-product/projector";
import { dishVisual } from "@/modules/menu-product/public-presentation";
import { candidatesForMenu, estimateSubtotal, validMeal, type MealItem } from "@/modules/menu-product/concierge-engine";
import type { ConciergePreferences, ConciergeResponse } from "@/modules/menu-product/concierge-contracts";
import type { PublicProduct } from "@/modules/menu-product/service";
import { formatPrice } from "@/lib/utils";
import { DiningImage } from "./dining-image";

type Props = {
  response: ConciergeResponse;
  preferences: ConciergePreferences;
  data: PublicProduct;
  preview: boolean;
  ordering: boolean;
  onAddMeal: (items: MealItem[]) => void;
  onViewDish: (id: string) => void;
};
const headings = ["Best match", "An alternative", "Something different"];
const moodNames: Record<ConciergePreferences["mood"],string> = {
  comfort:"comforting",bold:"bold",fresh:"fresh",indulgent:"indulgent",adventure:"adventurous",quick:"quick",
};

export function ConciergeResults({ response, preferences, data, preview, ordering, onAddMeal, onViewDish }: Props) {
  const [active, setActive] = useState(0);
  const [overrides, setOverrides] = useState<Record<number,MealItem[]>>({});
  const [swapNote, setSwapNote] = useState("");
  const candidates = candidatesForMenu(data,preferences);
  const lookup = new Map(candidates.map((candidate) => [candidate.dishId,candidate]));
  const dishes = new Map(data.menus.flatMap((menu) =>
    projectMenu(menu.document,data.outlet.timezone,new Date(data.now),menu.overrides).categories.flatMap((category) =>
      category.items.map((dish) => [dish.id,{dish,category:category.name}] as const)
    )
  ));
  if (!response.recommendations.length) return (
    <div className="concierge-no-results">
      <Sparkles size={28} aria-hidden="true" />
      <p>{response.notice ?? "No suitable meal combinations are available right now."}</p>
      <p>Please change your preferences or browse the menu.</p>
    </div>
  );
  const plan = response.recommendations[active]!;
  const items = overrides[active] ?? plan.items;
  const subtotal = estimateSubtotal(items,candidates);
  const outOfDate = response.fingerprint !== data.catalogFingerprint || !validMeal(items,candidates,preferences);
  const swap = (index: number) => {
    const item = items[index]!;
    const original = lookup.get(item.dishId);
    if (!original) return;
    const alternative = candidates.filter((candidate) =>
      candidate.role === original.role && candidate.dishId !== original.dishId &&
      !items.some((entry)=>entry.dishId===candidate.dishId)
    ).sort((a,b)=>a.priceMinor-b.priceMinor);
    const next = alternative.find((candidate) =>
      validMeal(items.map((entry,i)=>i===index?{dishId:candidate.dishId,quantity:entry.quantity}:entry),candidates,preferences)
    );
    if (!next) { setSwapNote("No other currently available dish fits this course and budget."); return; }
    setSwapNote("");
    setOverrides((prior)=>({...prior,[active]:items.map((entry,i)=>i===index?{dishId:next.dishId,quantity:entry.quantity}:entry)}));
  };
  return (
    <div className="concierge-results">
      <p className="concierge-step-description">Curated from this restaurant&apos;s menu for {preferences.guests} {preferences.guests===1?"guest":"guests"} · {moodNames[preferences.mood]} mood.</p>
      {response.recommendations.length>1 && <div className="concierge-result-tabs" role="tablist" aria-label="Recommended meals">
        {response.recommendations.map((suggestion,index)=><button type="button" key={index} role="tab" aria-selected={active===index}
          className={active===index?"is-selected":""} onClick={()=>{setActive(index);setSwapNote("");}}>{headings[index]??"Another option"}</button>)}
      </div>}
      <div className="concierge-meal-header">
        <div><span className="concierge-eyebrow"><Sparkles size={14} aria-hidden="true"/> A MEAL FOR YOUR TABLE</span><h3>{plan.title}</h3><p>{plan.introduction}</p></div>
        {subtotal!==null&&<div className="concierge-subtotal"><small>Estimated subtotal</small><strong>{formatPrice(subtotal,data.outlet.currency)}</strong></div>}
      </div>
      <div className="concierge-meal-items">
        {items.map((item,index)=>{
          const found=dishes.get(item.dishId);
          const candidate=lookup.get(item.dishId);
          if (!found||!candidate) return null;
          return <article className="concierge-meal-item" key={item.dishId}>
            <DiningImage visual={dishVisual(found.dish,found.category,preview)} />
            <div className="concierge-meal-item-body">
              <span className="concierge-step-name">{candidate.role} · {candidate.category}</span>
              <h4>{found.dish.name}</h4>
              <span className="concierge-item-meta">{item.quantity} × from {formatPrice(candidate.priceMinor,data.outlet.currency)} {candidate.heat!==null&&candidate.heat>0&&<><Flame size={13} aria-hidden="true"/> {candidate.heat}/4</>}</span>
              <div className="concierge-item-actions">
                <button type="button" onClick={()=>swap(index)} disabled={outOfDate}><ArrowLeftRight size={15}/> Swap</button>
                <button type="button" onClick={()=>onViewDish(item.dishId)}>View & customize <ArrowRight size={14}/></button>
              </div>
            </div>
          </article>;
        })}
      </div>
      {swapNote&&<p role="status" className="concierge-inline-note">{swapNote}</p>}
      {response.notice&&<p className="concierge-inline-note">{response.notice}</p>}
      {outOfDate&&<p role="alert" className="concierge-error">The menu or availability changed. Generate a fresh recommendation before ordering.</p>}
      {ordering ? <button className="concierge-add-meal" disabled={outOfDate} type="button" onClick={()=>onAddMeal(items)}>
        <ShoppingBag size={19} aria-hidden="true"/> Review & add meal to order <ArrowRight size={19} aria-hidden="true"/>
      </button> : <div className="concierge-browse-note"><Check size={18}/> Explore each dish above. Online ordering is not enabled for this restaurant.</div>}
      <p className="concierge-safety-note">Estimated subtotal excludes any applicable taxes and fees. Prices and options are confirmed when ordering. Dietary details come from the restaurant; confirm allergens and cross-contact with staff.</p>
    </div>
  );
}
