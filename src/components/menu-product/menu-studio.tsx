"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Save, Eye, Send, ArrowUp, ArrowDown, ImagePlus } from "lucide-react";
import { SmartDishComposer, type QuickDish } from "./smart-dish-composer";
import {
  findDishDuplicate,
  normalizeDishText,
  type OrganizationDish,
} from "@/modules/menu-product/dish-intelligence";
import { menuDocumentSchema, type MenuDocument } from "@/modules/menu-product/contracts";
import { displayToMinor, currencyExponent } from "@/lib/money";
import type { menuDetail } from "@/modules/menu-product/service";
import { PublicMenu } from "./public-menu";
import { ScheduleEditor } from "./schedule-editor";
type Detail = Awaited<ReturnType<typeof menuDetail>>;
type Media = { id: string; status: string; approvedAt: string | null; lastError: string | null };
const id = () => crypto.randomUUID();
function Money({
  value,
  currency,
  onChange,
  label,
}: {
  value: number;
  currency: string;
  onChange: (v: number) => void;
  label: string;
}) {
  const [text, setText] = useState(
    (value / 10 ** (currencyExponent(currency) ?? 2)).toFixed(currencyExponent(currency) ?? 2)
  );
  return (
    <label className="field">
      {label} ({currency})
      <input
        aria-label={label}
        inputMode="decimal"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          try {
            const n = displayToMinor(e.target.value, currency);
            e.target.setCustomValidity("");
            onChange(n);
          } catch {
            e.target.setCustomValidity(
              "Enter a nonnegative price in this currency’s supported precision"
            );
          }
        }}
      />
    </label>
  );
}
function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="field">
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} maxLength={100} required />
    </label>
  );
}
export function MenuStudio({
  outlet,
  initialList,
  initialDetail,
  initialMedia,
  outletChoices,
  brandChoices,
  imports = [],
}: {
  outlet: {
    id: string;
    name: string;
    currency: string;
    timezone: string;
    outletType: string;
    fulfillmentModes: string[];
    publicId: string;
  };
  initialList: { id: string; document: unknown; archived: boolean }[];
  initialDetail: Detail | null;
  initialMedia: Media[];
  outletChoices: { id: string; name: string; currency: string }[];
  brandChoices: { id: string; name: string }[];
  imports?: { id: string; status: string; revision: number; updatedAt: Date | string }[];
}) {
  const router = useRouter();
  const [list, setList] = useState(initialList);
  const [detail, setDetail] = useState(initialDetail);
  const [doc, setDoc] = useState<MenuDocument | null>(initialDetail?.document ?? null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState("dishes");
  const [dishSearch, setDishSearch] = useState("");
  const [composerMode, setComposerMode] = useState<"add" | "find">("add");
  const [composerCategory, setComposerCategory] = useState("");
  const [composerFocus, setComposerFocus] = useState(0);
  const [composerPending, setComposerPending] = useState(false);
  const [composerSelection, setComposerSelection] = useState<QuickDish[]>([]);
  const [organizationDishes, setOrganizationDishes] = useState<OrganizationDish[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [preview, setPreview] = useState(false);
  const [media, setMedia] = useState<Media[]>(initialMedia);
  const [milestone, setMilestone] = useState(false);
  const selected = useRef(initialDetail?.id ?? "");
  const creationKey = useRef(id());
  const commandRetry = useRef({ signature: "", key: "" });
  const form = useRef<HTMLFormElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const headers = { "content-type": "application/json", "x-outlet-id": outlet.id };
  const path = (menuId: string) => `/api/catalog/${menuId}`;
  useEffect(() => {
    if (!detail?.id) return;
    let cancelled = false;
    const controller = new AbortController();
    void fetch(`/api/catalog/suggestions?menuId=${encodeURIComponent(detail.id)}`, {
      headers: { "x-outlet-id": outlet.id },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Organization suggestions unavailable");
        return response.json() as Promise<{ items: OrganizationDish[] }>;
      })
      .then((result) => {
        if (!cancelled) setOrganizationDishes(result.items);
      })
      .catch(() => {
        if (!cancelled) setOrganizationDishes([]);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [detail?.id, outlet.id]);
  async function json(url: string, options?: RequestInit) {
    const r = await fetch(url, {
      ...options,
      headers: { "x-outlet-id": outlet.id, ...options?.headers },
    });
    const body = await r.json();
    if (!r.ok) throw new Error(body.message ?? "Could not save. Your draft fields are preserved.");
    return body;
  }
  async function load(menuId: string) {
    const changedMenu = selected.current !== menuId;
    selected.current = menuId;
    setError("");
    const next = await json(path(menuId));
    if (selected.current !== menuId) return;
    setDetail(next);
    setDoc(next.document);
    setDishSearch("");
    setCategoryFilter("all");
    setComposerCategory("");
    setOrganizationDishes([]);
    setComposerMode("add");
    if (changedMenu) {
      setComposerPending(false);
      setComposerSelection([]);
    }
    setDirty(false);
  }
  function change(next: MenuDocument) {
    setDoc(next);
    setDirty(true);
    setMessage("Unsaved draft changes");
  }
  async function refreshMedia() {
    setMedia(await json("/api/media"));
  }
  async function command(
    action: string,
    data: Record<string, unknown> = {},
    revision = detail?.revision
  ) {
    if (!detail || revision === undefined) throw new Error("Select a menu");
    const signature = JSON.stringify({ id: detail.id, action, data, revision });
    if (commandRetry.current.signature !== signature)
      commandRetry.current = { signature, key: id() };
    return json(path(detail.id), {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        key: commandRetry.current.key,
        expectedRevision: revision,
        action,
        data,
      }),
    });
  }
  async function save() {
    if (!doc || !detail) throw new Error("Select a menu");
    if (composerPending) throw new Error("Review or clear selected Composer dishes before saving.");
    if (!form.current?.reportValidity()) throw new Error("Check the highlighted fields");
    const parsed = menuDocumentSchema.safeParse(doc);
    if (!parsed.success)
      throw new Error(
        parsed.error.issues
          .slice(0, 4)
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")
      );
    const result = await command("save", { document: parsed.data });
    await load(detail.id);
    setDirty(false);
    setMessage("Draft saved. Publish when ready.");
    return result.revision as number;
  }
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }
  function updateCategory(
    ci: number,
    update: (c: MenuDocument["categories"][number]) => MenuDocument["categories"][number]
  ) {
    if (doc)
      change({ ...doc, categories: doc.categories.map((c, j) => (j === ci ? update(c) : c)) });
  }
  function updateDish(
    ci: number,
    di: number,
    patch: Partial<MenuDocument["categories"][number]["items"][number]>
  ) {
    updateCategory(ci, (c) => ({
      ...c,
      items: c.items.map((d, j) => (j === di ? { ...d, ...patch } : d)),
    }));
  }
  function openComposer(categoryId: string) {
    setComposerCategory(categoryId);
    setComposerMode("add");
    setComposerFocus((i) => i + 1);
  }
  function addQuickDishes(items: QuickDish[], newSectionName: string) {
    if (!doc || !detail?.canWrite || detail.archived) throw new Error("This menu is not editable.");
    const next = structuredClone(doc);
    let newId: string | null = null;
    if (items.some((item) => item.categoryId === "new")) {
      const name = newSectionName.trim();
      if (!name || name.length > 100) throw new Error("Enter a valid section name.");
      if (
        next.categories.some(
          (c) => !c.archived && normalizeDishText(c.name) === normalizeDishText(name)
        )
      )
        throw new Error("That section already exists. Choose it instead.");
      if (next.categories.length >= 100) throw new Error("Menu has reached the section limit.");
      newId = id();
      next.categories.push({ id: newId, name, description: "", archived: false, items: [] });
    }
    for (const item of items) {
      const sectionId = item.categoryId === "new" ? newId : item.categoryId;
      const category = next.categories.find((c) => c.id === sectionId && !c.archived);
      if (!category) throw new Error("Select an active section for " + item.name);
      if (category.items.length >= 1000) throw new Error("Section has reached its dish limit.");
      if (findDishDuplicate(next, category.id, item.name))
        throw new Error(
          item.name + " is already in " + category.name + ". Open the existing dish instead."
        );
      const priceMinor = displayToMinor(item.free ? "0" : item.priceText.trim(), next.currency);
      const photo = media.some((m) => m.id === item.mediaId && m.status === "ready" && m.approvedAt)
        ? item.mediaId
        : null;
      category.items.push({
        id: id(),
        name: item.name.trim(),
        description: "",
        priceMinor,
        soldOut: false,
        archived: false,
        mediaId: photo,
        dietary: [],
        variants: [],
        addOnGroups: [],
        schedule: null,
      });
    }
    const parsed = menuDocumentSchema.safeParse(next);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid menu draft.");
    change(parsed.data);
    setDishSearch("");
    setCategoryFilter("all");
    setMessage(items.length + " dishes added to private draft. Save when ready.");
  }
  function move(ci: number, delta: number) {
    if (!doc) return;
    const categories = [...doc.categories];
    const target = ci + delta;
    if (target < 0 || target >= categories.length) return;
    [categories[ci], categories[target]] = [categories[target]!, categories[ci]!];
    change({ ...doc, categories });
  }
  function moveDish(ci: number, di: number, delta: number) {
    updateCategory(ci, (category) => {
      const items = [...category.items];
      const target = di + delta;
      if (target < 0 || target >= items.length) return category;
      [items[di], items[target]] = [items[target]!, items[di]!];
      return { ...category, items };
    });
  }
  return (
    <div className="product stack">
      <header className="relative overflow-hidden rounded-3xl border border-orange-200 bg-gradient-to-br from-orange-50 via-white to-amber-50 p-6 shadow-sm sm:p-8">
        <div
          className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full border-[32px] border-orange-100/70"
          aria-hidden="true"
        />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div>
            <span className="text-xs font-black tracking-[.2em] text-orange-700 uppercase">
              MenuMinute · {outlet.outletType.replaceAll("_", " ")} · {outlet.currency}
            </span>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">
              Menu Studio
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-7 text-stone-700">
              Build, refine and preview {outlet.name}&apos;s menu in one place. Guests only see what
              you explicitly publish.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/menu/import"
              className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-orange-700"
            >
              <ImagePlus size={17} /> Import from photos
            </Link>
            <Link
              href="/dashboard/qr-codes"
              className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm font-bold text-stone-800 hover:border-orange-400"
            >
              Permanent QR
            </Link>
          </div>
        </div>
      </header>
      <div className="panel row between">
        <label className="field">
          Your menus
          <select
            aria-label="Your menus"
            disabled={busy}
            value={detail?.id ?? ""}
            onChange={(e) => {
              if (e.target.value === selected.current) return;
              if (
                (dirty || composerPending) &&
                !window.confirm("Discard unsaved menu changes and selected dishes?")
              )
                return;
              void run(() => load(e.target.value));
            }}
          >
            <option value="" disabled>
              Select a menu
            </option>
            {list.map((m) => (
              <option key={m.id} value={m.id}>
                {(m.document as MenuDocument).name}
                {m.archived ? " (archived)" : ""}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="ember"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              if (
                (dirty || composerPending) &&
                !window.confirm(
                  "Discard unsaved changes and selected dishes to create another menu?"
                )
              )
                return;
              const result = await json("/api/catalog", {
                method: "POST",
                headers,
                body: JSON.stringify({ key: creationKey.current }),
              });
              const next = await json("/api/catalog");
              setList(next);
              await load(result.menuId);
              // Do not rotate a successful request identity until reconciliation completes.
              // If the list/load response was lost, retry with the same key, not a duplicate menu.
              creationKey.current = id();
              setMessage("Menu draft created");
            })
          }
        >
          <Plus size={16} />
          Create menu
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Menu Studio overview">
        {[
          {
            label: "Sections",
            value: doc?.categories.filter((cat) => !cat.archived).length ?? 0,
            note: "In this editable draft",
          },
          {
            label: "Dishes",
            value:
              doc?.categories.reduce(
                (n, cat) => n + cat.items.filter((item) => !item.archived).length,
                0
              ) ?? 0,
            note: "Across your sections",
          },
          {
            label: "Source imports",
            value: imports.filter((item) => ["needs_review", "ready"].includes(item.status)).length,
            note: "Ready for human review",
          },
          {
            label: "Publication",
            value: detail?.publishedRevision ? "Live" : "Draft",
            note: dirty ? "Unsaved editor changes" : "Explicit publish only",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
          >
            <p className="text-xs font-bold tracking-widest text-stone-500 uppercase">
              {stat.label}
            </p>
            <p className="mt-2 text-2xl font-black text-stone-950 tabular-nums">{stat.value}</p>
            <p className="mt-1 text-xs text-stone-600">{stat.note}</p>
          </div>
        ))}
      </div>
      {imports.some((item) => ["needs_review", "ready"].includes(item.status)) && (
        <section
          aria-label="Pending human review"
          className="rounded-2xl border border-orange-200 bg-orange-50 p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black tracking-widest text-orange-700 uppercase">
                Smart Menu Studio
              </p>
              <h2 className="mt-1 text-base font-bold text-stone-900">
                Your extracted menus need a human eye
              </h2>
              <p className="mt-1 text-xs text-stone-700">
                Compare source photos and correct prices before applying a private draft.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {imports
                .filter((item) => ["needs_review", "ready"].includes(item.status))
                .slice(0, 3)
                .map((item) => (
                  <Link
                    key={item.id}
                    href={"/dashboard/menu/import/" + encodeURIComponent(item.id) + "/review"}
                    className="rounded-xl bg-white px-4 py-3 text-xs font-bold text-orange-800 shadow-sm hover:bg-orange-100"
                  >
                    {item.status === "ready" ? "Apply confirmed draft" : "Continue source review"} →
                  </Link>
                ))}
            </div>
          </div>
        </section>
      )}
      {error && (
        <div role="alert" className="error" tabIndex={-1}>
          {error}{" "}
          <button type="button" onClick={() => setError("")}>
            Dismiss
          </button>
          <button
            type="button"
            onClick={() => {
              if (detail && window.confirm("Discard local fields and load the saved version?"))
                void run(() => load(detail.id));
            }}
          >
            Reload saved version
          </button>
        </div>
      )}
      <p role="status" className="success">
        {message}
      </p>
      {milestone && (
        <div className="milestone row between">
          <div>
            <strong>Your menu is live.</strong>
            <p>Your printed QR stays the same. Changes are ready for guests.</p>
          </div>
          <Link className="action ember" href="/dashboard/qr-codes">
            Manage permanent QR codes
          </Link>
          <button type="button" onClick={() => setMilestone(false)}>
            Dismiss
          </button>
        </div>
      )}
      {!doc || !detail ? (
        <section className="panel quiet">
          <h2>Your first menu starts here</h2>
          <p>
            Create a draft, add your dishes and publish your permanent QR menu. Existing catalog
            dishes will be copied into your first draft.
          </p>
        </section>
      ) : (
        <>
          <div className="row between">
            <div className="row">
              <span className="badge">
                {detail.archived
                  ? "Archived"
                  : detail.publishedRevision
                    ? detail.revision > detail.publishedRevision
                      ? "Published · unpublished draft changes"
                      : "Published · draft editable"
                    : "Draft"}
              </span>
              <span className="badge">Revision {detail.revision}</span>
              <span className="badge">{dirty ? "Unsaved changes" : "Saved"}</span>
              {composerPending && (
                <span className="badge">Review selected dishes before saving or publishing</span>
              )}
            </div>
            <div className="row">
              <button type="button" onClick={() => setPreview(!preview)}>
                <Eye size={16} />
                {preview ? "Back to edit" : "Preview draft"}
              </button>
              <button
                type="button"
                className="ember"
                disabled={busy || !detail.canWrite || detail.archived || composerPending}
                onClick={() =>
                  void run(async () => {
                    await save();
                  })
                }
              >
                <Save size={16} />
                Save draft
              </button>
              <button
                type="button"
                className="ember ink-press"
                disabled={busy || !detail.canWrite || detail.archived || composerPending}
                onClick={() => dialog.current?.showModal()}
              >
                <Send size={16} />
                Publish menu
              </button>
            </div>
          </div>
          {!detail.canWrite && (
            <p className="error">
              This shared menu requires editing permission at every assigned outlet. You can browse
              its draft and use local overrides within your outlet scope.
            </p>
          )}
          <dialog ref={dialog} aria-labelledby="publish-title">
            <div className="stack">
              <span className="eyebrow">Ready for the table</span>
              <h2 id="publish-title">Publish this menu?</h2>
              <p>
                Saved changes will be visible at every assigned outlet. Unsaved fields are saved
                first. Your existing QR links stay unchanged.
              </p>
              <div className="row">
                <button type="button" onClick={() => dialog.current?.close()}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="ember ink-press"
                  disabled={busy}
                  onClick={() => {
                    dialog.current?.close();
                    void run(async () => {
                      const revision = dirty ? await save() : detail.revision;
                      await command("publish", {}, revision);
                      await load(detail.id);
                      setMilestone(true);
                      setMessage("Menu published");
                    });
                  }}
                >
                  Confirm publication
                </button>
              </div>
            </div>
          </dialog>
          <div className="studio-layout">
            <div className="stack">
              {preview ? (
                <PublicMenu
                  preview
                  initial={{
                    outlet: { ...outlet, versioned: true, isDemoData: false },
                    point: null,
                    catalogFingerprint: "",
                    now: new Date().toISOString(),
                    menus: [
                      {
                        id: detail.id,
                        revision: detail.revision,
                        document: doc,
                        brand: null,
                        overrides: [],
                      },
                    ],
                  }}
                />
              ) : (
                <>
                  <nav className="row" aria-label="Menu editor sections">
                    {["dishes", "schedule", "media", "assignments"].map((t) => (
                      <button
                        type="button"
                        key={t}
                        aria-pressed={tab === t}
                        className={tab === t ? "ember" : ""}
                        onClick={() => {
                          setTab(t);
                          if (t === "media") void run(refreshMedia);
                        }}
                      >
                        {t[0]!.toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </nav>
                  <form
                    key={`${detail.id}:${detail.revision}`}
                    ref={form}
                    className="stack"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void run(async () => {
                        await save();
                      });
                    }}
                  >
                    <fieldset
                      disabled={busy || !detail.canWrite || detail.archived}
                      className="stack"
                      style={{ minWidth: 0 }}
                    >
                      <Field
                        label="Menu name"
                        value={doc.name}
                        onChange={(name) => change({ ...doc, name })}
                      />
                      {tab === "dishes" && (
                        <>
                          <div className="stack" aria-label="Dish entry and menu filtering">
                            <div className="row" role="group" aria-label="Menu Studio dish tools">
                              <button
                                type="button"
                                className={composerMode === "add" ? "ember" : ""}
                                aria-pressed={composerMode === "add"}
                                onClick={() => {
                                  setComposerMode("add");
                                  setDishSearch("");
                                  setCategoryFilter("all");
                                  setComposerFocus((n) => n + 1);
                                }}
                              >
                                + Add dishes
                              </button>
                              <button
                                type="button"
                                className={composerMode === "find" ? "ember" : ""}
                                aria-pressed={composerMode === "find"}
                                onClick={() => setComposerMode("find")}
                              >
                                Find in menu
                              </button>
                            </div>
                            <div hidden={composerMode !== "add"}>
                              <SmartDishComposer
                                key={detail.id + ":" + composerFocus}
                                doc={doc}
                                outletId={outlet.id}
                                menuId={detail.id}
                                media={media}
                                organization={organizationDishes}
                                defaultCategoryId={composerCategory}
                                focusRequest={composerFocus}
                                selection={composerSelection}
                                setSelection={setComposerSelection}
                                onAdd={addQuickDishes}
                                onPendingChange={setComposerPending}
                              />
                            </div>
                            {composerMode === "find" && (
                              <div className="panel stack">
                                <label className="field">
                                  Find a dish or section
                                  <input
                                    aria-label="Find a dish or section"
                                    type="search"
                                    value={dishSearch}
                                    onChange={(e) => setDishSearch(e.target.value)}
                                    placeholder="Filter names and descriptions"
                                  />
                                </label>
                                <p className="quiet">
                                  Filtering only changes this view, never the saved menu.
                                </p>
                                <nav aria-label="Jump to menu section" className="row">
                                  <button
                                    type="button"
                                    aria-pressed={categoryFilter === "all"}
                                    onClick={() => setCategoryFilter("all")}
                                  >
                                    All sections
                                  </button>
                                  {doc.categories.map((cat) => (
                                    <button
                                      key={cat.id}
                                      type="button"
                                      aria-pressed={categoryFilter === cat.id}
                                      onClick={() => setCategoryFilter(cat.id)}
                                    >
                                      {cat.name} · {cat.items.length}
                                    </button>
                                  ))}
                                </nav>
                              </div>
                            )}
                          </div>
                          <div className="row between">
                            <h2>Sections & dishes</h2>
                            <button
                              type="button"
                              onClick={() =>
                                change({
                                  ...doc,
                                  categories: [
                                    ...doc.categories,
                                    {
                                      id: id(),
                                      name: "New section",
                                      description: "",
                                      archived: false,
                                      items: [],
                                    },
                                  ],
                                })
                              }
                            >
                              <Plus size={16} />
                              Add category
                            </button>
                          </div>
                          {doc.categories
                            .map((c, ci) => ({ c, ci }))
                            .filter(
                              ({ c }) =>
                                (categoryFilter === "all" || categoryFilter === c.id) &&
                                (!dishSearch.trim() ||
                                  [
                                    c.name,
                                    c.description,
                                    ...c.items.flatMap((d) => [d.name, d.description]),
                                  ].some((value) =>
                                    value
                                      .toLocaleLowerCase()
                                      .includes(dishSearch.trim().toLocaleLowerCase())
                                  ))
                            )
                            .map(({ c, ci }) => (
                              <section
                                key={c.id}
                                className="panel stack rounded-2xl border border-stone-200 bg-white shadow-sm"
                              >
                                <div className="row between">
                                  <span className="eyebrow">Section {ci + 1}</span>
                                  <div className="row">
                                    <button
                                      type="button"
                                      aria-label={`Move ${c.name} up`}
                                      onClick={() => move(ci, -1)}
                                    >
                                      <ArrowUp size={16} />
                                    </button>
                                    <button
                                      type="button"
                                      aria-label={`Move ${c.name} down`}
                                      onClick={() => move(ci, 1)}
                                    >
                                      <ArrowDown size={16} />
                                    </button>
                                    <label>
                                      <input
                                        type="checkbox"
                                        checked={c.archived}
                                        onChange={(e) =>
                                          updateCategory(ci, (c) => ({
                                            ...c,
                                            archived: e.target.checked,
                                          }))
                                        }
                                      />
                                      Archive section
                                    </label>
                                  </div>
                                </div>
                                <Field
                                  label={`Category name ${ci + 1}`}
                                  value={c.name}
                                  onChange={(name) => updateCategory(ci, (c) => ({ ...c, name }))}
                                />
                                <label className="field">
                                  Section description
                                  <textarea
                                    value={c.description}
                                    onChange={(e) =>
                                      updateCategory(ci, (c) => ({
                                        ...c,
                                        description: e.target.value,
                                      }))
                                    }
                                  />
                                </label>
                                {c.items
                                  .map((dish, di) => ({ dish, di }))
                                  .filter(
                                    ({ dish }) =>
                                      !dishSearch.trim() ||
                                      [c.name, c.description, dish.name, dish.description].some(
                                        (value) =>
                                          value
                                            .toLocaleLowerCase()
                                            .includes(dishSearch.trim().toLocaleLowerCase())
                                      )
                                  )
                                  .map(({ dish, di }) => (
                                    <div className="dish-editor stack" key={dish.id}>
                                      {detail.canWrite &&
                                        dish.mediaId &&
                                        media.some(
                                          (m) =>
                                            m.id === dish.mediaId &&
                                            m.status === "ready" &&
                                            m.approvedAt
                                        ) && (
                                          // eslint-disable-next-line @next/next/no-img-element
                                          <img
                                            src={"/api/media/" + encodeURIComponent(dish.mediaId)}
                                            alt={"Uploaded photograph for " + dish.name}
                                            width={104}
                                            height={84}
                                            style={{
                                              width: 104,
                                              height: 84,
                                              objectFit: "cover",
                                              borderRadius: 10,
                                            }}
                                          />
                                        )}
                                      <div className="row between">
                                        <span className="eyebrow">Dish {di + 1}</span>
                                        <div
                                          className="row"
                                          aria-label={`Reorder ${dish.name || "untitled dish"}`}
                                        >
                                          <button
                                            type="button"
                                            aria-label={`Move dish ${di + 1} up`}
                                            disabled={di === 0}
                                            onClick={() => moveDish(ci, di, -1)}
                                          >
                                            <ArrowUp size={16} aria-hidden="true" />
                                          </button>
                                          <button
                                            type="button"
                                            aria-label={`Move dish ${di + 1} down`}
                                            disabled={di === c.items.length - 1}
                                            onClick={() => moveDish(ci, di, 1)}
                                          >
                                            <ArrowDown size={16} aria-hidden="true" />
                                          </button>
                                        </div>
                                      </div>
                                      <div className="columns">
                                        <Field
                                          label={`Dish name ${ci + 1}.${di + 1}`}
                                          value={dish.name}
                                          onChange={(name) => updateDish(ci, di, { name })}
                                        />
                                        <Money
                                          label={`Dish price ${ci + 1}.${di + 1}`}
                                          value={dish.priceMinor}
                                          currency={doc.currency}
                                          onChange={(priceMinor) =>
                                            updateDish(ci, di, { priceMinor })
                                          }
                                        />
                                      </div>
                                      <label className="field">
                                        Description
                                        <textarea
                                          value={dish.description}
                                          onChange={(e) =>
                                            updateDish(ci, di, { description: e.target.value })
                                          }
                                          maxLength={1000}
                                        />
                                      </label>
                                      <div className="row">
                                        <label>
                                          <input
                                            type="checkbox"
                                            checked={dish.soldOut}
                                            onChange={(e) =>
                                              updateDish(ci, di, { soldOut: e.target.checked })
                                            }
                                          />
                                          Sold out
                                        </label>
                                        <label>
                                          <input
                                            type="checkbox"
                                            checked={dish.archived}
                                            onChange={(e) =>
                                              updateDish(ci, di, { archived: e.target.checked })
                                            }
                                          />
                                          Archived dish
                                        </label>
                                        {(["vegetarian", "vegan", "gluten_free"] as const).map(
                                          (d) => (
                                            <label key={d}>
                                              <input
                                                type="checkbox"
                                                checked={dish.dietary.includes(d)}
                                                onChange={(e) =>
                                                  updateDish(ci, di, {
                                                    dietary: e.target.checked
                                                      ? [...dish.dietary, d]
                                                      : dish.dietary.filter((x) => x !== d),
                                                  })
                                                }
                                              />
                                              {d.replaceAll("_", " ")}
                                            </label>
                                          )
                                        )}
                                      </div>
                                      <label className="field">
                                        Dish photo
                                        <select
                                          aria-label={`Dish photo ${ci + 1}.${di + 1}`}
                                          value={dish.mediaId ?? ""}
                                          onChange={(e) =>
                                            updateDish(ci, di, { mediaId: e.target.value || null })
                                          }
                                        >
                                          <option value="">Local illustration</option>
                                          {dish.mediaId &&
                                            !media.some((a) => a.id === dish.mediaId) && (
                                              <option value={dish.mediaId}>
                                                Current approved photo
                                              </option>
                                            )}
                                          {media
                                            .filter((a) => a.status === "ready" && a.approvedAt)
                                            .map((a, n) => (
                                              <option key={a.id} value={a.id}>
                                                Approved photo {n + 1}
                                              </option>
                                            ))}
                                        </select>
                                      </label>
                                      <details>
                                        <summary>Variants & add-ons</summary>
                                        <div className="stack">
                                          {dish.variants.map((v, vi) => (
                                            <div className="columns" key={v.id}>
                                              <Field
                                                label={`Variant name ${vi + 1}`}
                                                value={v.name}
                                                onChange={(name) =>
                                                  updateDish(ci, di, {
                                                    variants: dish.variants.map((x, n) =>
                                                      n === vi ? { ...x, name } : x
                                                    ),
                                                  })
                                                }
                                              />
                                              <Money
                                                label={`Variant price ${vi + 1}`}
                                                value={v.priceMinor}
                                                currency={doc.currency}
                                                onChange={(priceMinor) =>
                                                  updateDish(ci, di, {
                                                    variants: dish.variants.map((x, n) =>
                                                      n === vi ? { ...x, priceMinor } : x
                                                    ),
                                                  })
                                                }
                                              />
                                              <label>
                                                <input
                                                  type="checkbox"
                                                  checked={v.isAvailable}
                                                  onChange={(e) =>
                                                    updateDish(ci, di, {
                                                      variants: dish.variants.map((x, n) =>
                                                        n === vi
                                                          ? { ...x, isAvailable: e.target.checked }
                                                          : x
                                                      ),
                                                    })
                                                  }
                                                />
                                                Available
                                              </label>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  updateDish(ci, di, {
                                                    variants: dish.variants.filter(
                                                      (_, n) => n !== vi
                                                    ),
                                                  })
                                                }
                                              >
                                                Remove variant
                                              </button>
                                            </div>
                                          ))}
                                          <button
                                            type="button"
                                            onClick={() =>
                                              updateDish(ci, di, {
                                                variants: [
                                                  ...dish.variants,
                                                  {
                                                    id: id(),
                                                    name: "New variant",
                                                    priceMinor: dish.priceMinor,
                                                    isAvailable: true,
                                                  },
                                                ],
                                              })
                                            }
                                          >
                                            Add variant
                                          </button>
                                          {dish.addOnGroups.map((g, gi) => {
                                            const updateGroup = (patch: Partial<typeof g>) =>
                                              updateDish(ci, di, {
                                                addOnGroups: dish.addOnGroups.map((x, n) =>
                                                  n === gi ? { ...x, ...patch } : x
                                                ),
                                              });
                                            return (
                                              <div key={g.id} className="panel stack">
                                                <Field
                                                  label={`Add-on group ${gi + 1}`}
                                                  value={g.name}
                                                  onChange={(name) => updateGroup({ name })}
                                                />
                                                <div className="columns">
                                                  <label className="field">
                                                    Minimum selections
                                                    <input
                                                      type="number"
                                                      min={0}
                                                      value={g.min}
                                                      onChange={(e) =>
                                                        updateGroup({ min: Number(e.target.value) })
                                                      }
                                                    />
                                                  </label>
                                                  <label className="field">
                                                    Maximum selections
                                                    <input
                                                      type="number"
                                                      min={1}
                                                      value={g.max}
                                                      onChange={(e) =>
                                                        updateGroup({ max: Number(e.target.value) })
                                                      }
                                                    />
                                                  </label>
                                                </div>
                                                {g.options.map((o, oi) => (
                                                  <div className="columns" key={o.id}>
                                                    <Field
                                                      label={`Add-on name ${oi + 1}`}
                                                      value={o.name}
                                                      onChange={(name) =>
                                                        updateGroup({
                                                          options: g.options.map((x, n) =>
                                                            n === oi ? { ...x, name } : x
                                                          ),
                                                        })
                                                      }
                                                    />
                                                    <Money
                                                      label={`Add-on price ${oi + 1}`}
                                                      value={o.priceMinor}
                                                      currency={doc.currency}
                                                      onChange={(priceMinor) =>
                                                        updateGroup({
                                                          options: g.options.map((x, n) =>
                                                            n === oi ? { ...x, priceMinor } : x
                                                          ),
                                                        })
                                                      }
                                                    />
                                                    <label>
                                                      <input
                                                        type="checkbox"
                                                        checked={o.isAvailable}
                                                        onChange={(e) =>
                                                          updateGroup({
                                                            options: g.options.map((item, n) =>
                                                              n === oi
                                                                ? {
                                                                    ...item,
                                                                    isAvailable: e.target.checked,
                                                                  }
                                                                : item
                                                            ),
                                                          })
                                                        }
                                                      />
                                                      Available
                                                    </label>
                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        updateGroup({
                                                          options: g.options.filter(
                                                            (_, n) => n !== oi
                                                          ),
                                                        })
                                                      }
                                                    >
                                                      Remove add-on
                                                    </button>
                                                  </div>
                                                ))}
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    updateGroup({
                                                      options: [
                                                        ...g.options,
                                                        {
                                                          id: id(),
                                                          name: "New option",
                                                          priceMinor: 0,
                                                          isAvailable: true,
                                                        },
                                                      ],
                                                    })
                                                  }
                                                >
                                                  Add option
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    updateDish(ci, di, {
                                                      addOnGroups: dish.addOnGroups.filter(
                                                        (_, n) => n !== gi
                                                      ),
                                                    })
                                                  }
                                                >
                                                  Remove add-on group
                                                </button>
                                              </div>
                                            );
                                          })}
                                          <button
                                            type="button"
                                            onClick={() =>
                                              updateDish(ci, di, {
                                                addOnGroups: [
                                                  ...dish.addOnGroups,
                                                  {
                                                    id: id(),
                                                    name: "Extras",
                                                    min: 0,
                                                    max: 1,
                                                    options: [
                                                      {
                                                        id: id(),
                                                        name: "New option",
                                                        priceMinor: 0,
                                                        isAvailable: true,
                                                      },
                                                    ],
                                                  },
                                                ],
                                              })
                                            }
                                          >
                                            Add add-on group
                                          </button>
                                        </div>
                                      </details>
                                      <details>
                                        <summary>Dish schedule</summary>
                                        <ScheduleEditor
                                          value={dish.schedule}
                                          onChange={(schedule) => updateDish(ci, di, { schedule })}
                                        />
                                      </details>
                                    </div>
                                  ))}
                                <button
                                  type="button"
                                  className="ember"
                                  onClick={() => openComposer(c.id)}
                                >
                                  <Plus size={16} /> Add dish
                                </button>
                              </section>
                            ))}
                        </>
                      )}
                      {tab === "schedule" && (
                        <section className="panel stack">
                          <h2>Menu service schedule</h2>
                          <ScheduleEditor
                            value={doc.schedule}
                            onChange={(schedule) => change({ ...doc, schedule })}
                          />
                        </section>
                      )}
                    </fieldset>
                  </form>
                  {tab === "media" && (
                    <section className="panel stack">
                      <h2>Dish photography</h2>
                      <p>
                        Upload your own JPEG, PNG or WebP (up to 5 MiB / 10 megapixels). Photos stay
                        private until processed, approved and published.
                      </p>
                      <form
                        className="stack"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const f = new FormData(e.currentTarget);
                          const file = f.get("photo");
                          void run(async () => {
                            if (!(file instanceof File) || !file.size) {
                              throw new Error("Choose a JPEG, PNG or WebP photograph.");
                            }
                            if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
                              throw new Error("Use a JPEG, PNG or WebP photograph.");
                            }
                            if (file.size > 5 * 1024 * 1024) {
                              throw new Error("Photo exceeds 5 MiB. Choose a smaller file.");
                            }
                            await json("/api/media", {
                              method: "POST",
                              headers: {
                                "x-outlet-id": outlet.id,
                                "content-type": file.type,
                                "x-media-rights": encodeURIComponent(String(f.get("rights"))),
                              },
                              body: file,
                            });
                            await refreshMedia();
                            setMessage(
                              "Photo queued privately. Refresh after processing to review it."
                            );
                          });
                        }}
                      >
                        <label className="field">
                          Dish photograph
                          <input
                            type="file"
                            name="photo"
                            accept="image/jpeg,image/png,image/webp"
                            required
                          />
                        </label>
                        <label className="field">
                          Rights or source confirmation
                          <input
                            name="rights"
                            placeholder="I own this restaurant photograph"
                            minLength={5}
                            maxLength={500}
                            required
                          />
                        </label>
                        <button className="ember" disabled={busy}>
                          <ImagePlus size={16} />
                          Upload photo
                        </button>
                      </form>
                      <button type="button" onClick={() => void run(refreshMedia)}>
                        Refresh photo status
                      </button>
                      {media.map((a) => (
                        <div key={a.id} className="panel stack">
                          <strong>
                            {a.status === "ready"
                              ? "Ready for review"
                              : a.status === "failed"
                                ? "Photo processing failed"
                                : "Processing photo"}
                          </strong>

                          <p>
                            {a.approvedAt
                              ? "Approved for selection in Menu Studio. Publish the draft to update the guest view."
                              : a.status === "ready"
                                ? "Private preview only. Approval does not publish your menu."
                                : "The existing guest menu and photographs are unchanged."}
                          </p>
                          {a.lastError && <p role="status">{a.lastError}</p>}
                          {a.status === "ready" && (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={`/api/media/${a.id}`}
                                alt="Uploaded dish preview"
                                width={240}
                                height={180}
                                style={{ objectFit: "contain" }}
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  void run(async () => {
                                    await json(`/api/media/${a.id}`, {
                                      method: "PATCH",
                                      headers,
                                      body: JSON.stringify({
                                        action: a.approvedAt ? "unapprove" : "approve",
                                      }),
                                    });
                                    await refreshMedia();
                                    setMessage(
                                      a.approvedAt
                                        ? "Photo approval removed"
                                        : "Photo approved. Choose it in a dish’s photo selector, then publish."
                                    );
                                  })
                                }
                              >
                                {a.approvedAt ? "Remove approval" : "Approve photo"}
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                    </section>
                  )}
                  {tab === "assignments" && (
                    <section className="panel stack">
                      <h2>Shared outlets & local changes</h2>
                      <p>
                        Assign this menu to another outlet with the same currency. Brand assignments
                        must use an existing brand–outlet link. You need editing permission at all
                        shared outlets.
                      </p>
                      <form
                        className="stack"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const f = new FormData(e.currentTarget);
                          void run(async () => {
                            await command("assign", {
                              outletId: f.get("outletId"),
                              brandId: f.get("brandId") || null,
                              assigned: f.get("assigned") === "on",
                            });
                            await load(detail.id);
                            setMessage("Menu assignment saved");
                          });
                        }}
                      >
                        <label className="field">
                          Outlet
                          <select name="outletId" required>
                            {outletChoices.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.name} ({o.currency})
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="field">
                          Brand (optional)
                          <select name="brandId">
                            <option value="">No brand</option>
                            {brandChoices.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <input type="checkbox" name="assigned" defaultChecked />
                          Assigned to this outlet
                        </label>
                        <button type="submit" disabled={busy || !detail.canWrite}>
                          Save assignment
                        </button>
                      </form>
                      <ul>
                        {detail.assignments.map((a) => (
                          <li
                            key={
                              outletChoices.find((o) => o.id === a.outletId)?.name ??
                              "Assigned outlet"
                            }
                          >
                            {outletChoices.find((o) => o.id === a.outletId)?.name ??
                              "Assigned outlet"}
                            {a.brandId
                              ? ` · ${brandChoices.find((b) => b.id === a.brandId)?.name ?? "Brand"}`
                              : ""}
                          </li>
                        ))}
                      </ul>
                      <h3>Local price / sold-out override</h3>
                      <p>
                        Local prices apply to dishes without variants. For dishes with variants,
                        leave price blank and edit shared variant prices in Dishes. Clear local
                        prices before adding variants.
                      </p>
                      <form
                        className="stack"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const f = new FormData(e.currentTarget);
                          void run(async () => {
                            const amount = String(f.get("price"));
                            await command("override", {
                              outletId: outlet.id,
                              dishId: f.get("dishId"),
                              priceMinor: amount ? displayToMinor(amount, doc.currency) : null,
                              soldOut:
                                f.get("availability") === "inherit"
                                  ? null
                                  : f.get("availability") === "soldout",
                            });
                            await load(detail.id);
                            setMessage("Local override saved");
                          });
                        }}
                      >
                        <label className="field">
                          Dish
                          <select name="dishId">
                            {doc.categories.flatMap((c) =>
                              c.items.map((i) => (
                                <option key={i.id} value={i.id}>
                                  {i.name}
                                </option>
                              ))
                            )}
                          </select>
                        </label>
                        <label className="field">
                          Local price ({doc.currency}; blank inherits)
                          <input name="price" inputMode="decimal" />
                        </label>
                        <label className="field">
                          Local availability
                          <select name="availability">
                            <option value="inherit">Inherit menu</option>
                            <option value="soldout">Sold out</option>
                            <option value="available">Available</option>
                          </select>
                        </label>
                        <button disabled={busy}>Save local override</button>
                      </form>
                      <div className="row">
                        {(["unpublish", "archive", "restore"] as const).map((action) => (
                          <button
                            type="button"
                            key={action}
                            disabled={busy || !detail.canWrite}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `${action} this menu? Printed QR links are retained.`
                                )
                              )
                                void run(async () => {
                                  await command(action);
                                  await load(detail.id);
                                  setMessage(`Menu ${action} completed`);
                                });
                            }}
                          >
                            {action[0]!.toUpperCase() + action.slice(1)} menu
                          </button>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}
            </div>
            <aside
              className="preview-phone no-print rounded-3xl border border-stone-200 bg-white p-5 shadow-sm"
              aria-label="Integrated private draft preview"
            >
              <span className="eyebrow">Private draft preview · Menu Studio 2.0</span>
              <p className="mt-2 rounded-lg bg-orange-50 p-2 text-xs font-semibold text-orange-900">
                Updates as you edit. Guests only see the last explicitly published revision.
              </p>
              <h2>{doc.name}</h2>
              <small>
                {outlet.currency} · {outlet.timezone}
              </small>
              {doc.categories
                .filter((c) => !c.archived)
                .map((c) => (
                  <section key={c.id}>
                    <h3 style={{ marginTop: "1rem" }}>{c.name}</h3>
                    {c.items
                      .filter((i) => !i.archived)
                      .map((i) => (
                        <p key={i.id} style={{ marginTop: ".7rem" }}>
                          <strong>{i.name || "Untitled dish"}</strong> ·{" "}
                          {(i.priceMinor / 10 ** (currencyExponent(doc.currency) ?? 2)).toFixed(
                            currencyExponent(doc.currency) ?? 2
                          )}{" "}
                          {doc.currency}
                          {i.soldOut ? " · Sold Out" : ""}
                        </p>
                      ))}
                  </section>
                ))}
              <p style={{ marginTop: "1rem" }}>
                Preview only. Guests see your last published version.
              </p>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
