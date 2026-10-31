"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { CornerDownLeft, LoaderCircle, RotateCw, Search, TriangleAlert } from "lucide-react";
import {
  buildDynamicEntries,
  buildStaticEntries,
  parsePaletteIndex,
  searchPalette,
  type PaletteEntry,
  type PaletteIndexData,
} from "@/modules/dashboard/palette-model";
import { askEmber } from "@/lib/ember-events";
import { NonRetryableError } from "@/lib/optimistic-commit";
import { useOptimisticCommit } from "@/lib/use-optimistic-commit";
import { useReturnFocus } from "@/lib/use-return-focus";
import { useSoundPreference } from "@/lib/use-sound-preference";
import { WorkspaceIcon } from "./workspace-icons";
import { useWorkspaceShell } from "./workspace-shell";

const INDEX_TTL_MS = 60_000;

type Failure = { message: string; retry: (() => void) | null };

/**
 * Ctrl/Cmd+K command palette: pages, actions, dishes, orders, tables and (when enabled) Ember.
 * Accessible combobox + listbox, no extra dependency. The index is fetched once per open and
 * filtered locally, so typing never causes a request. "Mark sold out" keeps the palette open
 * and shows "Saving…" until the server confirms, then rolls back with a Retry if it fails.
 */
export function CommandPalette() {
  const router = useRouter();
  const {
    paletteOpen,
    setPaletteOpen,
    setDrawerOpen,
    capabilities,
    menuWrite,
    assistantEnabled,
    scope,
    modKey,
  } = useWorkspaceShell();
  const { preference, setEnabled } = useSoundPreference();
  const { run: commit } = useOptimisticCommit();
  const returnFocus = useReturnFocus();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [index, setIndex] = useState<PaletteIndexData | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<Record<string, true>>({});
  const [failure, setFailure] = useState<Failure | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const fetchedAt = useRef(0);
  const fetchedFor = useRef<string | null>(null);
  const outletId = scope?.outletId ?? null;

  // Fetch (or refresh) the index each time the palette opens, at most once a minute.
  useEffect(() => {
    if (!paletteOpen || !outletId) return;
    const stale = fetchedFor.current !== outletId || Date.now() - fetchedAt.current > INDEX_TTL_MS;
    if (!stale) return;
    const abort = new AbortController();
    const start = window.setTimeout(() => setLoading(true), 0);
    void (async () => {
      try {
        const response = await fetch("/api/dashboard/palette", {
          cache: "no-store",
          credentials: "same-origin",
          signal: abort.signal,
        });
        if (!response.ok) throw new Error("palette index failed");
        const parsed = parsePaletteIndex(await response.json(), outletId);
        if (!parsed) throw new Error("invalid palette index");
        setIndex(parsed);
        fetchedAt.current = Date.now();
        fetchedFor.current = outletId;
      } catch {
        if (!abort.signal.aborted) {
          const down = { state: "unavailable", data: null } as const;
          setIndex({ dishes: down, tables: down, orders: down });
        }
      } finally {
        if (!abort.signal.aborted) setLoading(false);
      }
    })();
    return () => {
      window.clearTimeout(start);
      abort.abort();
    };
  }, [paletteOpen, outletId]);

  const flags = useMemo(
    () => ({ capabilities, menuWrite, assistantEnabled }),
    [capabilities, menuWrite, assistantEnabled]
  );
  const statics = useMemo(() => buildStaticEntries(flags), [flags]);
  const dynamics = useMemo(() => {
    const entries = index ? buildDynamicEntries(index, flags) : [];
    // A dish whose change is in flight must not claim the final state or accept another toggle.
    return entries.map((entry): PaletteEntry => {
      if (entry.command.kind !== "toggle-dish") return entry;
      const dish = entry.command.dish;
      if (!pending[dish.menuId + ":" + dish.id]) return entry;
      return {
        ...entry,
        label: "Saving " + dish.name + "…",
        status: { tone: "neutral", text: "Saving…" },
        disabled: true,
      };
    });
  }, [index, flags, pending]);
  const sections = useMemo(
    () => searchPalette(query, statics, dynamics, flags),
    [query, statics, dynamics, flags]
  );
  const options = useMemo(() => sections.flatMap((section) => section.entries), [sections]);
  const optionId = (entry: PaletteEntry) => listId + "-" + entry.id.replace(/[^A-Za-z0-9_-]/g, "_");
  const current = options[Math.min(active, Math.max(options.length - 1, 0))];

  useEffect(() => {
    if (!current) return;
    document.getElementById(optionId(current))?.scrollIntoView?.({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  const toggleDish = useCallback(
    async (entry: PaletteEntry) => {
      if (entry.command.kind !== "toggle-dish" || !scope) return;
      const dish = entry.command.dish;
      const key = dish.menuId + ":" + dish.id;
      const soldOut = !dish.soldOut;
      setFailure(null);
      await commit<boolean>(key, {
        apply: () => setPending((previous) => ({ ...previous, [key]: true })),
        rollback: () =>
          setPending((previous) => {
            const next = { ...previous };
            delete next[key];
            return next;
          }),
        commit: async () => {
          const response = await fetch(
            "/api/organizations/" +
              encodeURIComponent(scope.organizationId) +
              "/outlets/" +
              encodeURIComponent(scope.outletId) +
              "/menu/quick-availability",
            {
              method: "POST",
              credentials: "same-origin",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ menuId: dish.menuId, dishId: dish.id, soldOut }),
            }
          );
          if (response.status === 403)
            throw new NonRetryableError("Your role cannot change dish availability.");
          if (!response.ok) throw new Error("Availability could not be saved.");
          return soldOut;
        },
        onSuccess: (confirmed) => {
          setPending((previous) => {
            const next = { ...previous };
            delete next[key];
            return next;
          });
          setIndex((previous) =>
            previous?.dishes?.state === "ready"
              ? {
                  ...previous,
                  dishes: {
                    state: "ready",
                    data: previous.dishes.data.map((row) =>
                      row.id === dish.id && row.menuId === dish.menuId
                        ? { ...row, soldOut: confirmed }
                        : row
                    ),
                  },
                }
              : previous
          );
          setAnnouncement(
            dish.name + (confirmed ? " marked sold out." : " restored as available.")
          );
        },
        failureTitle: "Couldn’t update " + dish.name,
        onFailure: ({ message, retry }) =>
          setFailure({ message: message + " The dish is back to its previous status.", retry }),
      });
    },
    [commit, scope]
  );

  function execute(entry: PaletteEntry | undefined) {
    if (!entry || entry.disabled) return;
    const command = entry.command;
    if (command.kind === "toggle-dish") {
      void toggleDish(entry);
    } else if (command.kind === "navigate") {
      setPaletteOpen(false);
      router.push(command.href);
    } else if (command.kind === "ember") {
      setPaletteOpen(false);
      askEmber(command.prompt);
    } else if (command.id === "open-notifications") {
      setPaletteOpen(false);
      setDrawerOpen(true);
    } else {
      setEnabled(!preference.enabled);
      setAnnouncement(preference.enabled ? "Order sound turned off." : "Order sound turned on.");
    }
  }

  const notes: string[] = [];
  if (index?.dishes?.state === "unavailable") notes.push("dishes");
  if (index?.orders?.state === "unavailable") notes.push("orders");
  if (index?.tables?.state === "unavailable") notes.push("tables");

  return (
    <Dialog.Root
      open={paletteOpen}
      onOpenChange={(open) => {
        setPaletteOpen(open);
        if (open) {
          setQuery("");
          setActive(0);
          setFailure(null);
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="mm-sheet-overlay" />
        <Dialog.Content
          className="mm-palette"
          aria-describedby="mm-palette-description"
          onOpenAutoFocus={(event) => {
            returnFocus.onOpenAutoFocus();
            event.preventDefault();
            inputRef.current?.focus();
          }}
          onCloseAutoFocus={returnFocus.onCloseAutoFocus}
        >
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <Dialog.Description id="mm-palette-description" className="sr-only">
            Search pages, dishes, orders and tables, or run a command. Use the arrow keys to move
            and Enter to choose.
          </Dialog.Description>
          <div className="mm-palette-input">
            <Search size={18} aria-hidden="true" />
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={current ? optionId(current) : undefined}
              aria-label="Search or run a command"
              placeholder="Search dishes, orders, tables, pages… or type a command"
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
                setAnnouncement("");
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  if (options.length) setActive((i) => (i + 1) % options.length);
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  if (options.length) setActive((i) => (i - 1 + options.length) % options.length);
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  execute(current);
                }
              }}
            />
            {loading && <LoaderCircle className="animate-spin" size={16} aria-hidden="true" />}
          </div>

          <div id={listId} role="listbox" aria-label="Results" className="mm-palette-list">
            {sections.map((section) => (
              <div
                key={section.group}
                role="group"
                aria-labelledby={listId + "-g-" + section.group}
                className="mm-palette-group"
              >
                <div id={listId + "-g-" + section.group} className="mm-palette-group-label">
                  {section.label}
                </div>
                {section.entries.map((entry) => {
                  const isActive = current?.id === entry.id;
                  return (
                    <div
                      key={entry.id}
                      id={optionId(entry)}
                      role="option"
                      aria-selected={isActive}
                      aria-disabled={entry.disabled || undefined}
                      className={"mm-palette-option" + (isActive ? " is-active" : "")}
                      onMouseMove={() => {
                        const position = options.findIndex((option) => option.id === entry.id);
                        if (position >= 0 && position !== active) setActive(position);
                      }}
                      onClick={() => execute(entry)}
                    >
                      <WorkspaceIcon name={entry.icon} size={18} />
                      <span className="mm-palette-option-text">
                        <strong>{entry.label}</strong>
                        {entry.detail && <small>{entry.detail}</small>}
                      </span>
                      {entry.status && (
                        <span className="mm-palette-status" data-tone={entry.status.tone}>
                          {entry.status.text}
                        </span>
                      )}
                      {isActive && !entry.disabled && (
                        <CornerDownLeft size={14} aria-hidden="true" className="mm-palette-enter" />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            {options.length === 0 && (
              <p className="mm-palette-empty">
                {loading
                  ? "Loading dishes, orders and tables…"
                  : "No matches. Try a dish, an order number like #42, a table or a page."}
              </p>
            )}
          </div>

          {failure && (
            <div className="mm-palette-failure" role="alert">
              <TriangleAlert size={16} aria-hidden="true" />
              <span>{failure.message}</span>
              {failure.retry && (
                <button type="button" className="mm-icon-button" onClick={failure.retry}>
                  <RotateCw size={14} aria-hidden="true" /> Retry
                </button>
              )}
            </div>
          )}
          {notes.length > 0 && (
            <p className="mm-palette-note" role="status">
              Search for {notes.join(", ")} is unavailable right now. Pages and actions still work.
            </p>
          )}

          <footer className="mm-palette-footer" aria-hidden="true">
            <span>
              <kbd>↑</kbd>
              <kbd>↓</kbd> move
            </span>
            <span>
              <kbd>Enter</kbd> choose
            </span>
            <span>
              <kbd>Esc</kbd> close
            </span>
            <span className="mm-palette-footer-end">
              <kbd>{modKey}</kbd>
              <kbd>K</kbd> toggle
            </span>
          </footer>
          <p className="sr-only" role="status" aria-live="polite">
            {announcement ||
              (query ? (options.length === 1 ? "1 result" : options.length + " results") : "")}
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
