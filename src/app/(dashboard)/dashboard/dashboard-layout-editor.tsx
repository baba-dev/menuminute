"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Eye,
  EyeOff,
  LoaderCircle,
  LayoutGrid,
  Pin,
  PinOff,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";
import {
  applyLayoutAction,
  dashboardWidgetLabels,
  resolveDashboardLayout,
  type DashboardLayout,
  type DashboardWidgetId,
  type LayoutAction,
} from "@/modules/dashboard/layout";
import { useOptimisticCommit } from "@/lib/use-optimistic-commit";

const SAVE_DELAY_MS = 400;
type SaveState = "idle" | "saving" | "saved" | "failed";

/** CSS is generated only from the closed widget-id enum, never from user text. */
export function layoutStyles(layout: DashboardLayout) {
  return resolveDashboardLayout(layout)
    .map((widget, index) => {
      const selector = `.mm-widget[data-widget="${widget.id}"]`;
      const hidden = widget.hidden ? `${selector}{display:none}` : "";
      const pinned = widget.pinned
        ? `${selector}::before{content:"Pinned";display:block;margin-bottom:6px;color:var(--muted);font-size:12px;font-weight:800}`
        : "";
      return `${selector}{order:${index}}${hidden}${pinned}`;
    })
    .join("");
}

