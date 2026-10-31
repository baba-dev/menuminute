"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicProduct } from "@/modules/menu-product/service";
import type { ConciergePreferences, ConciergeResponse } from "@/modules/menu-product/concierge-contracts";
import type { MealItem } from "@/modules/menu-product/concierge-engine";
import { ConciergeWizard } from "./concierge-wizard";
import { ConciergeResults } from "./concierge-results";

type Props = {
  data: PublicProduct;
  token: string;
  craving: string;
  ordering: boolean;
  preview: boolean;
  onClose: () => void;
  onAddMeal: (items: MealItem[]) => void;
  onViewDish: (dishId: string) => void;
};
export function ConciergeExperience({ data, token, craving, ordering, preview, onClose, onAddMeal, onViewDish }: Props) {
  const [response, setResponse] = useState<ConciergeResponse | null>(null);
  const [preferences, setPreferences] = useState<ConciergePreferences | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestRequest = useRef<AbortController | null>(null);
  useEffect(() => () => latestRequest.current?.abort(), []);
  const close = useCallback(() => { latestRequest.current?.abort(); onClose(); }, [onClose]);
  const recommend = async (next: ConciergePreferences) => {
    latestRequest.current?.abort();
    const controller = new AbortController();
    latestRequest.current = controller;
    setResponse(null); setPreferences(next); setBusy(true); setError(null);
    try {
      const lang = data.locale ? "?lang=" + encodeURIComponent(data.locale) : "";
      const result = await fetch("/api/public-menu/"+encodeURIComponent(token)+"/concierge"+lang,{
        method:"POST",
        headers:{"content-type":"application/json"},
        cache:"no-store",
        body:JSON.stringify(next),
        signal:controller.signal,
      });
      const json: unknown = await result.json();
      if (!result.ok) {
        const message = json && typeof json==="object" && "message" in json && typeof json.message==="string" ? json.message : "Recommendations are unavailable right now.";
        throw new Error(message);
      }
      if (!controller.signal.aborted) setResponse(json as ConciergeResponse);
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Could not create recommendations. Try classic search.");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  return <ConciergeWizard craving={craving} currency={data.outlet.currency} busy={busy} error={error} onClose={close} onRecommend={recommend}>
    {response && preferences && <ConciergeResults
      key={response.fingerprint+":"+response.source+":"+JSON.stringify(response.recommendations)}
      data={data} response={response} preferences={preferences}
      preview={preview} ordering={ordering} onAddMeal={onAddMeal} onViewDish={onViewDish}
    />}
  </ConciergeWizard>;
}
