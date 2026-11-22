"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpenText,
  CheckCircle2,
  FileClock,
  FileText,
  ImageIcon,
  Link2,
  LockKeyhole,
  Monitor,
  Plus,
  ShieldCheck,
  Smartphone,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import {
  FoodDraftSchema,
  editorialQualityIssues,
  type FoodDraft,
  type FoodWorkflowStatus,
} from "@/modules/food-encyclopedia/editorial-contracts";
import { submitEditorialAction, type EditorialActionRequest } from "./actions";

type History = {
  id: string;
  version: number;
  authorId: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  approved: boolean;
};
type Props = {
  initial: FoodDraft;
  id: string | null;
  version: number;
  status: FoodWorkflowStatus;
  versions: History[];
  publishedRevisionId: string | null;
};
const field =
  "rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-offset-2 focus-visible:outline-orange-500 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100";
const subtle = "text-xs font-semibold tracking-wide text-stone-600 dark:text-stone-400";
const panel =
  "rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900";
function removeEmpty(text: string) {
  return text
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
}
function Status({ status }: { status: FoodWorkflowStatus }) {
  return (
    <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold tracking-wider text-amber-900 uppercase dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
      {status.replace("_", " ")}
    </span>
  );
}
export function EditorialEditor({
  initial,
  id,
  version,
  status,
  versions,
  publishedRevisionId,
}: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<FoodDraft>(initial);
  const [actualVersion, setActualVersion] = useState(version);
  const [currentStatus, setStatus] = useState(status);
  const [busy, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; value: string } | null>(null);
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [license, setLicense] = useState<"owned" | "commissioned" | "cc0" | "cc-by" | "licensed">(
    "owned"
  );
  const [attribution, setAttribution] = useState("");
  const issues = useMemo(() => {
    const parsed = FoodDraftSchema.safeParse(draft);
    if (!parsed.success)
      return parsed.error.issues.map((e) => ({ field: e.path.join("."), detail: e.message }));
    return editorialQualityIssues(parsed.data);
  }, [draft]);
  const update = <K extends keyof FoodDraft>(key: K, value: FoodDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  function run(
    action: EditorialActionRequest["action"],
    extra: Partial<EditorialActionRequest> = {}
  ) {
    if (busy) return;
    setMessage(null);
    const isContent = ["create", "save", "import"].includes(action);
    const parsed = isContent ? FoodDraftSchema.safeParse(draft) : null;
    if (parsed && !parsed.success) {
      setMessage({
        ok: false,
        value:
          "Correct form fields before saving: " +
          parsed.error.issues
            .slice(0, 2)
            .map((x) => x.path.join(".") + " " + x.message)
            .join("; "),
      });
      return;
    }
    if (action === "submit" && issues.length) {
      setMessage({
        ok: false,
        value: "Resolve the quality checklist before submitting for review.",
      });
      return;
    }
    const payload: EditorialActionRequest = {
      action,
      target: id ?? "new",
      expectedVersion: actualVersion,
      requestKey: crypto.randomUUID(),
      ...(isContent ? { content: draft } : {}),
      ...extra,
    };
    startTransition(async () => {
      const result = await submitEditorialAction(payload);
      if (!result.ok) {
        setMessage({ ok: false, value: result.error });
        return;
      }
      setMessage({
        ok: true,
        value: "Recorded. Review the updated workflow state before the next action.",
      });
      if (result.version !== undefined) setActualVersion(result.version);
      if (result.status) setStatus(result.status as FoodWorkflowStatus);
      if (!id) {
        router.push("/admin/encyclopedia/" + result.id);
        return;
      }
      router.refresh();
    });
  }
  const edited = !id;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/encyclopedia"
          className="inline-flex items-center gap-2 text-sm font-semibold text-stone-600 hover:text-orange-700 dark:text-stone-300"
        >
          <ArrowLeft size={18} />
          All guides
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Status status={currentStatus} />
          <span className="font-mono text-xs text-stone-500">v{actualVersion}</span>
        </div>
      </div>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[.2em] text-orange-600 uppercase dark:text-orange-300">
            The Atlas / Editorial Studio
          </p>
          <h1 className="font-display mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            {edited ? "Create a researched food guide" : draft.title}
          </h1>
          <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
            A draft is never public until a separate reviewer approves the exact revision.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setView("edit")}
            aria-pressed={view === "edit"}
            className={`rounded-xl px-4 py-2 text-sm font-bold ${view === "edit" ? "bg-orange-600 text-white" : "bg-stone-200 dark:bg-stone-800"}`}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setView("preview")}
            aria-pressed={view === "preview"}
            className={`rounded-xl px-4 py-2 text-sm font-bold ${view === "preview" ? "bg-orange-600 text-white" : "bg-stone-200 dark:bg-stone-800"}`}
          >
            Preview
          </button>
        </div>
      </header>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-5 py-4 text-sm text-stone-900 dark:border-orange-950 dark:bg-orange-950/20 dark:text-stone-200">
        <LockKeyhole size={20} className="shrink-0 text-orange-700 dark:text-orange-300" />
        <p className="flex-1">
          Before each action,{" "}
          <Link className="font-bold underline" href="/account/security">
            complete the one-time admin step-up
          </Link>
          . Saving creates a new immutable revision; it does not edit the published version.
        </p>
      </div>
      {message && (
        <div
          role={message.ok ? "status" : "alert"}
          className={`rounded-xl border p-4 text-sm ${message.ok ? "border-green-300 bg-green-50 text-green-950 dark:border-green-900 dark:bg-green-950" : "border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950"}`}
        >
          {message.value}
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        {view === "edit" ? (
          <div className="space-y-6">
            <section className={panel}>
              <h2 className="font-display mb-5 flex items-center gap-2 text-xl font-bold">
                <BookOpenText size={20} className="text-orange-600" />
                Identity & summary
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className={subtle}>Content type</span>
                  <select
                    className={field + " w-full"}
                    value={draft.kind}
                    disabled={!!id}
                    onChange={(e) => update("kind", e.target.value as FoodDraft["kind"])}
                  >
                    {["dishes", "ingredients", "cuisines", "terms", "compare"].map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className={subtle}>URL slug (immutable after creation)</span>
                  <input
                    className={field + " w-full"}
                    value={draft.slug}
                    disabled={!!id}
                    maxLength={90}
                    onChange={(e) =>
                      update("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"))
                    }
                  />
                </label>
                <label className="space-y-1 sm:col-span-2">
                  <span className={subtle}>Article title</span>
                  <input
                    className={field + " w-full"}
                    value={draft.title}
                    maxLength={100}
                    onChange={(e) => update("title", e.target.value)}
                  />
                </label>
                <label className="space-y-1 sm:col-span-2">
                  <span className={subtle}>Eyebrow / category label</span>
                  <input
                    className={field + " w-full"}
                    value={draft.eyebrow}
                    maxLength={120}
                    onChange={(e) => update("eyebrow", e.target.value)}
                  />
                </label>
                <label className="space-y-1 sm:col-span-2">
                  <span className={subtle}>Short definition (35–320 characters)</span>
                  <textarea
                    rows={3}
                    maxLength={320}
                    className={field + " w-full"}
                    value={draft.description}
                    onChange={(e) => update("description", e.target.value)}
                  />
                </label>
                <label className="space-y-1">
                  <span className={subtle}>Illustration palette</span>
                  <select
                    className={field + " w-full"}
                    value={draft.tint}
                    onChange={(e) => update("tint", e.target.value as FoodDraft["tint"])}
                  >
                    {["cream", "sage", "blue", "peach", "lavender"].map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className={subtle}>Aliases (one per line)</span>
                  <textarea
                    rows={3}
                    className={field + " w-full"}
                    value={draft.aliases.join("\n")}
                    onChange={(e) => update("aliases", removeEmpty(e.target.value).slice(0, 20))}
                  />
                </label>
              </div>
            </section>
            <section className={panel}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-xl font-bold">Quick facts</h2>
                <button
                  type="button"
                  className="flex items-center gap-1 text-sm font-bold text-orange-700 dark:text-orange-300"
                  disabled={draft.facts.length >= 8}
                  onClick={() =>
                    update("facts", [
                      ...draft.facts,
                      { label: "New fact", value: "Research this fact" },
                    ])
                  }
                >
                  <Plus size={17} />
                  Add
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {draft.facts.map((fact, i) => (
                  <div
                    key={i}
                    className="grid gap-2 rounded-xl bg-stone-50 p-3 sm:grid-cols-[1fr_1fr_auto] dark:bg-stone-950"
                  >
                    <label className={subtle}>
                      Label
                      <input
                        className={field + " mt-1 w-full"}
                        maxLength={40}
                        value={fact.label}
                        onChange={(e) =>
                          update(
                            "facts",
                            draft.facts.map((f, x) =>
                              x === i ? { ...f, label: e.target.value } : f
                            )
                          )
                        }
                      />
                    </label>
                    <label className={subtle}>
                      Value
                      <input
                        className={field + " mt-1 w-full"}
                        maxLength={140}
                        value={fact.value}
                        onChange={(e) =>
                          update(
                            "facts",
                            draft.facts.map((f, x) =>
                              x === i ? { ...f, value: e.target.value } : f
                            )
                          )
                        }
                      />
                    </label>
                    <button
                      aria-label={"Remove fact " + (i + 1)}
                      type="button"
                      className="self-end rounded-lg p-3 text-rose-700 hover:bg-rose-100"
                      disabled={draft.facts.length <= 2}
                      onClick={() =>
                        update(
                          "facts",
                          draft.facts.filter((_, x) => x !== i)
                        )
                      }
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
            <section className={panel}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-xl font-bold">Article sections</h2>
                <button
                  type="button"
                  disabled={draft.sections.length >= 12}
                  className="flex items-center gap-1 text-sm font-bold text-orange-700 dark:text-orange-300"
                  onClick={() =>
                    update("sections", [
                      ...draft.sections,
                      {
                        id: "section-" + (draft.sections.length + 1),
                        eyebrow: "NEXT / SECTION",
                        title: "New section",
                        body: [
                          "Explain this section with carefully researched information, practical context and appropriate uncertainty.",
                        ],
                      },
                    ])
                  }
                >
                  <Plus size={17} />
                  Section
                </button>
              </div>
              <div className="mt-4 space-y-5">
                {draft.sections.map((section, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-stone-200 p-4 dark:border-stone-700"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-bold text-orange-700 dark:text-orange-300">
                        SECTION {String(i + 1).padStart(2, "0")}
                      </span>
                      <button
                        aria-label={"Remove section " + (i + 1)}
                        type="button"
                        className="text-rose-700"
                        disabled={draft.sections.length <= 2}
                        onClick={() =>
                          update(
                            "sections",
                            draft.sections.filter((_, x) => x !== i)
                          )
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {(["id", "eyebrow", "title"] as const).map((key) => (
                        <label key={key} className={subtle + " space-y-1"}>
                          <span className="capitalize">{key}</span>
                          <input
                            className={field + " w-full"}
                            maxLength={key === "title" ? 150 : key === "eyebrow" ? 80 : 90}
                            value={section[key]}
                            onChange={(e) =>
                              update(
                                "sections",
                                draft.sections.map((s, x) =>
                                  x === i ? { ...s, [key]: e.target.value } : s
                                )
                              )
                            }
                          />
                        </label>
                      ))}
                      <label className={subtle + " space-y-1 sm:col-span-2"}>
                        <span>Paragraphs (separate with an empty line)</span>
                        <textarea
                          className={field + " w-full"}
                          rows={7}
                          value={section.body.join("\n\n")}
                          onChange={(e) =>
                            update(
                              "sections",
                              draft.sections.map((s, x) =>
                                x === i
                                  ? {
                                      ...s,
                                      body: e.target.value
                                        .split(/\n\s*\n/)
                                        .map((x) => x.trim())
                                        .filter(Boolean)
                                        .slice(0, 6),
                                    }
                                  : s
                              )
                            )
                          }
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <section className={panel}>
              <h2 className="font-display mb-4 flex items-center gap-2 text-xl font-bold">
                <Link2 size={20} className="text-orange-600" />
                Evidence and relationships
              </h2>
              <label className={subtle + " block space-y-2"}>
                <span>
                  Public HTTPS sources (one per line; at least two independent references)
                </span>
                <textarea
                  className={field + " w-full"}
                  rows={5}
                  value={draft.sourceUrls.join("\n")}
                  onChange={(e) => update("sourceUrls", removeEmpty(e.target.value).slice(0, 20))}
                  placeholder="https://..."
                />
              </label>
              <label className={subtle + " mt-4 block space-y-2"}>
                <span>Related canonical slugs (one per line)</span>
                <textarea
                  className={field + " w-full"}
                  rows={3}
                  value={draft.relatedSlugs.join("\n")}
                  onChange={(e) => update("relatedSlugs", removeEmpty(e.target.value).slice(0, 20))}
                />
              </label>
              <label className={subtle + " mt-4 block space-y-2"}>
                <span>Dietary and allergen caveat</span>
                <textarea
                  className={field + " w-full"}
                  rows={4}
                  value={draft.caution ?? ""}
                  onChange={(e) => update("caution", e.target.value || undefined)}
                />
              </label>
            </section>
            <section className={panel}>
              <h2 className="font-display mb-4 flex items-center gap-2 text-xl font-bold">
                <ImageIcon size={20} className="text-orange-600" />
                Artwork and rights
              </h2>
              <label className={subtle + " block space-y-2"}>
                <span>Reviewed local dish artwork path (optional)</span>
                <input
                  className={field + " w-full"}
                  value={draft.imagePath ?? ""}
                  onChange={(e) => update("imagePath", e.target.value || undefined)}
                  placeholder="/assets/food/dishes/indian/...png"
                />
              </label>
              <label className={subtle + " mt-3 block space-y-2"}>
                <span>Accessible image description</span>
                <input
                  className={field + " w-full"}
                  value={draft.imageAlt ?? ""}
                  onChange={(e) => update("imageAlt", e.target.value || undefined)}
                />
              </label>
              {id && draft.imagePath && (
                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
                  <h3 className="font-semibold">Verify rights before approval</h3>
                  <p className="my-2 text-xs">
                    The operator must verify original asset provenance or a valid license. This
                    control records an accountable rights attestation; it does not obtain a license.
                  </p>
                  <label className={subtle + " block"}>
                    License category
                    <select
                      value={license}
                      className={field + " mt-1 w-full"}
                      onChange={(e) => setLicense(e.target.value as typeof license)}
                    >
                      {["owned", "commissioned", "cc0", "cc-by", "licensed"].map((k) => (
                        <option value={k} key={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={subtle + " mt-3 block"}>
                    Attribution or license reference
                    <input
                      value={attribution}
                      className={field + " mt-1 w-full"}
                      onChange={(e) => setAttribution(e.target.value)}
                      maxLength={240}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run("media.approve", { path: draft.imagePath, license, attribution })
                    }
                    className="mt-3 rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Attest artwork rights
                  </button>
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className={panel}>
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="font-display text-xl font-bold">Reading preview</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  aria-pressed={device === "desktop"}
                  onClick={() => setDevice("desktop")}
                  title="Desktop preview"
                >
                  <Monitor size={20} />
                </button>
                <button
                  type="button"
                  aria-pressed={device === "mobile"}
                  onClick={() => setDevice("mobile")}
                  title="Mobile preview"
                >
                  <Smartphone size={20} />
                </button>
              </div>
            </div>
            <div
              className={`mx-auto max-h-[950px] overflow-y-auto rounded-xl border border-stone-200 bg-[#fffaf2] p-5 text-[#281d18] ${device === "mobile" ? "max-w-[390px]" : "w-full"}`}
            >
              <p className="text-xs font-black tracking-widest text-[#b84d1e] uppercase">
                {draft.eyebrow}
              </p>
              <h2 className="font-display my-5 text-4xl font-black tracking-tight">
                {draft.title}
              </h2>
              <p className="text-lg leading-relaxed">{draft.description}</p>
              {draft.imagePath && (
                <p className="mt-4 rounded-lg bg-orange-50 p-4 text-xs text-orange-900">
                  Artwork: {draft.imageAlt ?? draft.imagePath}
                </p>
              )}
              <div className="mt-7 grid grid-cols-2 gap-3 rounded-xl bg-[#281d18] p-4 text-white">
                {draft.facts.map((f, i) => (
                  <div key={i}>
                    <div className="text-xs text-orange-200 uppercase">{f.label}</div>
                    <strong className="text-sm">{f.value}</strong>
                  </div>
                ))}
              </div>
              {draft.sections.map((s, i) => (
                <section key={i} className="border-b border-stone-200 py-8">
                  <p className="mb-2 text-xs font-bold text-orange-700">{s.eyebrow}</p>
                  <h3 className="font-display mb-4 text-2xl font-bold">{s.title}</h3>
                  {s.body.map((p, j) => (
                    <p key={j} className="mt-3 leading-loose">
                      {p}
                    </p>
                  ))}
                </section>
              ))}
              {draft.caution && (
                <p className="mt-6 rounded-xl bg-amber-100 p-4 text-sm">{draft.caution}</p>
              )}
              <div className="my-8 border-t border-stone-300 pt-4 text-xs">
                <strong>References:</strong> {draft.sourceUrls.length} sources submitted for
                editorial review.
              </div>
            </div>
          </div>
        )}
        <aside className="space-y-5">
          <section className={panel}>
            <h2 className="font-display flex items-center gap-2 text-lg font-bold">
              <ShieldCheck size={19} className="text-orange-600" />
              Publication checklist
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-stone-500">
              Checks are only automatic preconditions. Real human research and independent approval
              remain necessary.
            </p>
            <div className="mt-4 space-y-3">
              {issues.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                  <CheckCircle2 size={18} />
                  Basic structural checks satisfied
                </div>
              ) : (
                issues.map((issue, i) => (
                  <div
                    className="flex gap-2 text-xs leading-relaxed text-amber-900 dark:text-amber-300"
                    key={i}
                  >
                    <TriangleAlert size={16} className="shrink-0" />
                    <span>
                      <strong>{issue.field}:</strong> {issue.detail}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
          <section className={panel}>
            <h2 className="font-display text-lg font-bold">Workflow actions</h2>
            <p className="mt-2 text-xs text-stone-500">
              Publishing never modifies previous approved revision bodies. Use a new review cycle
              after every edit.
            </p>
            <div className="mt-4 grid gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => run(id ? "save" : "create")}
                className="rounded-xl bg-orange-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {busy ? "Recording…" : id ? "Save new revision" : "Create draft"}
              </button>
              {id && (
                <>
                  <button
                    type="button"
                    disabled={busy || currentStatus !== "draft" || issues.length > 0}
                    onClick={() => run("submit")}
                    className="rounded-xl border border-stone-300 px-4 py-3 text-sm font-semibold disabled:opacity-40 dark:border-stone-700"
                  >
                    Submit for independent review
                  </button>
                  <button
                    type="button"
                    disabled={busy || currentStatus !== "in_review"}
                    onClick={() => run("approve")}
                    className="rounded-xl border border-stone-300 px-4 py-3 text-sm font-semibold disabled:opacity-40 dark:border-stone-700"
                  >
                    Approve reviewed revision
                  </button>
                  <button
                    type="button"
                    disabled={busy || currentStatus !== "approved"}
                    onClick={() => run("publish")}
                    className="rounded-xl bg-green-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-40"
                  >
                    Publish approved revision
                  </button>
                  <button
                    type="button"
                    disabled={busy || !publishedRevisionId}
                    onClick={() => run("unpublish")}
                    className="rounded-xl border border-rose-400 px-4 py-3 text-sm font-semibold text-rose-700 disabled:opacity-40"
                  >
                    Unpublish public article
                  </button>
                </>
              )}
            </div>
          </section>
          {id && (
            <section className={panel}>
              <h2 className="font-display flex items-center gap-2 text-lg font-bold">
                <FileClock size={19} />
                Revision history
              </h2>
              <div className="mt-3 space-y-3">
                {versions.length ? (
                  versions.map((v) => (
                    <div
                      key={v.id}
                      className="rounded-lg border border-stone-200 p-3 text-xs dark:border-stone-700"
                    >
                      <p className="font-semibold">
                        Revision {v.version} {v.approved ? "· Approved" : ""}{" "}
                        {v.id === publishedRevisionId ? "· Live" : ""}
                      </p>
                      <p className="mt-1 text-stone-500">
                        Authored {new Date(v.createdAt).toLocaleDateString()}
                      </p>
                      {v.reviewedAt && (
                        <p className="text-stone-500">
                          Reviewed {new Date(v.reviewedAt).toLocaleDateString()}
                        </p>
                      )}
                      {v.approved && (
                        <button
                          type="button"
                          onClick={() => run("restore", { revisionId: v.id })}
                          disabled={busy || v.id === publishedRevisionId}
                          className="mt-2 text-orange-700 underline disabled:opacity-40 dark:text-orange-300"
                        >
                          Restore this approved version
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-stone-500">No revisions recorded yet.</p>
                )}
              </div>
            </section>
          )}
          <Link
            href="/explore"
            className="flex items-center gap-2 text-sm text-stone-500 hover:text-orange-600"
          >
            <FileText size={17} />
            View the public Atlas
          </Link>
        </aside>
      </div>
    </div>
  );
}
