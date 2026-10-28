"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { artworkById } from "@/modules/menu-product/dish-artwork";
import { covers, type CoverPreset } from "@/modules/menu-product/public-presentation";
import { SmartDishComposer, type QuickDish } from "./smart-dish-composer";
import { StudioAddDish } from "./studio-add-dish";
import { StudioMenuBoard } from "./studio-menu-board";
import {
  StudioMenuGallery,
  type MenuLibraryAction,
  type MenuLibraryEntry,
} from "./studio-menu-gallery";
import { StudioMenuSelector } from "./studio-menu-selector";
import {
  findDishDuplicate,
  findPublicDishDescription,
  normalizeDishText,
  type OrganizationDish,
} from "@/modules/menu-product/dish-intelligence";
import { menuDocumentSchema, type MenuDocument } from "@/modules/menu-product/contracts";
import { draftCulinaryDefaults } from "@/modules/menu-product/draft-culinary";
import { displayToMinor } from "@/lib/money";
import { Field } from "./studio-fields";
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
import { TranslationEditor } from "./translation-editor";
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
  initialList: MenuLibraryEntry[];
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
  const [composerCategory, setComposerCategory] = useState("");
  const [addDishOpen, setAddDishOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [composerPending, setComposerPending] = useState(false);
  const [boardPending, setBoardPending] = useState(false);
  const [composerSelection, setComposerSelection] = useState<QuickDish[]>([]);
  const [organizationDishes, setOrganizationDishes] = useState<OrganizationDish[]>([]);
  const [preview, setPreview] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
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
  const bulkDialog = useRef<HTMLDialogElement>(null);
  const headers = { "content-type": "application/json", "x-outlet-id": outlet.id };
  const path = (menuId: string) => `/api/catalog/${menuId}`;
  useEffect(() => {
    if (!dirty && !composerPending && !boardPending) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, composerPending, boardPending]);
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
    setList((current) =>
      current.map((menu) =>
        menu.id === menuId
          ? {
              ...menu,
              document: next.document,
              archived: next.archived,
              revision: next.revision,
              publishedRevision: next.publishedRevision,
            }
          : menu
      )
    );
    setComposerCategory("");
    setOrganizationDishes([]);
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
  // A library selection is explicit: browsing cards never mutates the editor.
  async function switchMenu(menuId: string): Promise<boolean> {
    if (running.current) return false;
    if (menuId === detail?.id) return true;
    if (
      (dirty || composerPending || boardPending) &&
      !window.confirm("Discard unsaved menu changes and selected dishes?")
    )
      return false;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      await load(menuId);
      router.refresh();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open that menu.");
      return false;
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  async function createMenu(): Promise<boolean> {
    if (running.current) return false;
    if (
      (dirty || composerPending || boardPending) &&
      !window.confirm("Discard unsaved menu changes and selected dishes to create another menu?")
    )
      return false;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await json("/api/catalog", {
        method: "POST",
        headers,
        body: JSON.stringify({ key: creationKey.current }),
      });
      const next = await json("/api/catalog");
      setList(next);
      await load(result.menuId);
      creationKey.current = id();
      setMessage("Menu draft created");
      router.refresh();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the menu.");
      return false;
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  async function previewMenu(menuId: string): Promise<boolean> {
    if (!(await switchMenu(menuId))) return false;
    setPreviewDevice("desktop");
    setPreview(true);
    return true;
  }

  async function manageMenu(menuId: string, action: MenuLibraryAction): Promise<boolean> {
    if (!(await switchMenu(menuId))) return false;
    // Permissions and expected revision are retrieved for the selected target,
    // not borrowed from a stale render's previously selected menu.
    let target: Detail;
    try {
      target = (await json(path(menuId))) as Detail;
      if (!target.canWrite) throw new Error("You do not have permission to manage this menu.");
      if (action === "restore") {
        if (!target.archived) throw new Error("This menu is already active.");
        setBusy(true);
        await json(path(menuId), {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            key: id(),
            expectedRevision: target.revision,
            action: "restore",
            data: {},
          }),
        });
        setList(await json("/api/catalog"));
        await load(menuId);
        setMessage("Menu restored as an unpublished draft.");
        router.refresh();
        return true;
      }
      if (target.archived) throw new Error("Restore this menu before managing its publication.");
      if (action === "unpublish" && !target.publishedRevision)
        throw new Error("This menu is not published.");
      setLifecycleAction(action);
      setConfirmName("");
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Menu action failed.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!libraryOpen && lifecycleAction && !lifecycleDialog.current?.open) {
      lifecycleDialog.current?.showModal();
    }
  }, [libraryOpen, lifecycleAction]);

  useEffect(() => {
    if (!libraryOpen && preview && !previewDialog.current?.open) {
      previewDialog.current?.showModal();
    }
  }, [libraryOpen, preview]);

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
    if (composerPending || boardPending)
      throw new Error("Complete or cancel the open dish or section editor before saving.");
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
    setAddDishOpen(true);
  }
  function openBulkComposer() {
    setComposerCategory("");
    setBulkOpen(true);
  }
  function closeBulkComposer() {
    if (composerPending && !window.confirm("Discard your selected unsaved dishes?")) return;
    setComposerSelection([]);
    setComposerPending(false);
    bulkDialog.current?.close();
  }
  useEffect(() => {
    const modal = bulkDialog.current;
    if (bulkOpen && modal && !modal.open) modal.showModal();
    if (!bulkOpen && modal?.open) modal.close();
  }, [bulkOpen]);
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
        description: item.description ?? findPublicDishDescription(item.name),
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
        ...draftCulinaryDefaults(
          item.name,
          next.categories
            .filter((section) => !section.archived)
            .flatMap((section) => section.items.filter((dish) => !dish.archived))
        ),
        dietary: [],
        variants: [],
        addOnGroups: [],
        schedule: null,
      });
    }
    const parsed = menuDocumentSchema.safeParse(next);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid menu draft.");
    change(parsed.data);
    setMessage(items.length + " dishes added to private draft. Save when ready.");
  }
  function moveSection(ci: number, delta: number) {
    if (!doc) return;
    const target = ci + delta;
    if (target < 0 || target >= doc.categories.length) return;
    const categories = [...doc.categories];
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
      <StudioHero outlet={outlet} onOpenLibrary={() => setLibraryOpen(true)} />
      {libraryOpen && (
        <StudioMenuGallery
          open
          menus={list}
          currentMenuId={detail?.id ?? ""}
          currency={outlet.currency}
          busy={busy}
          error={error}
          onClose={() => setLibraryOpen(false)}
          onCreate={createMenu}
          onOpenMenu={switchMenu}
          onPreviewMenu={previewMenu}
          onManage={manageMenu}
        />
      )}
      <div className="atelier-body">
        {doc && detail && (
          <StudioAddDish
            key={detail.id}
            open={addDishOpen}
            doc={doc}
            outletId={outlet.id}
            menuId={detail.id}
            organization={organizationDishes}
            defaultCategoryId={composerCategory}
            onClose={() => setAddDishOpen(false)}
            onAdd={addQuickDishes}
          />
        )}
        <dialog
          ref={bulkDialog}
          className="menu-board-dialog menu-board-bulk-dialog"
          aria-labelledby="menu-board-bulk-title"
          onCancel={(event) => {
            if (composerPending && !window.confirm("Discard your selected unsaved dishes?")) {
              event.preventDefault();
              return;
            }
            setComposerSelection([]);
            setComposerPending(false);
          }}
          onClose={() => setBulkOpen(false)}
        >
          <div className="menu-board-dialog-head">
            <div>
              <span className="atelier-eyebrow">BATCH ENTRY</span>
              <h2 id="menu-board-bulk-title">Add multiple dishes</h2>
              <p>Search or paste a list, review outlet prices and add them together.</p>
            </div>
            <button type="button" aria-label="Close batch editor" onClick={closeBulkComposer}>
              <X size={19} />
            </button>
          </div>
          <div className="menu-board-dialog-body">
            {bulkOpen && doc && detail && (
              <SmartDishComposer
                doc={doc}
                outletId={outlet.id}
                menuId={detail.id}
                media={media}
                organization={organizationDishes}
                defaultCategoryId={composerCategory}
                focusRequest={1}
                selection={composerSelection}
                setSelection={setComposerSelection}
                onAdd={(items, name) => {
                  addQuickDishes(items, name);
                  bulkDialog.current?.close();
                }}
                onPendingChange={setComposerPending}
              />
            )}
          </div>
        </dialog>
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
          selector={
            <StudioMenuSelector
              menus={list}
              selectedId={detail?.id ?? ""}
              disabled={busy}
              onSelect={(menuId) => {
                void switchMenu(menuId);
              }}
            />
          }
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
              pending={composerPending || boardPending}
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
                  {["dishes", "storefront", "schedule", "translations", "media", "assignments"].map(
                    (t) => (
                      <button
                        type="button"
                        key={t}
                        aria-pressed={tab === t}
                        className={tab === t ? "ember" : ""}
                        onClick={() => {
                          if (t !== tab && boardPending) {
                            setError("Complete or cancel section changes before leaving this tab.");
                            return;
                          }
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
                    )
                  )}
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
                    {tab !== "translations" && (
                      <Field
                        label="Menu name"
                        value={doc.name}
                        onChange={(name) => change({ ...doc, name })}
                      />
                    )}
                    {tab === "dishes" && (
                      <StudioMenuBoard
                        key={detail.id}
                        doc={doc}
                        currency={doc.currency}
                        media={media}
                        canWrite={detail.canWrite && !detail.archived}
                        onAddDish={openComposer}
                        onAddMultiple={openBulkComposer}
                        onPendingChange={setBoardPending}
                        onCreateSection={(name) =>
                          change({
                            ...doc,
                            categories: [
                              ...doc.categories,
                              { id: id(), name, description: "", archived: false, items: [] },
                            ],
                          })
                        }
                        onUpdateCategory={(ci, patch) =>
                          updateCategory(ci, (category) => ({ ...category, ...patch }))
                        }
                        onUpdateDish={updateDish}
                        onMoveDish={moveDish}
                        onMoveSection={moveSection}
                      />
                    )}
                    {tab === "storefront" && (
                      <section
                        className="panel stack dining-studio-controls"
                        aria-labelledby="storefront-title"
                      >
                        <span className="eyebrow">THE DINING CANVAS</span>
                        <h2 id="storefront-title">Your guest storefront</h2>
                        <p>
                          Choose an illustrated cover, introduce your restaurant, and handpick
                          dishes to feature. These settings follow the saved draft and become public
                          only after you publish.
                        </p>
                        <fieldset className="dining-cover-picker">
                          <legend>Restaurant cover</legend>
                          <div className="dining-cover-options">
                            {(Object.entries(covers) as [CoverPreset, string][]).map(
                              ([key, src]) => (
                                <label
                                  key={key}
                                  className={
                                    (doc.presentation?.cover ?? "indian-restaurant") === key
                                      ? "is-selected"
                                      : ""
                                  }
                                >
                                  <input
                                    type="radio"
                                    name="cover-preset"
                                    checked={
                                      (doc.presentation?.cover ?? "indian-restaurant") === key
                                    }
                                    onChange={() =>
                                      change({
                                        ...doc,
                                        presentation: {
                                          cover: key,
                                          headline: doc.presentation?.headline ?? "",
                                          featuredDishIds: doc.presentation?.featuredDishIds ?? [],
                                        },
                                      })
                                    }
                                  />
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={src} alt="" width={290} height={100} loading="lazy" />
                                  <span>{key.replaceAll("-", " ")}</span>
                                </label>
                              )
                            )}
                          </div>
                        </fieldset>
                        <label className="field">
                          Hero introduction{" "}
                          <small className="quiet">Optional · 110 characters maximum</small>
                          <input
                            type="text"
                            maxLength={110}
                            value={doc.presentation?.headline ?? ""}
                            placeholder="Made with care. Served with joy."
                            onChange={(event) =>
                              change({
                                ...doc,
                                presentation: {
                                  cover: doc.presentation?.cover ?? "indian-restaurant",
                                  headline: event.target.value,
                                  featuredDishIds: doc.presentation?.featuredDishIds ?? [],
                                },
                              })
                            }
                          />
                        </label>
                        <fieldset className="dining-feature-picker">
                          <legend>Feature up to eight dishes</legend>
                          <p>
                            These selections power the featured section and complementary order
                            suggestions. No best-seller, discount or dietary claims are inferred.
                          </p>
                          <div className="dining-feature-options">
                            {doc.categories
                              .filter((category) => !category.archived)
                              .flatMap((category) =>
                                category.items
                                  .filter((dish) => !dish.archived)
                                  .map((dish) => {
                                    const featured = doc.presentation?.featuredDishIds ?? [];
                                    const selected = featured.includes(dish.id);
                                    return (
                                      <label key={dish.id}>
                                        <input
                                          type="checkbox"
                                          checked={selected}
                                          disabled={!selected && featured.length >= 8}
                                          onChange={() =>
                                            change({
                                              ...doc,
                                              presentation: {
                                                cover:
                                                  doc.presentation?.cover ?? "indian-restaurant",
                                                headline: doc.presentation?.headline ?? "",
                                                featuredDishIds: selected
                                                  ? featured.filter((id) => id !== dish.id)
                                                  : [...featured, dish.id],
                                              },
                                            })
                                          }
                                        />
                                        <span>{dish.name}</span>
                                        {dish.soldOut && (
                                          <small>Sold out · hidden from public highlights</small>
                                        )}
                                      </label>
                                    );
                                  })
                              )}
                          </div>
                        </fieldset>
                        <p className="quiet">
                          Preview draft uses this very same guest component and current unsaved
                          data. Published QR menus continue to show the last explicitly published
                          release.
                        </p>
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
                    {tab === "translations" &&
                      detail.publishedRevision &&
                      detail.publishedDocument && (
                        <TranslationEditor
                          key={`${detail.id}:${detail.publishedRevision}`}
                          menuId={detail.id}
                          outletId={outlet.id}
                          sourceRevision={detail.publishedRevision}
                          source={detail.publishedDocument}
                          initial={detail.translations}
                          disabled={busy || !detail.canWrite || detail.archived}
                          onSaved={(translations) =>
                            setDetail((current) =>
                              current ? { ...current, translations } : current
                            )
                          }
                        />
                      )}
                    {tab === "translations" &&
                      (!detail.publishedRevision || !detail.publishedDocument) && (
                        <p className="error">
                          Publish the canonical menu before adding reviewed guest translations.
                        </p>
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
                    {(dirty || composerPending || boardPending) && (
                      <p role="status" className="atelier-assignment-warning">
                        Save your draft and review queued Composer dishes before changing
                        shared-menu assignments or local overrides.
                      </p>
                    )}
                    <fieldset
                      className="atelier-assignment-lock"
                      disabled={dirty || composerPending || boardPending}
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
              {!preview && tab !== "dishes" && (
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
