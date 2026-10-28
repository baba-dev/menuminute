"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, ChefHat, LoaderCircle, Search, UtensilsCrossed, X } from "lucide-react";
import { resolveCurrentStock, type AvailabilityMenuDetail } from "./availability-contract";

export type AvailabilityDish = {
  id: string;
  menuId: string;
  menuName: string;
  name: string;
  category: string;
  imageSrc: string;
  soldOut: boolean;
  /** A menu schedule or modifier can prevent ordering independently of stock status. */
  hasOtherRestrictions: boolean;
};

/** Changes availability in the published menu without saving or publishing private draft edits. */
export function DishAvailabilityDialog({
  items,
  outletId,
  outletName,
  canManage,
}: {
  items: AvailabilityDish[] | null;
  outletId: string;
  outletName: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmedChanges, setConfirmedChanges] = useState<Record<string, boolean>>({});
  const dishes = useMemo(
    () =>
      items?.map((dish) => ({
        ...dish,
        soldOut: confirmedChanges[dish.menuId + ":" + dish.id] ?? dish.soldOut,
      })) ?? null,
    [items, confirmedChanges]
  );
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "available" | "sold-out">("all");
  const [menu, setMenu] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const menus = useMemo(() => {
    const unique = new Map((dishes ?? []).map((dish) => [dish.menuId, dish.menuName]));
    return [...unique.entries()];
  }, [dishes]);
  const totals = useMemo(
    () => ({
      total: dishes?.length ?? 0,
      available: dishes?.filter((dish) => !dish.soldOut).length ?? 0,
      soldOut: dishes?.filter((dish) => dish.soldOut).length ?? 0,
    }),
    [dishes]
  );

  const shown = useMemo(
    () =>
      (dishes ?? []).filter((dish) => {
        if (menu !== "all" && dish.menuId !== menu) return false;
        if (filter === "available" && dish.soldOut) return false;
        if (filter === "sold-out" && !dish.soldOut) return false;
        const term = query.trim().toLocaleLowerCase();
        return (
          !term ||
          [dish.name, dish.category, dish.menuName].some((word) =>
            word.toLocaleLowerCase().includes(term)
          )
        );
      }),
    [dishes, filter, menu, query]
  );

  async function toggle(dish: AvailabilityDish) {
    if (!canManage || busy || dish.menuId === "legacy") return;
    const key = dish.menuId + ":" + dish.id;
    setBusy(key);
    setError("");
    setNotice("");
    try {
      const path = "/api/catalog/" + encodeURIComponent(dish.menuId);
      const read = await fetch(path, { cache: "no-store", credentials: "same-origin" });
      if (!read.ok) throw new Error("Could not check the latest dish status. Refresh and retry.");
      const detail = (await read.json()) as AvailabilityMenuDetail;
      if (detail.canWrite !== true) throw new Error("Your account cannot change this menu.");
      if (!Number.isInteger(detail.revision)) throw new Error("Menu revision unavailable.");
      const current = resolveCurrentStock(detail, dish, outletId);
      if (current.soldOut !== dish.soldOut) {
        router.refresh();
        throw new Error("Another staff member changed this dish. Refresh and try again.");
      }
      const soldOut = !current.soldOut;
      const write = await fetch(path, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key: crypto.randomUUID(),
          expectedRevision: detail.revision,
          action: "override",
          data: {
            outletId,
            dishId: dish.id,
            priceMinor: current.priceMinor,
            soldOut,
          },
        }),
      });
      if (!write.ok) {
        throw new Error(
          write.status === 409
            ? "The menu changed while saving. Refresh and retry."
            : "Availability could not be saved. Your menu was not changed."
        );
      }
      setConfirmedChanges((previous) => ({ ...previous, [key]: soldOut }));
      setNotice(dish.name + (soldOut ? " marked sold out." : " restored as available."));
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Availability update failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && busy) return;
        setOpen(next);
        if (next) {
          setConfirmedChanges({});
          setQuery("");
          setFilter("all");
          setMenu("all");
          setError("");
          setNotice("");
          router.refresh();
        }
      }}
    >
      <Dialog.Trigger asChild>
        <button type="button" className="mm-dashboard-button mm-dashboard-button--secondary">
          <UtensilsCrossed size={17} aria-hidden="true" /> Dish Availability
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="mm-availability-overlay" />
        <Dialog.Content
          className="mm-availability-dialog"
          aria-describedby="mm-availability-description"
        >
          <header className="mm-availability-header">
            <div className="mm-availability-heading">
              <span className="mm-dashboard-eyebrow">{outletName} · Published dishes</span>
              <Dialog.Title>Dish Availability</Dialog.Title>
              <Dialog.Description id="mm-availability-description">
                Tap a dish to mark it sold out or available for guests.
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="mm-availability-close"
              aria-label="Close Dish Availability"
              disabled={Boolean(busy)}
            >
              <X size={21} aria-hidden="true" />
            </Dialog.Close>
          </header>

          <div className="mm-availability-stats" aria-label="Dish availability totals">
            <div>
              <strong>{totals.total}</strong>
              <span>Total dishes</span>
            </div>
            <div>
              <strong className="is-available">{totals.available}</strong>
              <span>Available</span>
            </div>
            <div>
              <strong className="is-sold-out">{totals.soldOut}</strong>
              <span>Sold out</span>
            </div>
          </div>
          {dishes && dishes.length > 0 && (
            <div className="mm-availability-tools">
              <label className="mm-availability-search">
                <Search size={18} aria-hidden="true" />
                <span className="sr-only">Search dishes</span>
                <input
                  type="search"
                  placeholder="Search dishes or categories"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              {menus.length > 1 && (
                <label className="mm-availability-menu-select">
                  <span className="sr-only">Select menu</span>
                  <select value={menu} onChange={(event) => setMenu(event.target.value)}>
                    <option value="all">All menus</option>
                    {menus.map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div
                className="mm-availability-filters"
                role="group"
                aria-label="Filter dishes by availability"
              >
                {(
                  [
                    ["all", "All dishes"],
                    ["available", "Available"],
                    ["sold-out", "Sold out"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={filter === value}
                    className={filter === value ? "is-selected" : ""}
                    onClick={() => setFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {(error || notice) && (
            <div
              role={error ? "alert" : "status"}
              aria-live={error ? "assertive" : "polite"}
              className={"mm-availability-feedback" + (error ? " is-error" : "")}
            >
              {error || notice}
            </div>
          )}
          <div className="mm-availability-scroll">
            {!dishes?.length ? (
              <div className="mm-availability-empty">
                <span className="mm-availability-empty-art" aria-hidden="true">
                  <Image
                    className="mm-availability-empty-art--light"
                    src="/brand/dashboard/editorial/dish-availability-empty-light.svg"
                    alt=""
                    width={240}
                    height={180}
                  />
                  <Image
                    className="mm-availability-empty-art--dark"
                    src="/brand/dashboard/editorial/dish-availability-empty-dark.svg"
                    alt=""
                    width={240}
                    height={180}
                  />
                </span>
                <ChefHat size={26} aria-hidden="true" />
                <h3>No published dishes yet</h3>
                <p>Publish your first menu to manage what guests can order.</p>
                <Link href="/dashboard/menu" onClick={() => setOpen(false)}>
                  Open Menu Studio
                </Link>
              </div>
            ) : shown.length === 0 ? (
              <div className="mm-availability-no-results">
                <Search size={27} aria-hidden="true" />
                <p>No dishes match your filters.</p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setFilter("all");
                    setMenu("all");
                  }}
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="mm-availability-grid">
                {shown.map((dish) => {
                  const key = dish.menuId + ":" + dish.id;
                  const updating = busy === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      className={"mm-availability-dish" + (dish.soldOut ? " is-sold-out" : "")}
                      disabled={!canManage || busy !== null || dish.menuId === "legacy"}
                      onClick={() => void toggle(dish)}
                      aria-label={
                        (dish.soldOut ? "Restore " : "Mark sold out ") +
                        dish.name +
                        " in " +
                        dish.menuName
                      }
                      aria-pressed={dish.soldOut}
                    >
                      <span className="mm-availability-photo">
                        <Image
                          src={dish.imageSrc}
                          alt=""
                          fill
                          sizes="(max-width: 480px) 42vw, (max-width: 850px) 28vw, 190px"
                        />
                        {updating && (
                          <span className="mm-availability-saving">
                            <LoaderCircle className="animate-spin" aria-hidden="true" />
                          </span>
                        )}
                      </span>
                      <span className="mm-availability-copy">
                        <strong>{dish.name}</strong>
                        <small>
                          {dish.category}
                          {menus.length > 1 ? " · " + dish.menuName : ""}
                        </small>
                        <span
                          className={
                            "mm-availability-status" + (dish.soldOut ? " is-sold-out" : "")
                          }
                        >
                          <i aria-hidden="true" />
                          {updating ? "Saving…" : dish.soldOut ? "Sold out" : "Available"}
                          {!updating && !dish.soldOut && <Check size={13} aria-hidden="true" />}
                        </span>
                        {dish.hasOtherRestrictions && !dish.soldOut && (
                          <small className="mm-availability-caveat">
                            Schedule or options may limit ordering
                          </small>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <footer className="mm-availability-footer">
            <span>
              Availability is outlet-specific. Kitchen stock is not automatically verified.
            </span>
            {!canManage && <strong>View only · menu access required to change dishes</strong>}
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
