"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Plus, ArrowUp, ArrowDown, Trash2, ArchiveRestore, EyeOff, X } from "lucide-react";
import { artworkById } from "@/modules/menu-product/dish-artwork";
import { covers, type CoverPreset } from "@/modules/menu-product/public-presentation";
import { SmartDishComposer, type QuickDish } from "./smart-dish-composer";
import {
  findDishDuplicate,
  normalizeDishText,
  type OrganizationDish,
} from "@/modules/menu-product/dish-intelligence";
import { menuDocumentSchema, type MenuDocument } from "@/modules/menu-product/contracts";
import { displayToMinor } from "@/lib/money";
import { Field } from "./studio-fields";
import { StudioDishEditor } from "./studio-dish-editor";
import { StudioMediaTab, StudioAssignmentsTab } from "./studio-resources";
import {
  StudioHero,
  StudioOverview,
  StudioImportNotice,
  StudioActions,
  StudioEmpty,
  StudioMilestone,
  StudioPreview,
} from "./studio-chrome";
import type { menuDetail } from "@/modules/menu-product/service";
import { PublicMenu } from "./public-menu";
import { ScheduleEditor } from "./schedule-editor";
type Detail = Awaited<ReturnType<typeof menuDetail>>;
type Media = { id: string; status: string; approvedAt: string | null; lastError: string | null };
const id = () => crypto.randomUUID();
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
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [lifecycleAction, setLifecycleAction] = useState<"archive" | "unpublish" | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [media, setMedia] = useState<Media[]>(initialMedia);
  const [milestone, setMilestone] = useState(false);
  const selected = useRef(initialDetail?.id ?? "");
  const running = useRef(false);
  const creationKey = useRef(id());
  const commandRetry = useRef({ signature: "", key: "" });
  const form = useRef<HTMLFormElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const lifecycleDialog = useRef<HTMLDialogElement>(null);
  const previewDialog = useRef<HTMLDialogElement>(null);
  const headers = { "content-type": "application/json", "x-outlet-id": outlet.id };
  const path = (menuId: string) => `/api/catalog/${menuId}`;
  useEffect(() => {
    if (!dirty && !composerPending) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, composerPending]);
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
    const body = await r.json().catch(() => ({}));
    if (!r.ok)
      throw new Error(
        typeof body.message === "string"
          ? body.message
          : "Request failed. Your local draft fields are preserved; check the saved version before retrying."
      );
    return body;
  }
  async function load(menuId: string) {
    const changedMenu = selected.current !== menuId;
    selected.current = menuId;
    setError("");
    let next;
    try {
      next = await json(path(menuId));
    } catch (cause) {
      if (selected.current === menuId) selected.current = changedMenu ? (detail?.id ?? "") : menuId;
      throw cause;
    }
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
    if (changedMenu) {
      previewDialog.current?.close();
      setPreview(false);
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
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      running.current = false;
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
      const art = artworkById(item.artworkId);
      category.items.push({
        id: id(),
        name: item.name.trim(),
        description: "",
        priceMinor,
        soldOut: false,
        archived: false,
        mediaId: photo,
        artworkId: art?.id ?? null,
        imageMode:
          item.imageMode === "photo" && photo
            ? "photo"
            : item.imageMode === "artwork" && art
              ? "artwork"
              : "none",
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
    <div className="product studio-atelier" data-testid="recipe-atelier-studio">
      <StudioHero outlet={outlet} />
      <div className="atelier-body">
        <div className="atelier-menu-bar">
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
              <optgroup label="Active menus">
                {list
                  .filter((m) => !m.archived)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {(m.document as MenuDocument).name}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Recently deleted · recoverable">
                {list
                  .filter((m) => m.archived)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {(m.document as MenuDocument).name} (deleted)
                    </option>
                  ))}
              </optgroup>
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
          {detail && (
            <details className="atelier-menu-actions">
              <summary aria-label="Menu actions" aria-haspopup="true">
                Menu actions
              </summary>
              <div className="atelier-menu-actions-list">
                {detail.archived ? (
                  <button
                    type="button"
                    disabled={busy || !detail.canWrite}
                    onClick={() =>
                      void run(async () => {
                        await command("restore");
                        setList(await json("/api/catalog"));
                        await load(detail.id);
                        setMessage("Menu restored as an unpublished draft.");
                      })
                    }
                  >
                    <ArchiveRestore size={16} /> Restore menu
                  </button>
                ) : (
                  <>
                    {detail.publishedRevision && (
                      <button
                        type="button"
                        disabled={busy || !detail.canWrite}
                        onClick={() => {
                          setLifecycleAction("unpublish");
                          setConfirmName("");
                          lifecycleDialog.current?.showModal();
                        }}
                      >
                        <EyeOff size={16} /> Unpublish menu
                      </button>
                    )}
                    <button
                      type="button"
                      className="atelier-danger"
                      disabled={busy || !detail.canWrite}
                      onClick={() => {
                        setLifecycleAction("archive");
                        setConfirmName("");
                        lifecycleDialog.current?.showModal();
                      }}
                    >
                      <Trash2 size={16} /> Delete menu
                    </button>
                  </>
                )}
              </div>
            </details>
          )}
        </div>
        <dialog
          ref={lifecycleDialog}
          className="atelier-lifecycle-dialog"
          aria-labelledby="atelier-lifecycle-title"
          onClose={() => setLifecycleAction(null)}
        >
          {detail && lifecycleAction && (
            <form
              method="dialog"
              className="stack"
              onSubmit={(event) => {
                event.preventDefault();
                if (lifecycleAction === "archive" && confirmName !== doc?.name) return;
                const action = lifecycleAction;
                lifecycleDialog.current?.close();
                void run(async () => {
                  await command(action);
                  const next = await json("/api/catalog");
                  setList(next);
                  await load(detail.id);
                  setMessage(
                    action === "archive"
                      ? "Menu deleted from active menus. Restore it from Menu actions."
                      : "Menu unpublished. Historical releases were retained."
                  );
                });
              }}
            >
              <span className="atelier-eyebrow">MENU LIFECYCLE</span>
              <h2 id="atelier-lifecycle-title">
                {lifecycleAction === "archive" ? "Delete this menu?" : "Take this menu offline?"}
              </h2>
              <p>
                {lifecycleAction === "archive"
                  ? "The menu will be removed from your active workspace and unpublished. It remains recoverable; historical orders and financial records are preserved."
                  : "The current public release will be taken offline. Its saved draft and publication history remain available."}
              </p>
              <p className="atelier-lifecycle-warning">
                This menu is assigned to {detail.assignments.length}{" "}
                {detail.assignments.length === 1 ? "outlet" : "outlets"}. Existing QR identities are
                retained, but this menu will stop being shown to guests. Other live menus, if any,
                remain available. Any unsaved local changes will be discarded.
              </p>
              {lifecycleAction === "archive" && (
                <label className="field">
                  Type <strong>{doc?.name}</strong> to confirm deletion
                  <input
                    autoComplete="off"
                    value={confirmName}
                    onChange={(event) => setConfirmName(event.target.value)}
                  />
                </label>
              )}
              <div className="row">
                <button type="button" onClick={() => lifecycleDialog.current?.close()}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ember ink-press"
                  disabled={busy || (lifecycleAction === "archive" && confirmName !== doc?.name)}
                >
                  {lifecycleAction === "archive" ? "Delete menu" : "Unpublish menu"}
                </button>
              </div>
            </form>
          )}
        </dialog>
        <StudioOverview
          archived={detail?.archived ?? false}
          everPublished={detail?.everPublished ?? false}
          outletName={outlet.name}
          doc={doc}
          imports={imports}
          publishedRevision={detail?.publishedRevision}
          revision={detail?.revision}
          dirty={dirty}
        />
        <StudioImportNotice imports={imports} />
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
        {milestone && <StudioMilestone dismiss={() => setMilestone(false)} />}
        {!doc || !detail ? (
          <StudioEmpty />
        ) : (
          <>
            <StudioActions
              archived={detail.archived}
              writable={detail.canWrite}
              busy={busy}
              pending={composerPending}
              dirty={dirty}
              revision={detail.revision}
              publishedRevision={detail.publishedRevision}
              preview={preview}
              onPreview={() => {
                if (previewDialog.current?.open) previewDialog.current.close();
                else {
                  setPreview(true);
                  setPreviewDevice("desktop");
                  previewDialog.current?.showModal();
                }
              }}
              onSave={() =>
                void run(async () => {
                  await save();
                })
              }
              onPublish={() => dialog.current?.showModal()}
            />
            {!detail.canWrite && (
              <p className="error">
                This shared menu requires editing permission at every assigned outlet. You can
                browse its draft and use local overrides within your outlet scope.
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
            <div className="atelier-workspace studio-layout">
              <div className="atelier-editor stack">
                <nav className="atelier-editor-tabs row" aria-label="Menu editor sections">
                  {["dishes", "storefront", "schedule", "media", "assignments"].map((t) => (
                    <button
                      type="button"
                      key={t}
                      aria-pressed={tab === t}
                      className={tab === t ? "ember" : ""}
                      onClick={() => {
                        if (t !== tab && form.current && !form.current.reportValidity()) {
                          setError(
                            "Check the highlighted fields before switching editor sections."
                          );
                          return;
                        }
                        setError("");
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
                        <div
                          className="atelier-composer stack"
                          aria-label="Dish entry and menu filtering"
                        >
                          <div className="atelier-composer-head">
                            <div>
                              <span className="atelier-eyebrow">SMART COMPOSER</span>
                              <h2>Add something delicious.</h2>
                              <p className="quiet">
                                Find a familiar dish or create your own. Nothing is published
                                automatically.
                              </p>
                            </div>
                            <Image
                              src="/brand/menu-studio/recipe-atelier/dish-workspace-illustration.webp"
                              alt=""
                              width={120}
                              height={88}
                            />
                          </div>
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
                            <div className="atelier-filter-panel stack">
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
                            </div>
                          )}
                        </div>
                        <nav
                          aria-label="Filter menu sections"
                          className="atelier-section-filter row"
                        >
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
                              {cat.name}
                              {cat.archived ? " (archived)" : ""} ·{" "}
                              {cat.items.filter((item) => !item.archived).length}
                            </button>
                          ))}
                        </nav>
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
                            <section key={c.id} className="atelier-menu-section panel stack">
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
                                  <StudioDishEditor
                                    key={dish.id}
                                    dish={dish}
                                    ci={ci}
                                    di={di}
                                    dishCount={c.items.length}
                                    canWrite={detail.canWrite}
                                    currency={doc.currency}
                                    media={media}
                                    onUpdate={(patch) => updateDish(ci, di, patch)}
                                    onMove={(delta) => moveDish(ci, di, delta)}
                                  />
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
                    {tab === "storefront" && (
                      <section className="panel stack dining-studio-controls" aria-labelledby="storefront-title">
                        <span className="eyebrow">THE DINING CANVAS</span>
                        <h2 id="storefront-title">Your guest storefront</h2>
                        <p>Choose an illustrated cover, introduce your restaurant, and handpick dishes to feature. These settings follow the saved draft and become public only after you publish.</p>
                        <fieldset className="dining-cover-picker">
                          <legend>Restaurant cover</legend>
                          <div className="dining-cover-options">
                            {(Object.entries(covers) as [CoverPreset, string][]).map(([key, src]) => (
                              <label key={key} className={ (doc.presentation?.cover ?? "indian-restaurant") === key ? "is-selected" : "" }>
                                <input type="radio" name="cover-preset" checked={(doc.presentation?.cover ?? "indian-restaurant") === key} onChange={() => change({ ...doc, presentation: { cover: key, headline: doc.presentation?.headline ?? "", featuredDishIds: doc.presentation?.featuredDishIds ?? [] } })} />
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={src} alt="" width={290} height={100} loading="lazy" />
                                <span>{key.replaceAll("-", " ")}</span>
                              </label>
                            ))}
                          </div>
                        </fieldset>
                        <label className="field">
                          Hero introduction <small className="quiet">Optional · 110 characters maximum</small>
                          <input type="text" maxLength={110} value={doc.presentation?.headline ?? ""}
                            placeholder="Made with care. Served with joy."
                            onChange={(event) => change({ ...doc, presentation: { cover: doc.presentation?.cover ?? "indian-restaurant", headline: event.target.value, featuredDishIds: doc.presentation?.featuredDishIds ?? [] } })} />
                        </label>
                        <fieldset className="dining-feature-picker">
                          <legend>Feature up to eight dishes</legend>
                          <p>These selections power the featured section and complementary order suggestions. No best-seller, discount or dietary claims are inferred.</p>
                          <div className="dining-feature-options">
                            {doc.categories.filter((category) => !category.archived).flatMap((category) =>
                              category.items.filter((dish) => !dish.archived).map((dish) => {
                                const featured = doc.presentation?.featuredDishIds ?? [];
                                const selected = featured.includes(dish.id);
                                return (
                                  <label key={dish.id}>
                                    <input type="checkbox" checked={selected}
                                      disabled={!selected && featured.length >= 8}
                                      onChange={() => change({ ...doc, presentation: {
                                        cover: doc.presentation?.cover ?? "indian-restaurant",
                                        headline: doc.presentation?.headline ?? "",
                                        featuredDishIds: selected ? featured.filter((id) => id !== dish.id) : [...featured, dish.id],
                                      } })} />
                                    <span>{dish.name}</span>
                                    {dish.soldOut && <small>Sold out · hidden from public highlights</small>}
                                  </label>
                                );
                              })
                            )}
                          </div>
                        </fieldset>
                        <p className="quiet">Preview draft uses this very same guest component and current unsaved data. Published QR menus continue to show the last explicitly published release.</p>
                      </section>
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
                  <StudioMediaTab
                    media={media}
                    outletId={outlet.id}
                    busy={busy}
                    run={run}
                    json={json}
                    refreshMedia={refreshMedia}
                    setMessage={setMessage}
                  />
                )}
                {tab === "assignments" && (
                  <div className="atelier-assignment-workspace">
                    {(dirty || composerPending) && (
                      <p role="status" className="atelier-assignment-warning">
                        Save your draft and review queued Composer dishes before changing
                        shared-menu assignments or local overrides.
                      </p>
                    )}
                    <fieldset
                      className="atelier-assignment-lock"
                      disabled={dirty || composerPending}
                    >
                      <StudioAssignmentsTab
                        doc={doc}
                        detail={detail}
                        outletId={outlet.id}
                        outletChoices={outletChoices}
                        brandChoices={brandChoices}
                        busy={busy}
                        run={run}
                        command={command}
                        load={load}
                        setMessage={setMessage}
                      />
                    </fieldset>
                  </div>
                )}
              </div>
              {!preview && (
                <StudioPreview doc={doc} currency={outlet.currency} timezone={outlet.timezone} />
              )}
            </div>
            <dialog
              ref={previewDialog}
              className="atelier-preview-dialog"
              aria-labelledby="atelier-preview-title"
              onClose={() => setPreview(false)}
            >
              <div className="atelier-preview-dialog-head">
                <div>
                  <span className="atelier-eyebrow">PRIVATE DRAFT PREVIEW</span>
                  <h2 id="atelier-preview-title">{doc.name}</h2>
                  <small>Includes unsaved edits · Guest menu unchanged</small>
                </div>
                <div className="row">
                  <div className="atelier-preview-device" aria-label="Preview viewport">
                    <button
                      type="button"
                      aria-pressed={previewDevice === "desktop"}
                      onClick={() => setPreviewDevice("desktop")}
                    >
                      Desktop
                    </button>
                    <button
                      type="button"
                      aria-pressed={previewDevice === "mobile"}
                      onClick={() => setPreviewDevice("mobile")}
                    >
                      Mobile
                    </button>
                  </div>
                  <button
                    type="button"
                    className="atelier-preview-close"
                    aria-label="Back to edit"
                    onClick={() => previewDialog.current?.close()}
                  >
                    <X size={20} /> <span>Back to edit</span>
                  </button>
                </div>
              </div>
              <div className="atelier-preview-stage">
                <div
                  className={
                    "atelier-preview-viewport " + (previewDevice === "mobile" ? "is-mobile" : "")
                  }
                >
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
                </div>
              </div>
            </dialog>
          </>
        )}
      </div>
    </div>
  );
}
