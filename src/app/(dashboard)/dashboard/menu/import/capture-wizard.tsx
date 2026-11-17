"use client";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  ImagePlus,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  RefreshCcw,
  ScanLine,
  ShieldCheck,
  Sparkles,
  X,
  CheckCircle2,
  AlertCircle,
  UploadCloud,
} from "lucide-react";
import { currencyExponent } from "@/lib/money";
import { PhotoError, preparePhoto, UPLOAD_BYTE_LIMIT } from "@/lib/menu-import/prepare-photo";

type Source = {
  id: string;
  pageIndex: number;
  status: string;
  width: number | null;
  height: number | null;
};
type Candidate = {
  document: {
    sourceWarnings?: Array<{
      sourceId: string;
      reason:
        "invalid_provider_response" | "provider_unavailable" | "not_processed" | "truncated_output";
    }>;
    categories: Array<{
      id: string;
      name: { value: string | null };
      items: Array<{
        id: string;
        name: { value: string | null };
        priceMinor: { value: number | null; review: string };
      }>;
    }>;
  };
};
type Session = {
  id: string;
  status: string;
  revision: number;
  currency: string;
  sources: Source[];
  candidate: Candidate | null;
  updatedAt?: string;
  engineResult?: {
    state: string;
    errorCode: string | null;
    model: string;
    requests: number;
  } | null;
};
type SessionSummary = Pick<Session, "id" | "revision" | "currency" | "status"> & {
  createdAt?: string;
  updatedAt?: string;
};
/** Twelve pages at the 45 second provider timeout is nine minutes; beyond this something is stuck. */
const SLOW_AFTER_MS = 15 * 60 * 1000;
type Draft = {
  id: string;
  pageIndex: number;
  file: File;
  preview: string;
  state: "pending" | "uploading" | "ready" | "error";
  error?: string;
};
const MAX_PHOTO = UPLOAD_BYTE_LIMIT;
const MAX_PAGES = 12;
const MAX_IMPORT_BYTES = 30 * 1024 * 1024;
const supported = new Set(["image/jpeg", "image/png", "image/webp"]);
/** What happened and what to do next, in the owner's words. Keyed by the worker's failure code. */
const failureHelp: Record<string, string> = {
  invalid_provider_response:
    "No dishes could be read from these photos. Retake them in good light with the page flat and the text sharp, photograph crowded pages in two halves, then start a new import.",
  provider_unavailable:
    "The reading service did not respond, so no dishes were read. This is a problem on our side, not with your photos. Start a new import in a few minutes.",
  source_unavailable:
    "One of your uploaded photos could not be opened for reading. Start a new import and upload the photos again.",
  processing_failed:
    "The import stopped before it finished. Start a new import. If it happens again, contact support and quote the import ID below.",
  engine_unavailable:
    "Menu reading is not fully set up on our side yet, so nothing was read. Contact support and quote the import ID below.",
  ambiguous_delivery:
    "The import was interrupted while a page was being read, and we cannot tell whether that page finished. It is not repeated automatically. Start a new import.",
};
const warningHelp: Record<string, string> = {
  invalid_provider_response: "nothing readable was found on it",
  provider_unavailable: "the reading service failed while reading it",
  not_processed: "it was not read, because the reading service failed on an earlier page",
  truncated_output:
    "it has more dishes than could be read in one pass, so the last ones are missing",
};
const draftStateText: Record<Draft["state"], string> = {
  pending: "ready to upload",
  uploading: "uploading…",
  ready: "uploaded",
  error: "upload failed",
};
const plural = (count: number, word: string) => count + " " + word + (count === 1 ? "" : "s");
function statusText(status: string) {
  return (
    (
      {
        collecting: "Collect photographs",
        queued: "Waiting for processing",
        processing: "Interpreting your menu",
        needs_review: "Ready for human review",
        ready: "Review complete",
        applied: "Applied",
        failed: "Processing needs attention",
        cancelled: "Cancelled",
        expired: "Expired",
      } as Record<string, string>
    )[status] ?? "Checking status"
  );
}
export function CaptureWizard({
  outletId,
  outletName,
  currency,
}: {
  outletId: string;
  outletName: string;
  currency: string;
}) {
  const [history, setHistory] = useState<SessionSummary[]>([]);
  const [dragging, setDragging] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [engine, setEngine] = useState(false);
  const [engineReason, setEngineReason] = useState<string>("checking");
  const [consent, setConsent] = useState(false);
  const [slow, setSlow] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const creation = useRef<{ id: string; key: string } | null>(null);
  const localUrls = useRef(new Set<string>());
  const json = useCallback(
    async <T,>(url: string, options: RequestInit = {}): Promise<T> => {
      const response = await fetch(url, {
        ...options,
        cache: "no-store",
        headers: { "x-outlet-id": outletId, ...options.headers },
      });
      const body = await response.json().catch(() => ({}) as { message?: string });
      if (!response.ok)
        throw new Error(
          body.message ??
            "The server could not complete this step (error " +
              response.status +
              "). Your uploaded photos are safe; try again."
        );
      return body as T;
      // The outlet selector is explicit; never depend on a demo/implicit tenant.
    },
    [outletId]
  );
  const refresh = useCallback(
    async (id: string) => {
      const next = await json<Session>("/api/menu-imports/" + encodeURIComponent(id));
      setSession(next);
      return next;
    },
    [json]
  );
  useEffect(() => {
    let active = true;
    void json<SessionSummary[]>("/api/menu-imports")
      .then((rows) => {
        if (active) setHistory(rows);
      })
      .catch(() => {
        if (active) setError("Import history could not be loaded. Retry from this page.");
      });
    void json<{ enabled: boolean; reason: string }>("/api/menu-imports/engine")
      .then((data) => {
        if (active) {
          setEngine(data.enabled);
          setEngineReason(data.reason);
        }
      })
      .catch(() => {
        if (active) {
          setEngine(false);
          setEngineReason("unavailable");
        }
      });
    const urls = localUrls.current;
    return () => {
      active = false;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [json]);
  useEffect(() => {
    if (!session || !["queued", "processing"].includes(session.status)) return;
    let live = true;
    const timer = window.setInterval(() => {
      void refresh(session.id)
        .then((next) => {
          if (live && next.updatedAt)
            setSlow(Date.now() - Date.parse(next.updatedAt) > SLOW_AFTER_MS);
        })
        .catch(() => {
          if (live)
            setNotice(
              "The connection dropped, so this page stopped updating. Your import is still running; press Refresh to see its progress."
            );
        });
    }, 4000);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [session, refresh]);
  const sourceIds =
    session?.sources
      .filter((s) => s.status === "ready")
      .map((s) => s.id)
      .join(",") ?? "";
  useEffect(() => {
    const id = session?.id;
    if (!id || !sourceIds) return;
    let active = true;
    const urls: string[] = [];
    void Promise.all(
      sourceIds.split(",").map(async (sourceId) => {
        const response = await fetch(
          "/api/menu-imports/" +
            encodeURIComponent(id) +
            "/sources/" +
            encodeURIComponent(sourceId),
          { cache: "no-store", headers: { "x-outlet-id": outletId } }
        );
        if (!response.ok) return null;
        const blob = await response.blob();
        if (!active) return null;
        const url = URL.createObjectURL(blob);
        urls.push(url);
        return [sourceId, url] as const;
      })
    )
      .then((rows) => {
        if (active)
          setPreviews(
            Object.fromEntries(rows.filter((r): r is readonly [string, string] => r !== null))
          );
      })
      .catch(() => {
        if (active)
          setNotice(
            "Some private previews could not be loaded. Your uploaded files are still saved."
          );
      });
    return () => {
      active = false;
      urls.forEach(URL.revokeObjectURL);
    };
  }, [session?.id, sourceIds, outletId]);
  async function begin(initialFiles?: File[], note = "") {
    if (busy) return;
    setBusy(true);
    // Keep any per-photo problem reported while the chosen photos were prepared.
    if (!initialFiles?.length) setError("");
    setNotice("");
    const command = creation.current ?? { id: crypto.randomUUID(), key: crypto.randomUUID() };
    creation.current = command;
    try {
      const created = await json<{ id: string }>("/api/menu-imports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(command),
      });
      creation.current = null;
      setDrafts([]);
      setConsent(false);
      const createdSession = await refresh(created.id);
      if (initialFiles?.length) place(initialFiles, createdSession, []);
      setNotice(
        initialFiles?.length
          ? note + "Photos selected. Check the order, then upload them privately."
          : "Private draft created. Your live menu remains unchanged."
      );
      setHistory((prev) => prev.filter((i) => i.id !== created.id));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The import could not be started. Check your connection and try again."
      );
    } finally {
      setBusy(false);
    }
  }
  /**
   * Validates and prepares the chosen photos, then adds them to the draft (creating one first when
   * needed). Every refusal names the photo and says what to do; large phone photos are resized
   * instead of being refused.
   */
  async function choose(files: FileList | File[] | null, target: Session | null = session) {
    // Copy first: the file input is reset right after this call.
    const picked = files ? Array.from(files) : [];
    if (!picked.length || busy) return;
    if (target && target.status !== "collecting") return;
    setError("");
    setNotice("");
    if (target && drafts.some((d) => d.state !== "ready")) {
      setError("Upload or remove the photos you already selected before adding more.");
      return;
    }
    const used = target
      ? target.sources.filter((s) => s.status === "ready").length +
        drafts.filter((d) => d.state !== "ready").length
      : 0;
    const room = MAX_PAGES - used;
    if (picked.length > room) {
      setError(
        room <= 0
          ? "This import already has 12 photos, the most one import can hold. Start another import for the rest."
          : "You chose " +
              plural(picked.length, "photo") +
              ", but this import has room for " +
              room +
              " more (12 in total). Choose fewer, or start another import for the rest."
      );
      return;
    }
    setBusy(true);
    setNotice("Preparing your photos…");
    const prepared: File[] = [];
    const problems: string[] = [];
    let resized = 0;
    for (const file of picked) {
      try {
        const result = await preparePhoto(file);
        prepared.push(result.file);
        if (result.resized) resized++;
      } catch (err) {
        problems.push(
          err instanceof PhotoError
            ? err.message
            : "“" + file.name + "” could not be prepared. Take or choose the photo again."
        );
      }
    }
    setBusy(false);
    setNotice("");
    if (problems.length) setError(problems.join(" "));
    if (!prepared.length) return;
    if (prepared.reduce((sum, file) => sum + file.size, 0) > MAX_IMPORT_BYTES) {
      setError(
        "Together these photos are over the 30 MiB limit for one import. Add them in two smaller batches or imports."
      );
      return;
    }
    const note = resized
      ? plural(resized, "large photo") + (resized === 1 ? " was" : " were") + " resized to fit. "
      : "";
    if (!target) {
      await begin(prepared, note);
      return;
    }
    place(prepared, target);
    setNotice(note + "Use a clear, flat image with all prices visible.");
  }
  /** Assigns page numbers to prepared photos, reusing reserved slots of interrupted uploads. */
  function place(chosen: File[], target: Session, existing: Draft[] = drafts) {
    const reserved = target.sources
      .filter((s) => s.status !== "ready")
      .sort((a, b) => a.pageIndex - b.pageIndex);
    const next =
      Math.max(-1, ...target.sources.map((s) => s.pageIndex), ...existing.map((d) => d.pageIndex)) +
      1;
    let cursor = 0;
    const items = chosen.map((file) => {
      const retry = reserved[cursor];
      const index = retry ? retry.pageIndex : next + Math.max(0, cursor - reserved.length);
      cursor++;
      const preview = URL.createObjectURL(file);
      localUrls.current.add(preview);
      return {
        id: retry?.id ?? crypto.randomUUID(),
        pageIndex: index,
        file,
        preview,
        state: "pending" as const,
      };
    });
    setDrafts((prev) => [...prev, ...items]);
  }
  /** Splitting is user-directed; no automatic guesswork about page layout. */
  async function splitPending(id: string) {
    const item = drafts.find((d) => d.id === id && d.state === "pending");
    if (!session || busy || session.status !== "collecting" || !item) return;
    const sourceFile = item.file;
    const indices = [...session.sources, ...drafts].map((s) => s.pageIndex);
    if (indices.includes(11) || session.sources.some((s) => s.pageIndex >= item.pageIndex)) {
      setError(
        "Split columns before uploading the remaining pages. Saved pages cannot be reordered."
      );
      return;
    }
    setBusy(true);
    setError("");
    let bitmap: ImageBitmap | undefined;
    try {
      bitmap = await createImageBitmap(sourceFile);
      if (bitmap.width < 320 || bitmap.height < 320)
        throw new Error(
          "The photo is too small to split reliably. Capture a higher-resolution menu."
        );
      const middle = Math.floor(bitmap.width / 2);
      async function column(left: number, width: number, suffix: string) {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = bitmap!.height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Image preparation is unavailable in this browser");
        context.drawImage(bitmap!, left, 0, width, bitmap!.height, 0, 0, width, bitmap!.height);
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (value) => (value ? resolve(value) : reject(new Error("Photo crop failed"))),
            "image/webp",
            0.94
          )
        );
        if (!supported.has(blob.type) || blob.size > MAX_PHOTO)
          throw new Error("The cropped photo exceeds the supported format or size.");
        return new File(
          [blob],
          sourceFile.name.replace(/\.[^.]+$/, "") +
            "-" +
            suffix +
            "." +
            (blob.type === "image/webp" ? "webp" : "png"),
          { type: blob.type }
        );
      }
      const left = await column(0, middle, "left");
      const right = await column(middle, bitmap.width - middle, "right");
      const leftUrl = URL.createObjectURL(left);
      const rightUrl = URL.createObjectURL(right);
      localUrls.current.add(leftUrl);
      localUrls.current.add(rightUrl);
      setDrafts((previous) =>
        previous
          .flatMap((d) =>
            d.id === id
              ? [
                  { ...d, file: left, preview: leftUrl },
                  {
                    id: crypto.randomUUID(),
                    pageIndex: d.pageIndex + 1,
                    file: right,
                    preview: rightUrl,
                    state: "pending" as const,
                  },
                ]
              : [{ ...d, pageIndex: d.pageIndex > item.pageIndex ? d.pageIndex + 1 : d.pageIndex }]
          )
          .sort((a, b) => a.pageIndex - b.pageIndex)
      );
      URL.revokeObjectURL(item.preview);
      localUrls.current.delete(item.preview);
      setNotice(
        "Two column crops are ready for private upload. Splitting helps recognition but cannot restore unreadable text."
      );
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "This photo could not be split. Upload it whole, or crop it on your phone first."
      );
    } finally {
      bitmap?.close();
      setBusy(false);
    }
  }
  function movePending(id: string, offset: -1 | 1) {
    if (busy) return;
    setDrafts((previous) => {
      const ordered = [...previous].sort((a, b) => a.pageIndex - b.pageIndex);
      const index = ordered.findIndex((item) => item.id === id);
      const other = ordered[index + offset];
      const current = ordered[index];
      if (!current || !other || current.state !== "pending" || other.state !== "pending")
        return previous;
      const pageIndex = current.pageIndex;
      return ordered
        .map((item) =>
          item.id === current.id
            ? { ...item, pageIndex: other.pageIndex }
            : item.id === other.id
              ? { ...item, pageIndex }
              : item
        )
        .sort((a, b) => a.pageIndex - b.pageIndex);
    });
  }
  function drop(id: string) {
    setDrafts((prev) =>
      prev.filter((d) => {
        if (d.id === id) {
          URL.revokeObjectURL(d.preview);
          localUrls.current.delete(d.preview);
          return false;
        }
        return true;
      })
    );
  }
  async function upload() {
    if (!session || busy || !drafts.some((d) => d.state === "pending" || d.state === "error"))
      return;
    setBusy(true);
    setError("");
    setNotice("");
    let current = session;
    for (const item of drafts
      .filter((d) => d.state === "pending" || d.state === "error")
      .sort((a, b) => a.pageIndex - b.pageIndex)) {
      setDrafts((prev) =>
        prev.map((d) => (d.id === item.id ? { ...d, state: "uploading", error: undefined } : d))
      );
      try {
        const response = await fetch(
          "/api/menu-imports/" + encodeURIComponent(current.id) + "/sources",
          {
            method: "POST",
            cache: "no-store",
            headers: {
              "x-outlet-id": outletId,
              "content-type": item.file.type,
              "x-import-source-id": item.id,
              "x-import-page-index": String(item.pageIndex),
            },
            body: item.file,
          }
        );
        const body = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(
            body.message ??
              (response.status === 413
                ? "This photo is too large to upload. Remove it and add it again so it can be resized."
                : "The server could not save this photo (error " + response.status + ").")
          );
        setDrafts((prev) => prev.map((d) => (d.id === item.id ? { ...d, state: "ready" } : d)));
        current = await refresh(current.id);
      } catch (err) {
        // fetch rejects with a TypeError only when the request never reached the server.
        const message =
          err instanceof TypeError
            ? "The connection dropped before this photo was sent."
            : err instanceof Error
              ? err.message
              : "The upload was interrupted.";
        setDrafts((prev) =>
          prev.map((d) => (d.id === item.id ? { ...d, state: "error", error: message } : d))
        );
        setError(
          "Page " +
            (item.pageIndex + 1) +
            " was not uploaded: " +
            message +
            " Pages already uploaded are saved. Fix or remove this page, then press Upload again."
        );
        break;
      }
    }
    setBusy(false);
  }
  async function cancel() {
    if (!session || busy) return;
    setBusy(true);
    setError("");
    try {
      await json("/api/menu-imports/" + encodeURIComponent(session.id) + "/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expectedRevision: session.revision }),
      });
      await refresh(session.id);
      setNotice("Import cancelled. Stored photos remain private under the retention policy.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The import could not be cancelled. Refresh to see its current state."
      );
    } finally {
      setBusy(false);
    }
  }
  async function process() {
    if (!session || busy || !consent || !engine) return;
    setBusy(true);
    setError("");
    try {
      await json("/api/menu-imports/" + encodeURIComponent(session.id) + "/process", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expectedRevision: session.revision, consent: true }),
      });
      await refresh(session.id);
      setNotice("Extraction queued. This is a review draft, never an automatic menu change.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Reading could not be started. Your photos are saved; try again."
      );
    } finally {
      setBusy(false);
    }
  }
  const collecting = session?.status === "collecting";
  const stage =
    !session || collecting
      ? 0
      : ["queued", "processing", "failed"].includes(session.status)
        ? 1
        : 2;
  function onDrop(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragging(false);
    if (!busy) void choose(event.dataTransfer.files);
  }
  function showHistory() {
    if (
      drafts.some(
        (draft) =>
          draft.state === "pending" || draft.state === "uploading" || draft.state === "error"
      ) &&
      !window.confirm(
        "Leave these unuploaded selections? Only successfully uploaded photos will be saved."
      )
    )
      return;
    setSession(null);
    setDrafts([]);
    setConsent(false);
    void json<SessionSummary[]>("/api/menu-imports")
      .then(setHistory)
      .catch(() => setError("Could not refresh import history."));
  }
  const readyCount = session?.sources.filter((s) => s.status === "ready").length ?? 0;
  const totalCount = session?.sources.length ?? 0;
  const minor = currencyExponent(currency) ?? 2;
  function money(n: number) {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(
      n / 10 ** minor
    );
  }
  return (
    <div className="scan-table space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/dashboard/menu" className="scan-back">
          <ArrowLeft className="size-4" /> Back to Menu Studio
        </Link>
        <span className="scan-private inline-flex items-center gap-2">
          <ShieldCheck className="size-4" /> Private · Review first
        </span>
      </div>
      <header className="scan-hero">
        <div className="scan-hero-copy">
          <p className="scan-eyebrow">RECIPE ATELIER / THE SCAN TABLE</p>
          <h1>Your menu. Digitized.</h1>
          <p className="scan-subtitle">
            Capture, extract and perfect every dish for {outletName}. Your published menu stays
            untouched until you explicitly publish from Menu Studio.
          </p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold">
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="size-4" /> Private photos
            </span>
            <span>Up to 12 pages</span>
            <span>Large photos are resized automatically</span>
            <span>{currency}</span>
          </div>
        </div>
      </header>
      <nav aria-label="Import progress" className="scan-step-rail">
        {[
          { title: "Capture", help: "Your pages" },
          { title: "Extract", help: "AI interpretation" },
          { title: "Review", help: "Human verified" },
        ].map((item, index) => (
          <div
            key={item.title}
            className="scan-step"
            data-state={index === stage ? "active" : index < stage ? "complete" : "upcoming"}
            aria-current={index === stage ? "step" : undefined}
          >
            <span className="scan-step-mark">
              {index < stage ? (
                <CheckCircle2 className="size-5" />
              ) : (
                String(index + 1).padStart(2, "0")
              )}
            </span>
            <span>
              <strong>{item.title}</strong>
              <small>{item.help}</small>
            </span>
          </div>
        ))}
      </nav>
      {error && (
        <div
          role="alert"
          className="flex gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <AlertCircle className="size-5 shrink-0" />
          {error}
        </div>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900"
        >
          {notice}
        </p>
      )}
      {!session ? (
        <section className="scan-panel space-y-5">
          <div
            className="scan-dropzone"
            data-dragging={dragging}
            onDragOver={(event) => {
              event.preventDefault();
              if (!busy) setDragging(true);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false);
            }}
            onDrop={onDrop}
          >
            <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
              <UploadCloud className="size-7" />
            </div>
            <h2 className="text-xl font-extrabold">Add your printed menu</h2>
            <p className="scan-status mx-auto mt-2 max-w-md text-sm">
              Drop clear menu photos here, use your camera or choose images. A private draft is
              created only when you begin.
            </p>
            <div className="scan-upload-options mt-5">
              <label className="scan-file-picker">
                <Camera className="size-4" /> Use camera
                <input
                  aria-label="Capture menu photograph"
                  className="sr-only"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  disabled={busy}
                  onChange={(event) => {
                    void choose(event.target.files);
                    event.target.value = "";
                  }}
                />
              </label>
              <label className="scan-file-picker scan-file-picker--secondary">
                <ImagePlus className="size-4" /> Choose photos
                <input
                  aria-label="Choose menu photographs"
                  className="sr-only"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  disabled={busy}
                  onChange={(event) => {
                    void choose(event.target.files);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
            <p className="scan-status mt-4 text-xs">
              JPEG · PNG · WebP · Max 12 photos · PDFs are not supported yet
            </p>
            {busy && (
              <p role="status" className="mt-3 text-sm font-semibold">
                Creating your private draft…
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-extrabold">Recent imports</h2>
              <p className="scan-status text-xs">
                Resume a session securely, without re-uploading completed pages.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void begin()}
              disabled={busy}
              className="scan-action scan-action--secondary"
            >
              <ImagePlus className="size-4" /> Create private draft
            </button>
          </div>
          {history.length === 0 ? (
            <div
              className="flex items-center gap-4 rounded-xl border p-5"
              style={{ borderColor: "var(--scan-border)" }}
            >
              <Image
                src="/brand/menu-studio/recipe-atelier/first-menu-empty-illustration.webp"
                alt=""
                width={86}
                height={75}
                className="size-20 object-contain"
              />
              <p className="scan-status text-sm">
                No imports yet. Add your first menu photographs above.
              </p>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {history.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setDrafts([]);
                    setConsent(false);
                    setError("");
                    void refresh(item.id).catch(() => setError("Could not reopen this import."));
                  }}
                  className="scan-history-row flex items-center justify-between gap-3 p-4 text-left"
                >
                  <span>
                    <span className="block text-sm font-bold">{statusText(item.status)}</span>
                    <span className="scan-status block text-xs">
                      {item.updatedAt
                        ? new Date(item.updatedAt).toLocaleDateString()
                        : "Private import"}{" "}
                      · {item.currency}
                    </span>
                  </span>
                  <ArrowRight className="size-4" aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          <section className="scan-panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold tracking-widest text-orange-700 uppercase">
                  Current draft
                </p>
                <h2 className="mt-1 text-xl font-bold text-stone-950">
                  {statusText(session.status)}
                </h2>
                <p className="mt-1 text-xs text-stone-500">
                  Revision {session.revision} · {readyCount} securely uploaded
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void refresh(session.id).catch(() => setError("Refresh failed"));
                  }}
                  aria-label="Refresh import"
                  className="rounded-xl border border-stone-200 p-3 text-stone-700"
                >
                  <RefreshCcw className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    showHistory();
                  }}
                  className="rounded-xl border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-700"
                >
                  All drafts
                </button>
              </div>
            </div>
            {collecting && (
              <div className="mt-6 space-y-5">
                <div
                  className="scan-dropzone"
                  data-dragging={dragging}
                  onDragOver={(event) => {
                    event.preventDefault();
                    if (!busy) setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                >
                  <p className="mb-3 text-base font-extrabold">Add and verify your menu pages</p>
                  <div className="scan-upload-options">
                    <label className="scan-file-picker">
                      <Camera className="size-4" />
                      Use camera
                      <input
                        aria-label="Capture menu photograph"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        capture="environment"
                        className="sr-only"
                        disabled={busy}
                        onChange={(e) => {
                          void choose(e.target.files);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <label className="scan-file-picker scan-file-picker--secondary">
                      <ImagePlus className="size-4" />
                      Choose from gallery
                      <input
                        aria-label="Choose menu photographs"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        className="sr-only"
                        disabled={busy}
                        onChange={(e) => {
                          void choose(e.target.files);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                  <p className="mt-3 text-xs leading-6 text-stone-600">
                    Include the full page, lay it flat, avoid shadows and glare, and photograph
                    small print up close. JPEG/PNG/WebP only; no PDF in this camera workflow.
                  </p>
                </div>
                {drafts.length > 0 && (
                  <div className="space-y-3">
                    {drafts.map((d) => (
                      <div key={d.id} className="scan-image-tile flex items-center gap-3 p-3">
                        <Image
                          src={d.preview}
                          width={64}
                          height={64}
                          unoptimized
                          alt={"Selected menu photograph " + (d.pageIndex + 1)}
                          className="size-16 rounded-lg object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-stone-900">{d.file.name}</p>
                          <p className="text-xs text-stone-600">
                            Page {d.pageIndex + 1} · {(d.file.size / 1048576).toFixed(2)} MiB ·{" "}
                            {draftStateText[d.state]}
                          </p>
                          {d.error && (
                            <p role="alert" className="text-xs text-red-700">
                              {d.error}
                            </p>
                          )}
                        </div>
                        {d.state === "pending" && (
                          <div className="flex flex-col gap-1">
                            <button
                              type="button"
                              onClick={() => movePending(d.id, -1)}
                              disabled={
                                busy ||
                                !drafts.some(
                                  (other) =>
                                    other.state === "pending" && other.pageIndex === d.pageIndex - 1
                                )
                              }
                              aria-label={"Move " + d.file.name + " earlier"}
                              className="rounded-lg border p-1 disabled:opacity-30"
                              style={{ borderColor: "var(--scan-border)" }}
                            >
                              <ArrowUp className="size-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => movePending(d.id, 1)}
                              disabled={
                                busy ||
                                !drafts.some(
                                  (other) =>
                                    other.state === "pending" && other.pageIndex === d.pageIndex + 1
                                )
                              }
                              aria-label={"Move " + d.file.name + " later"}
                              className="rounded-lg border p-1 disabled:opacity-30"
                              style={{ borderColor: "var(--scan-border)" }}
                            >
                              <ArrowDown className="size-4" />
                            </button>
                          </div>
                        )}
                        {d.state === "pending" && (
                          <button
                            type="button"
                            disabled={
                              busy ||
                              [...session.sources, ...drafts].some((s) => s.pageIndex === 11) ||
                              session.sources.some((s) => s.pageIndex >= d.pageIndex)
                            }
                            onClick={() => {
                              void splitPending(d.id);
                            }}
                            aria-label={"Split " + d.file.name + " into two columns"}
                            title="Use when a photographed menu has two vertical columns"
                            className="rounded-lg border border-orange-200 bg-orange-50 px-2 py-1.5 text-xs font-semibold text-orange-900 disabled:opacity-40"
                          >
                            Split columns
                          </button>
                        )}
                        {d.state !== "ready" && d.state !== "uploading" && (
                          <button
                            type="button"
                            onClick={() => drop(d.id)}
                            aria-label={"Remove " + d.file.name}
                            className="rounded-lg p-2 text-stone-500 hover:text-red-700"
                          >
                            <X className="size-4" />
                          </button>
                        )}
                        {d.state === "ready" && <CheckCircle2 className="size-5 text-green-700" />}
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  disabled={
                    busy || !drafts.some((d) => d.state === "pending" || d.state === "error")
                  }
                  onClick={() => {
                    void upload();
                  }}
                  className="scan-action disabled:opacity-40"
                >
                  <UploadCloud className="size-4" />
                  Upload photos privately
                </button>
              </div>
            )}
            {session.sources.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-bold text-stone-900">Saved sources</h3>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {session.sources.map((s) => (
                    <div key={s.id} className="scan-image-tile p-2">
                      {previews[s.id] ? (
                        <Image
                          src={previews[s.id]!}
                          width={250}
                          height={180}
                          unoptimized
                          alt={"Private menu source page " + (s.pageIndex + 1)}
                          className="h-28 w-full rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-28 items-center justify-center rounded-lg bg-stone-100 text-stone-500">
                          <ScanLine className="size-7" />
                        </div>
                      )}
                      <p className="mt-2 text-xs font-bold text-stone-800">
                        Page {s.pageIndex + 1} · {s.status}
                      </p>
                      <p className="text-xs text-stone-500">
                        {s.width && s.height ? s.width + " × " + s.height : "Upload may need retry"}
                      </p>
                      {s.width && s.height && (s.width < 900 || s.height < 700) && (
                        <p className="mt-1 text-xs font-medium text-amber-800">
                          Low resolution. Small printed prices may be unreadable; recapture at a
                          higher resolution when possible.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {collecting && (
              <div className="mt-6 rounded-2xl border border-stone-200 p-5">
                <div className="flex items-center gap-2 font-bold text-stone-900">
                  <Sparkles className="size-5 text-orange-600" />
                  Optional AI interpretation
                </div>
                {!engine ? (
                  <p className="mt-2 text-sm text-stone-600">
                    Extraction is currently unavailable, so these photos cannot be read into dishes
                    yet. Your {plural(totalCount, "uploaded page")}{" "}
                    {totalCount === 1 ? "stays" : "stay"} private and saved.{" "}
                    {engineReason === "checking"
                      ? "Checking availability…"
                      : engineReason === "unavailable"
                        ? "We could not check availability. Refresh the page to try again."
                        : "Menu reading has not been switched on for this service yet. You can add dishes by hand in Menu Studio in the meantime."}
                  </p>
                ) : (
                  <>
                    <p className="mt-2 text-sm text-stone-600">
                      This sends your saved photos to our AI reading service, which turns them into
                      a draft list of dishes and prices. It uses one AI credit per photo. You check
                      every entry before anything is added to a menu, and nothing is published
                      automatically.
                    </p>
                    <label className="mt-3 flex items-start gap-2 text-sm text-stone-700">
                      <input
                        aria-label="Consent to AI image interpretation"
                        type="checkbox"
                        className="mt-1"
                        checked={consent}
                        onChange={(e) => setConsent(e.target.checked)}
                      />
                      I am authorized to submit these images for third-party AI interpretation.
                    </label>
                    <button
                      type="button"
                      disabled={
                        busy ||
                        !consent ||
                        !readyCount ||
                        session.sources.some((s) => s.status !== "ready") ||
                        drafts.some((d) => d.state !== "ready")
                      }
                      onClick={() => {
                        void process();
                      }}
                      className="scan-action mt-4 disabled:opacity-40"
                    >
                      Start extraction
                    </button>
                  </>
                )}
              </div>
            )}
            {["queued", "processing"].includes(session.status) && (
              <p role="status" className="mt-5 rounded-xl bg-orange-50 p-4 text-sm text-orange-900">
                Reading your photos. Each page can take up to a minute. This page updates on its
                own, and it is safe to leave and come back.
                {slow && (
                  <span className="mt-2 block font-semibold">
                    This is taking longer than expected and may be stuck in a queue. You can keep
                    waiting, or cancel below and start a new import. Pages that were never sent do
                    not use AI credits.
                  </span>
                )}
              </p>
            )}
            {session.status === "failed" && (
              <div role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">
                <p className="font-semibold">
                  This import did not produce a draft. Your menu is unchanged and nothing was
                  published.
                </p>
                <p className="mt-1">
                  {failureHelp[session.engineResult?.errorCode ?? ""] ??
                    failureHelp["processing_failed"]}
                </p>
                <p className="mt-1">
                  You are not charged AI credits for pages that were never sent.
                </p>
                <button
                  type="button"
                  onClick={() => showHistory()}
                  className="scan-action scan-action--secondary mt-3"
                >
                  Start a new import
                </button>
                <p className="mt-3 text-xs">
                  Import ID: <code className="select-all">{session.id}</code>
                  {session.engineResult?.errorCode &&
                    " · Reason: " + session.engineResult.errorCode}
                </p>
              </div>
            )}
            {!["applied", "cancelled", "failed", "expired"].includes(session.status) && (
              <button
                type="button"
                onClick={() => {
                  void cancel();
                }}
                disabled={busy}
                className="mt-6 text-sm font-semibold text-red-700 underline disabled:opacity-50"
              >
                Cancel this import
              </button>
            )}
          </section>
          {session.candidate && (
            <section className="scan-panel">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-orange-600" />
                <h2 className="text-xl font-bold text-stone-900">
                  Extraction preview — review required
                </h2>
              </div>
              <p className="mt-2 text-sm text-stone-600">
                These are untrusted suggestions. Check every name and price against the photographs.
                You must confirm every entry before creating a private editable draft.
              </p>
              {!!session.candidate.document.sourceWarnings?.length && (
                <div
                  role="status"
                  className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
                >
                  <p className="font-semibold">
                    {plural(session.candidate.document.sourceWarnings.length, "page")} could not be
                    read in full. The other pages are below.
                  </p>
                  <ul className="mt-1 list-disc pl-5">
                    {session.candidate.document.sourceWarnings.map((warning) => {
                      const source = session.sources.find((s) => s.id === warning.sourceId);
                      return (
                        <li key={warning.sourceId}>
                          {source ? "Page " + (source.pageIndex + 1) : "One page"}:{" "}
                          {warningHelp[warning.reason] ?? "it could not be read"}.
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-1">
                    Add the missing dishes by hand in Menu Studio, or start a new import with
                    clearer photos of those pages.
                  </p>
                </div>
              )}
              <Link
                href={"/dashboard/menu/import/" + encodeURIComponent(session.id) + "/review"}
                className="scan-action mt-4"
              >
                Open source-aware review →
              </Link>
              <div className="mt-5 space-y-5">
                {session.candidate.document.categories.map((c) => (
                  <div key={c.id} className="overflow-hidden rounded-xl border border-stone-200">
                    <h3 className="bg-stone-50 px-4 py-3 font-bold text-stone-900">
                      {c.name.value ?? "Unreadable heading"}
                    </h3>
                    {c.items.map((i) => (
                      <div
                        key={i.id}
                        className="flex justify-between gap-4 border-t border-stone-100 px-4 py-3 text-sm"
                      >
                        <span className="font-medium text-stone-800">
                          {i.name.value ?? "Unreadable dish"}
                        </span>
                        <span
                          className={
                            i.priceMinor.value === null
                              ? "font-semibold text-orange-700"
                              : "font-bold text-stone-900"
                          }
                        >
                          {i.priceMinor.value === null
                            ? "Confirm price"
                            : money(i.priceMinor.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
