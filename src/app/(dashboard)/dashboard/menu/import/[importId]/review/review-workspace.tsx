"use client";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  FileCheck2,
  Image as ImageIcon,
  RefreshCw,
  Save,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { displayToMinor, currencyExponent } from "@/lib/money";
import type { ImportCandidate } from "@/modules/menu-import/contracts";
import type { MenuDocument } from "@/modules/menu-product/contracts";
type Review = {
  document: MenuDocument;
  confirmedIds: string[];
  state: string;
  baseCandidateRevision: number;
  reviewRevision: number;
  appliedMenuId: string | null;
  appliedMenuRevision: number | null;
};
type Session = {
  id: string;
  status: string;
  revision: number;
  targetMenuId: string | null;
  currency: string;
  sources: Array<{ id: string; pageIndex: number; status: string }>;
  candidate: { revision: number; document: ImportCandidate };
  review: Review | null;
};
export function ReviewWorkspace({
  outletId,
  importId,
  initial,
  candidate,
  initialDocument,
}: {
  outletId: string;
  importId: string;
  initial: Session;
  candidate: ImportCandidate;
  initialDocument: MenuDocument;
}) {
  const [session, setSession] = useState(initial);
  const [doc, setDoc] = useState<MenuDocument>(initial.review?.document ?? initialDocument);
  const [confirmed, setConfirmed] = useState<string[]>(initial.review?.confirmedIds ?? []);
  const [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<Record<string, string>>({});
  const [activeSource, setActiveSource] = useState(initial.sources[0]?.id ?? "");
  const [zoom, setZoom] = useState(100);
  const [mobileView, setMobileView] = useState<"source" | "details">("details");
  const [filter, setFilter] = useState<"all" | "attention" | "verified">("all");
  const newMenu = useRef(crypto.randomUUID());
  const [priceTexts, setPriceTexts] = useState<Record<string, string>>(() => {
    const result: Record<string, string> = {};
    const exponent = currencyExponent(candidate.currency) ?? 2;
    for (const cat of candidate.categories)
      for (const dish of cat.items) {
        const reviewDish = initial.review?.document.categories
          .find((c) => c.id === cat.id)
          ?.items.find((i) => i.id === dish.id);
        result[dish.id] = reviewDish
          ? (reviewDish.priceMinor / 10 ** exponent).toFixed(exponent)
          : dish.priceMinor.value === null
            ? ""
            : (dish.priceMinor.value / 10 ** exponent).toFixed(exponent);
        for (const v of dish.variants) {
          const reviewVariant = reviewDish?.variants.find((o) => o.id === v.id);
          result[v.id] = reviewVariant
            ? (reviewVariant.priceMinor / 10 ** exponent).toFixed(exponent)
            : v.priceMinor.value === null
              ? ""
              : (v.priceMinor.value / 10 ** exponent).toFixed(exponent);
        }
      }
    return result;
  });
  const json = useCallback(
    async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
      const response = await fetch(path, {
        ...options,
        cache: "no-store",
        headers: { "x-outlet-id": outletId, ...options.headers },
      });
      const body = await response.json().catch(() => ({ message: "Invalid server response" }));
      if (!response.ok)
        throw new Error(
          body.message ?? "The review could not be updated. Your inputs are preserved."
        );
      return body as T;
    },
    [outletId]
  );
  const refresh = useCallback(async () => {
    const next = await json<Session>("/api/menu-imports/" + encodeURIComponent(importId));
    setSession(next);
    if (next.review) {
      setDoc(next.review.document);
      setConfirmed(next.review.confirmedIds);
    }
    setDirty(false);
    return next;
  }, [importId, json]);
  useEffect(() => {
    let active = true;
    const urls: string[] = [];
    void Promise.all(
      initial.sources
        .filter((s) => s.status === "ready")
        .map(async (source) => {
          const r = await fetch(
            "/api/menu-imports/" +
              encodeURIComponent(importId) +
              "/sources/" +
              encodeURIComponent(source.id),
            { cache: "no-store", headers: { "x-outlet-id": outletId } }
          );
          if (!r.ok) return null;
          const blob = await r.blob();
          if (!active) return null;
          const url = URL.createObjectURL(blob);
          urls.push(url);
          return [source.id, url] as const;
        })
    )
      .then((entries) => {
        if (active)
          setPreview(
            Object.fromEntries(entries.filter((e): e is readonly [string, string] => e !== null))
          );
      })
      .catch(() => {
        if (active) setNotice("Some private source previews are unavailable. Reload to retry.");
      });
    return () => {
      active = false;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [outletId, importId, initial.sources]);
  const ids = candidate.categories.flatMap((c) => [
    c.id,
    ...c.items.flatMap((d) => [d.id, ...d.variants.map((v) => v.id)]),
  ]);
  const confirmedCount = confirmed.filter((x) => ids.includes(x)).length;
  const outstanding = ids.length - confirmedCount;
  const visible = (id: string) => filter === "all" || (filter === "verified" ? confirmed.includes(id) : !confirmed.includes(id));
  const visibleCategory = (cat: ImportCandidate["categories"][number]) => visible(cat.id) || cat.items.some((dish) => visible(dish.id) || dish.variants.some((v) => visible(v.id)));
  function selectSource(id: string) { setActiveSource(id); setMobileView("source"); setZoom(100); }
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function change(fn: (previous: MenuDocument) => MenuDocument, id: string) {
    setDoc(fn);
    setConfirmed((prev) => prev.filter((x) => x !== id));
    setDirty(true);
    setNotice("");
  }
  function confirm(id: string) {
    setConfirmed((previous) =>
      previous.includes(id) ? previous.filter((x) => x !== id) : [...previous, id]
    );
    setDirty(true);
  }
  function price(id: string, text: string, update: (n: number) => void) {
    setPriceTexts((prev) => ({ ...prev, [id]: text }));
    try {
      const minor = displayToMinor(text, candidate.currency);
      update(minor);
    } catch {
      setConfirmed((prev) => prev.filter((x) => x !== id));
      setDirty(true);
    }
  }
  async function save(finalize: boolean) {
    if (busy) return;
    setError("");
    setNotice("");
    setBusy(true);
    try {
      for (const c of candidate.categories)
        for (const d of c.items) {
          for (const item of [d, ...d.variants]) {
            const value = priceTexts[item.id];
            if (
              confirmed.includes(item.id) &&
              (!value || !Number.isFinite(displayToMinor(value, candidate.currency)))
            )
              throw new Error("Enter a valid visible price before confirming a dish or variant.");
          }
        }
      if (finalize && confirmedCount !== ids.length)
        throw new Error("Confirm every category, dish and variant against the original photos.");
      const result = await json<{ revision: number; status: string }>(
        "/api/menu-imports/" + encodeURIComponent(importId) + "/review",
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            expectedRevision: session.revision,
            candidateRevision: session.candidate.revision,
            document: doc,
            confirmedIds: confirmed,
            finalize,
          }),
        }
      );
      setSession((prev) => ({
        ...prev,
        revision: result.revision,
        status: result.status,
        review: {
          document: doc,
          confirmedIds: confirmed,
          state: finalize ? "confirmed" : "editing",
          baseCandidateRevision: prev.candidate.revision,
          reviewRevision: result.revision,
          appliedMenuId: null,
          appliedMenuRevision: null,
        },
      }));
      setDirty(false);
      setNotice(
        finalize
          ? "Human review confirmed. Only a private menu draft can be created."
          : "Corrections saved privately; nothing was published."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review save failed");
    } finally {
      setBusy(false);
    }
  }
  async function apply() {
    if (busy || dirty || session.status !== "ready") return;
    if (
      !window.confirm(
        "Create or update an editable menu DRAFT from the confirmed review? The published menu will not change."
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      let menuId = newMenu.current,
        expectedMenuRevision = 0;
      if (session.targetMenuId) {
        const target = await json<{
          revision: number;
          publishedRevision: number | null;
          canWrite: boolean;
        }>("/api/catalog/" + encodeURIComponent(session.targetMenuId));
        if (!target.canWrite) throw new Error("You no longer have access to this target menu");
        menuId = session.targetMenuId;
        expectedMenuRevision = target.revision;
        if (
          !window.confirm(
            "The existing menu's editable draft will be replaced. Its published release remains unchanged. Continue?"
          )
        )
          return;
      }
      const response = await json<{ menuId: string; revision: number; menuRevision: number }>(
        "/api/menu-imports/" + encodeURIComponent(importId) + "/apply",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            expectedRevision: session.revision,
            menuId,
            expectedMenuRevision,
          }),
        }
      );
      setSession((prev) => ({
        ...prev,
        status: "applied",
        revision: response.revision,
        review: prev.review
          ? {
              ...prev.review,
              state: "applied",
              appliedMenuId: response.menuId,
              appliedMenuRevision: response.menuRevision,
            }
          : null,
      }));
      setNotice(
        "Applied to a PRIVATE menu draft. Review it in Menu Studio and publish separately."
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Draft application failed. Refresh before retrying."
      );
    } finally {
      setBusy(false);
    }
  }
  const locked = session.status === "applied";
  return (
    <div className="scan-table space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/dashboard/menu/import" className="scan-back" onClick={(event) => {
          if (dirty && !window.confirm("Leave before saving your review changes?")) event.preventDefault();
        }}><ArrowLeft className="size-4" /> The Scan Table</Link>
        <span className="scan-private inline-flex items-center gap-2"><ShieldCheck className="size-4" /> Human verified · Never auto-published</span>
      </div>
      <header className="scan-hero">
        <div className="scan-hero-copy">
          <p className="scan-eyebrow">RECIPE ATELIER / THE REVIEW DESK</p>
          <h1>Perfect every detail.</h1>
          <p className="scan-subtitle">Compare the original photo against each extracted dish. Verify names and prices before creating a private editable menu draft.</p>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-bold">
            <span>{confirmedCount} / {ids.length} verified</span>
            <span>{outstanding} to check</span>
            <span>Revision {session.revision}</span>
            {dirty && <span role="status">Unsaved changes</span>}
          </div>
        </div>
      </header>
      <div className="scan-mobile-toggle" role="group" aria-label="Review workspace view">
        <button className="scan-action scan-action--secondary flex-1" aria-pressed={mobileView === "source"} onClick={() => setMobileView("source")}>Original photo</button>
        <button className="scan-action scan-action--secondary flex-1" aria-pressed={mobileView === "details"} onClick={() => setMobileView("details")}>Extracted dishes</button>
      </div>
      {error && (
        <p role="alert" className="flex gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-xl bg-orange-50 p-4 text-sm text-orange-900">
          {notice}
        </p>
      )}
      <div className="scan-review-workspace" data-mobile-view={mobileView}>
        <aside
          aria-label="Original source photographs"
          className="scan-review-source min-w-0 space-y-3 lg:sticky lg:top-6 lg:self-start"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-stone-900">01 / Original source</h2>
            <ImageIcon className="size-5 text-orange-600" />
          </div>
          <div className="scan-review-panel">
            <div className="scan-review-toolbar mb-3" role="group" aria-label="Source image zoom">
              <button type="button" aria-label="Zoom out" disabled={zoom <= 100} onClick={() => setZoom((value) => Math.max(100, value - 25))}>−</button>
              <span className="scan-status text-xs font-bold">{zoom}%</span>
              <button type="button" aria-label="Zoom in" disabled={zoom >= 200} onClick={() => setZoom((value) => Math.min(200, value + 25))}>+</button>
              <button type="button" onClick={() => setZoom(100)}>Fit</button>
            </div>
            <div className="scan-source-canvas">
            {preview[activeSource] ? (
              <Image
                src={preview[activeSource]!}
                width={800}
                height={1000}
                unoptimized
                alt="Private original menu photograph"
                className="rounded-xl object-contain"
                style={{ width: `${zoom}%` }}
              />
            ) : (
              <div className="flex h-64 items-center justify-center rounded-xl bg-stone-100 text-sm text-stone-500">
                Private preview unavailable
              </div>
            )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {session.sources.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => selectSource(s.id)}
                  aria-pressed={activeSource === s.id}
                  className={
                    activeSource === s.id
                      ? "rounded-lg bg-orange-600 px-3 py-2 text-xs font-bold text-white"
                      : "rounded-lg bg-stone-100 px-3 py-2 text-xs font-bold text-stone-700"
                  }
                >
                  Page {s.pageIndex + 1}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-stone-500">
              Sources are authenticated, private and never hotlinked publicly.
            </p>
          </div>
        </aside>
        <section className="scan-review-editor min-w-0 space-y-4" aria-label="Editable recognized dishes">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-stone-900">02 / Verify extraction</h2>
            <Eye className="size-5 text-orange-600" />
          </div>
          <div className="scan-review-panel">
            <label className="text-xs font-bold text-stone-700">
              Private draft title
              <input
                aria-label="Private draft title"
                maxLength={100}
                disabled={locked}
                value={doc.name}
                onChange={(e) => {
                  setDoc((prev) => ({ ...prev, name: e.target.value }));
                  setDirty(true);
                }}
                className="mt-2 w-full rounded-xl border border-stone-300 p-3 text-sm text-stone-950"
              />
            </label>
          </div>
          <div className="scan-review-toolbar" role="group" aria-label="Review status filters">
            <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All ({ids.length})</button>
            <button type="button" aria-pressed={filter === "attention"} onClick={() => setFilter("attention")}>Needs review ({outstanding})</button>
            <button type="button" aria-pressed={filter === "verified"} onClick={() => setFilter("verified")}>Verified ({confirmedCount})</button>
          </div>
          {candidate.categories.map((c, ci) => (
            <section
              key={c.id}
              className={`scan-review-panel overflow-hidden ${visibleCategory(c) ? "" : "hidden"}`}
            >
              <div className="space-y-3 border-b border-stone-200 bg-stone-50 p-4">
                <label className="block text-xs font-bold text-stone-700">
                  Category name
                  <input
                    aria-label={"Category " + (ci + 1) + " name"}
                    maxLength={100}
                    disabled={locked}
                    className="mt-1 w-full rounded-xl border border-stone-300 p-3 text-sm text-stone-950"
                    value={doc.categories[ci]?.name ?? ""}
                    onChange={(e) =>
                      change(
                        (prev) => ({
                          ...prev,
                          categories: prev.categories.map((cat, i) =>
                            i === ci ? { ...cat, name: e.target.value } : cat
                          ),
                        }),
                        c.id
                      )
                    }
                  />
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold text-stone-800">
                  <input
                    type="checkbox"
                    disabled={locked}
                    checked={confirmed.includes(c.id)}
                    onChange={() => confirm(c.id)}
                  />
                  I checked this category heading against the photograph
                </label>
                {c.name.evidence.map((e, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => selectSource(e.sourceId)}
                    className="text-xs font-semibold text-orange-700 underline"
                  >
                    Source page{" "}
                    {session.sources.find((s) => s.id === e.sourceId)?.pageIndex !== undefined
                      ? session.sources.find((s) => s.id === e.sourceId)!.pageIndex + 1
                      : "?"}
                    : {e.excerpt ?? "heading"}
                  </button>
                ))}
              </div>
              <div className="space-y-5 p-4">
                {c.items.map((dish, di) => {
                  const current = doc.categories[ci]?.items[di];
                  if (!current) return null;
                  return (
                    <fieldset
                      key={dish.id}
                      disabled={locked}
                      className={`space-y-3 rounded-xl border p-4 ${visible(dish.id) || dish.variants.some((v) => visible(v.id)) ? "" : "hidden"}`}
                    >
                      <legend className="px-1 text-sm font-black text-stone-900">
                        Dish {di + 1}
                      </legend>
                      <label className="block text-xs font-bold text-stone-700">
                        Dish name
                        <input
                          aria-label={"Dish " + (ci + 1) + "." + (di + 1) + " name"}
                          maxLength={100}
                          value={current.name}
                          onChange={(e) =>
                            change(
                              (prev) => ({
                                ...prev,
                                categories: prev.categories.map((cat, i) =>
                                  i !== ci
                                    ? cat
                                    : {
                                        ...cat,
                                        items: cat.items.map((item, j) =>
                                          j === di ? { ...item, name: e.target.value } : item
                                        ),
                                      }
                                ),
                              }),
                              dish.id
                            )
                          }
                          className="mt-1 w-full rounded-lg border border-stone-300 p-3 text-sm"
                        />
                      </label>
                      <label className="block text-xs font-bold text-stone-700">
                        Description (only if confirmed)
                        <textarea
                          aria-label={"Dish " + (ci + 1) + "." + (di + 1) + " description"}
                          maxLength={1000}
                          rows={2}
                          value={current.description}
                          onChange={(e) =>
                            change(
                              (prev) => ({
                                ...prev,
                                categories: prev.categories.map((cat, i) =>
                                  i !== ci
                                    ? cat
                                    : {
                                        ...cat,
                                        items: cat.items.map((item, j) =>
                                          j === di ? { ...item, description: e.target.value } : item
                                        ),
                                      }
                                ),
                              }),
                              dish.id
                            )
                          }
                          className="mt-1 w-full rounded-lg border border-stone-300 p-3 text-sm"
                        />
                      </label>
                      <label className="block text-xs font-bold text-stone-700">
                        Price ({candidate.currency})
                        <input
                          aria-label={"Dish " + (ci + 1) + "." + (di + 1) + " price"}
                          inputMode="decimal"
                          required
                          value={priceTexts[dish.id] ?? ""}
                          onChange={(e) =>
                            price(dish.id, e.target.value, (n) =>
                              change(
                                (prev) => ({
                                  ...prev,
                                  categories: prev.categories.map((cat, i) =>
                                    i !== ci
                                      ? cat
                                      : {
                                          ...cat,
                                          items: cat.items.map((item, j) =>
                                            j === di ? { ...item, priceMinor: n } : item
                                          ),
                                        }
                                  ),
                                }),
                                dish.id
                              )
                            )
                          }
                          className="mt-1 w-full rounded-lg border border-stone-300 p-3 text-sm"
                        />
                      </label>
                      {dish.priceMinor.value === null && (
                        <p className="text-xs font-bold text-orange-800">
                          AI could not verify this price — enter it from the source photo.
                        </p>
                      )}
                      {dish.name.evidence.map((e, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => selectSource(e.sourceId)}
                          className="block text-xs font-semibold text-orange-700 underline"
                        >
                          View source: {e.excerpt ?? "dish"}
                        </button>
                      ))}
                      {dish.variants.map((v, vi) => {
                        const item = current.variants[vi];
                        if (!item) return null;
                        return (
                          <div key={v.id} className="rounded-lg bg-stone-50 p-3">
                            <label className="block text-xs font-bold text-stone-700">
                              Variant name
                              <input
                                aria-label={
                                  "Variant " + (ci + 1) + "." + (di + 1) + "." + (vi + 1) + " name"
                                }
                                maxLength={100}
                                value={item.name}
                                onChange={(e) =>
                                  change(
                                    (prev) => ({
                                      ...prev,
                                      categories: prev.categories.map((cat, i) =>
                                        i !== ci
                                          ? cat
                                          : {
                                              ...cat,
                                              items: cat.items.map((d, j) =>
                                                j !== di
                                                  ? d
                                                  : {
                                                      ...d,
                                                      variants: d.variants.map((vv, k) =>
                                                        k === vi
                                                          ? { ...vv, name: e.target.value }
                                                          : vv
                                                      ),
                                                    }
                                              ),
                                            }
                                      ),
                                    }),
                                    v.id
                                  )
                                }
                                className="mt-1 w-full rounded-lg border border-stone-300 p-2"
                              />
                            </label>
                            <label className="mt-2 block text-xs font-bold text-stone-700">
                              Variant price ({candidate.currency})
                              <input
                                aria-label={
                                  "Variant " + (ci + 1) + "." + (di + 1) + "." + (vi + 1) + " price"
                                }
                                inputMode="decimal"
                                value={priceTexts[v.id] ?? ""}
                                onChange={(e) =>
                                  price(v.id, e.target.value, (n) =>
                                    change(
                                      (prev) => ({
                                        ...prev,
                                        categories: prev.categories.map((cat, i) =>
                                          i !== ci
                                            ? cat
                                            : {
                                                ...cat,
                                                items: cat.items.map((d, j) =>
                                                  j !== di
                                                    ? d
                                                    : {
                                                        ...d,
                                                        variants: d.variants.map((vv, k) =>
                                                          k === vi ? { ...vv, priceMinor: n } : vv
                                                        ),
                                                      }
                                                ),
                                              }
                                        ),
                                      }),
                                      v.id
                                    )
                                  )
                                }
                                className="mt-1 w-full rounded-lg border border-stone-300 p-2"
                              />
                            </label>
                            <label className="mt-2 flex items-center gap-2 text-xs font-bold text-stone-700">
                              <input
                                type="checkbox"
                                checked={confirmed.includes(v.id)}
                                onChange={() => confirm(v.id)}
                                disabled={!priceTexts[v.id]}
                              />
                              Variant verified against source
                            </label>
                          </div>
                        );
                      })}
                      <label className="flex items-start gap-2 text-sm font-semibold text-stone-800">
                        <input
                          type="checkbox"
                          checked={confirmed.includes(dish.id)}
                          onChange={() => confirm(dish.id)}
                          disabled={!priceTexts[dish.id]}
                        />
                        I verified this dish, description and its price against the photograph
                      </label>
                    </fieldset>
                  );
                })}
              </div>
            </section>
          ))}
        </section>
      </div>
      <div className="scan-review-dock">
        <div className="text-xs font-semibold text-stone-600">
          <FileCheck2 className="mr-2 inline size-4 text-orange-600" />
          {confirmedCount} of {ids.length} verified · {outstanding} remaining · Saves only a private draft
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || locked}
            onClick={() => {
              if (!dirty || window.confirm("Discard unsaved corrections and load server draft?"))
                void refresh().catch((e) => setError(String(e)));
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-stone-300 px-4 py-3 text-sm font-bold text-stone-800"
          >
            <RefreshCw className="size-4" />
            Reload
          </button>
          <button
            type="button"
            disabled={busy || locked || !dirty}
            onClick={() => void save(false)}
            className="inline-flex items-center gap-2 rounded-xl border border-stone-300 px-4 py-3 text-sm font-bold text-stone-800 disabled:opacity-40"
          >
            <Save className="size-4" />
            Save corrections
          </button>
          <button
            type="button"
            disabled={busy || locked || confirmedCount !== ids.length}
            onClick={() => void save(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-40"
          >
            <CheckCircle2 className="size-4" />
            Confirm review
          </button>
          <button
            type="button"
            disabled={busy || dirty || session.status !== "ready"}
            onClick={() => void apply()}
            className="inline-flex items-center gap-2 rounded-xl bg-stone-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-40"
          >
            Apply to private draft
          </button>
          {session.review?.appliedMenuId && (
            <Link
              href="/dashboard/menu"
              className="rounded-xl bg-orange-600 px-4 py-3 text-sm font-bold text-white"
            >
              Open Menu Studio →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
