"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Save,
  Eye,
  Send,
  UtensilsCrossed,
  ArrowUp,
  ArrowDown,
  ImagePlus,
} from "lucide-react";
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
    selected.current = menuId;
    setError("");
    const next = await json(path(menuId));
    if (selected.current !== menuId) return;
    setDetail(next);
    setDoc(next.document);
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
    setDirty(false);
    setMessage("Draft saved. Publish when ready.");
    await load(detail.id);
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
  function move(ci: number, delta: number) {
    if (!doc) return;
    const categories = [...doc.categories];
    const target = ci + delta;
    if (target < 0 || target >= categories.length) return;
    [categories[ci], categories[target]] = [categories[target]!, categories[ci]!];
    change({ ...doc, categories });
  }
  return (
    <div className="product stack">
      <header className="row between">
        <div>
          <span className="eyebrow">
            {outlet.outletType.replaceAll("_", " ")} · {outlet.currency}
          </span>
          <h1>Menu Studio</h1>
          <p>{outlet.name} · Save, preview, then publish.</p>
        </div>
        <UtensilsCrossed size={48} aria-hidden="true" />
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
              if (dirty && !window.confirm("Discard unsaved menu changes?")) return;
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
              if (dirty && !window.confirm("Discard unsaved changes and create another menu?"))
                return;
              const result = await json("/api/catalog", {
                method: "POST",
                headers,
                body: JSON.stringify({ key: creationKey.current }),
              });
              creationKey.current = id();
              const next = await json("/api/catalog");
              setList(next);
              await load(result.menuId);
              setMessage("Menu draft created");
            })
          }
        >
          <Plus size={16} />
          Create menu
        </button>
      </div>
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
          <a className="action ember" href={`/m/${outlet.publicId}`} target="_blank">
            View public menu
          </a>
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
                    ? "Published · draft editable"
                    : "Draft"}
              </span>
              <span className="badge">Revision {detail.revision}</span>
              <span className="badge">{dirty ? "Unsaved changes" : "Saved"}</span>
            </div>
            <div className="row">
              <button type="button" onClick={() => setPreview(!preview)}>
                <Eye size={16} />
                {preview ? "Back to edit" : "Preview draft"}
              </button>
              <button
                type="button"
                className="ember"
                disabled={busy || !detail.canWrite || detail.archived}
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
                disabled={busy || !detail.canWrite || detail.archived}
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
                          {doc.categories.map((c, ci) => (
                            <section key={c.id} className="panel stack">
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
                              {c.items.map((dish, di) => (
                                <div className="dish-editor stack" key={dish.id}>
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
                                      onChange={(priceMinor) => updateDish(ci, di, { priceMinor })}
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
                                    {(["vegetarian", "vegan", "gluten_free"] as const).map((d) => (
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
                                    ))}
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
                                                variants: dish.variants.filter((_, n) => n !== vi),
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
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    updateGroup({
                                                      options: g.options.filter((_, n) => n !== oi),
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
                                onClick={() =>
                                  updateCategory(ci, (c) => ({
                                    ...c,
                                    items: [
                                      ...c.items,
                                      {
                                        id: id(),
                                        name: "",
                                        description: "",
                                        priceMinor: 0,
                                        soldOut: false,
                                        archived: false,
                                        mediaId: null,
                                        dietary: [],
                                        variants: [],
                                        addOnGroups: [],
                                        schedule: null,
                                      },
                                    ],
                                  }))
                                }
                              >
                                <Plus size={16} />
                                Add dish
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
                          const file = f.get("photo") as File;
                          void run(async () => {
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
                            setMessage("Photo queued. Refresh after processing to review it.");
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

                          {a.lastError && <p>{a.lastError}</p>}
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
            <aside className="preview-phone no-print">
              <span className="eyebrow">Live draft preview</span>
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