export function DashboardLayoutEditor({
  initialLayout,
  presentWidgets,
}: {
  initialLayout: DashboardLayout;
  /** Widgets the server rendered into the page (hidden ones are not loaded). */
  presentWidgets: readonly DashboardWidgetId[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [layout, setLayout] = useState(initialLayout);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const latest = useRef(initialLayout);
  const confirmed = useRef(initialLayout);
  const saving = useRef(false);
  const timer = useRef<number | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const flushAgain = useRef<() => void>(() => undefined);
  const { run } = useOptimisticCommit();

  const flush = useCallback(async () => {
    if (saving.current) return;
    const payload = latest.current;
    if (payload === confirmed.current) return;
    saving.current = true;
    await run<DashboardLayout>("layout", {
      // Also runs on the toast's Retry, so it re-establishes the intended layout in the UI.
      apply: () => {
        saving.current = true;
        latest.current = payload;
        setLayout(payload);
        setSaveState("saving");
        setError("");
      },
      commit: async () => {
        const response = await fetch("/api/account/dashboard-layout", {
          method: "PUT",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error("Your layout could not be saved to your account.");
        return payload;
      },
      onSuccess: (saved) => {
        saving.current = false;
        confirmed.current = saved;
        setSaveState(latest.current === saved ? "saved" : "saving");
        // Re-render on the server so newly shown widgets load and hidden ones stay unloaded.
        router.refresh();
        if (latest.current !== saved) flushAgain.current();
      },
      rollback: () => {
        saving.current = false;
        latest.current = confirmed.current;
        setLayout(confirmed.current);
      },
      failureTitle: "Couldn’t save your layout",
      onFailure: ({ message }) => {
        setSaveState("failed");
        setError(message + " Your previous layout is restored.");
      },
    });
  }, [router, run]);

  useEffect(() => {
    flushAgain.current = () => void flush();
  }, [flush]);

  // Don't lose a change made just before leaving: flush when the page is hidden or unloaded.
  // `keepalive` lets the request outlive the page; failures here are best-effort by nature.
  useEffect(() => {
    const flushOnLeave = () => {
      if (latest.current === confirmed.current) return;
      if (timer.current) window.clearTimeout(timer.current);
      void fetch("/api/account/dashboard-layout", {
        method: "PUT",
        keepalive: true,
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(latest.current),
      }).catch(() => undefined);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushOnLeave();
    };
    window.addEventListener("pagehide", flushOnLeave);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flushOnLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  function saveNow() {
    if (timer.current) window.clearTimeout(timer.current);
    void flush();
  }

  function change(action: LayoutAction, describe: (next: DashboardLayout) => string) {
    const next = applyLayoutAction(latest.current, action);
    if (next === latest.current) return;
    latest.current = next;
    setLayout(next);
    setSaveState("saving");
    setAnnouncement(describe(next));
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), SAVE_DELAY_MS);
  }

  const rows = useMemo(() => resolveDashboardLayout(layout), [layout]);
  const style = useMemo(() => layoutStyles(layout), [layout]);

  function positionText(next: DashboardLayout, id: DashboardWidgetId) {
    const order = resolveDashboardLayout(next);
    return `${dashboardWidgetLabels[id]} is now position ${
      order.findIndex((widget) => widget.id === id) + 1
    } of ${order.length}.`;
  }

  return (
    <>
      <style>{style}</style>
      <div className="mm-dashboard-hero-tools">
        <button
          ref={trigger}
          type="button"
          className="mm-dashboard-button mm-dashboard-button--secondary"
          aria-expanded={open}
          aria-controls="mm-layout-editor"
          onClick={() => setOpen((value) => !value)}
        >
          <LayoutGrid size={17} aria-hidden="true" /> Customize layout
        </button>
      </div>
      {open && (
        <section
          id="mm-layout-editor"
          className="mm-layout-editor"
          aria-labelledby="mm-layout-title"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              saveNow();
              setOpen(false);
              trigger.current?.focus();
            }
          }}
        >
          <div>
            <h2 id="mm-layout-title">Customize your overview</h2>
            <p>
              Reorder, pin or hide sections. Pinned sections stay at the top. Changes are saved to
              your account and follow you across devices.
            </p>
          </div>
          <ol className="mm-layout-list">
            {rows.map((widget, index) => {
              const label = dashboardWidgetLabels[widget.id];
              const group = rows.filter((row) => row.pinned === widget.pinned);
              const position = group.findIndex((row) => row.id === widget.id);
              return (
                <li
                  key={widget.id}
                  className="mm-layout-row"
                  data-hidden={widget.hidden}
                  aria-label={`${label}, position ${index + 1} of ${rows.length}`}
                >
                  <span className="mm-layout-row-name">
                    {label}
                    {widget.pinned && (
                      <span className="mm-layout-row-state">
                        <Pin size={13} aria-hidden="true" /> Pinned
                      </span>
                    )}
                    {widget.hidden && (
                      <span className="mm-layout-row-state">
                        <EyeOff size={13} aria-hidden="true" /> Hidden
                      </span>
                    )}
                    {!widget.hidden && !presentWidgets.includes(widget.id) && (
                      <span className="mm-layout-row-state">
                        <LoaderCircle className="animate-spin" size={13} aria-hidden="true" />{" "}
                        Loading
                      </span>
                    )}
                  </span>
                  <span className="mm-layout-row-actions">
                    <button
                      type="button"
                      className="mm-icon-button"
                      disabled={position === 0}
                      aria-label={`Move ${label} up`}
                      onClick={() =>
                        change({ type: "move", id: widget.id, direction: -1 }, (next) =>
                          positionText(next, widget.id)
                        )
                      }
                    >
                      <ArrowUp size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="mm-icon-button"
                      disabled={position === group.length - 1}
                      aria-label={`Move ${label} down`}
                      onClick={() =>
                        change({ type: "move", id: widget.id, direction: 1 }, (next) =>
                          positionText(next, widget.id)
                        )
                      }
                    >
                      <ArrowDown size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="mm-icon-button"
                      aria-pressed={widget.pinned}
                      aria-label={`${widget.pinned ? "Unpin" : "Pin"} ${label}`}
                      onClick={() =>
                        change({ type: "togglePinned", id: widget.id }, (next) =>
                          next.pinned.includes(widget.id)
                            ? `${label} pinned to the top.`
                            : `${label} unpinned.`
                        )
                      }
                    >
                      {widget.pinned ? (
                        <PinOff size={16} aria-hidden="true" />
                      ) : (
                        <Pin size={16} aria-hidden="true" />
                      )}
                      {widget.pinned ? "Unpin" : "Pin"}
                    </button>
                    <button
                      type="button"
                      className="mm-icon-button"
                      aria-pressed={widget.hidden}
                      aria-label={`${widget.hidden ? "Show" : "Hide"} ${label}`}
                      onClick={() =>
                        change({ type: "toggleHidden", id: widget.id }, (next) =>
                          next.hidden.includes(widget.id) ? `${label} hidden.` : `${label} shown.`
                        )
                      }
                    >
                      {widget.hidden ? (
                        <Eye size={16} aria-hidden="true" />
                      ) : (
                        <EyeOff size={16} aria-hidden="true" />
                      )}
                      {widget.hidden ? "Show" : "Hide"}
                    </button>
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="mm-layout-footer">
            <span className="mm-layout-save-state" role="status">
              {saveState === "saving" && (
                <>
                  <LoaderCircle className="animate-spin" size={15} aria-hidden="true" /> Saving…
                </>
              )}
              {saveState === "saved" && (
                <>
                  <Check size={15} aria-hidden="true" /> Saved to your account
                </>
              )}
              {saveState === "failed" && (
                <>
                  <TriangleAlert size={15} aria-hidden="true" /> {error}
                </>
              )}
            </span>
            <span className="mm-layout-row-actions">
              <button
                type="button"
                className="mm-icon-button"
                onClick={() => change({ type: "reset" }, () => "Layout reset to the default.")}
              >
                <RotateCcw size={16} aria-hidden="true" /> Reset
              </button>
              <button
                type="button"
                className="mm-icon-button"
                onClick={() => {
                  saveNow();
                  setOpen(false);
                  trigger.current?.focus();
                }}
              >
                Done
              </button>
            </span>
          </div>
          <p className="sr-only" role="status" aria-live="polite">
            {announcement}
          </p>
        </section>
      )}
    </>
  );
}
