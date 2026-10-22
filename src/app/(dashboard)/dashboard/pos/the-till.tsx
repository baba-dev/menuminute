"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  BookOpenText,
  ClipboardCheck,
  Minus,
  Plus,
  RefreshCcw,
  Search,
  Settings2,
  ShoppingBasket,
  X,
} from "lucide-react";
import type { PosWorkspace, PosSaleResult } from "@/modules/pos/service";
import type { QuoteInput } from "@/modules/orders/quote";

type Menu = PosWorkspace["menus"][number];
type Dish = Menu["categories"][number]["items"][number];
type Line = QuoteInput["lines"][number];
type CartLine = {
  id: string;
  line: Line;
  name: string;
  variantName: string | null;
  unitMinor: number;
};
type AttachOrder = PosWorkspace["attachable"][number];

function money(minor: number | string, currency: string) {
  const precision =
    new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
      .maximumFractionDigits ?? 2;
  const amount = Number(minor) / 10 ** precision;
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
}
async function json<T>(response: Response): Promise<T> {
  const result = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      result?.message ??
        (response.status === 409
          ? "Another operator changed this order. Refresh and retry."
          : "The request failed.")
    );
  return result as T;
}

export function TheTill({
  organizationId,
  outletId,
  initial,
}: {
  organizationId: string;
  outletId: string;
  initial: PosWorkspace;
}) {
  const endpoint =
    "/api/organizations/" +
    encodeURIComponent(organizationId) +
    "/outlets/" +
    encodeURIComponent(outletId) +
    "/pos";
  const [workspace, setWorkspace] = useState(initial);
  const [selectedMenu, setSelectedMenu] = useState(initial.menus[0]?.id ?? "");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [dish, setDish] = useState<Dish | null>(null);
  const [variant, setVariant] = useState("");
  const [groups, setGroups] = useState<Record<string, string[]>>({});
  const [customer, setCustomer] = useState("");
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<"dine_in" | "pickup">(
    initial.context.fulfillmentModes.includes("pickup") ? "pickup" : "dine_in"
  );
  const [tableId, setTableId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<PosSaleResult | null>(null);
  const [editingSettings, setEditingSettings] = useState(!initial.context.enabled);
  const seller = workspace.context.seller;
  const [legalName, setLegalName] = useState(seller?.legalName ?? initial.context.outletName);
  const [address, setAddress] = useState(seller?.registeredAddress ?? "");
  const [taxRegime, setTaxRegime] = useState<"unconfigured" | "not_registered" | "requires_review">(
    seller?.taxRegime ?? "unconfigured"
  );
  const [taxRegistration, setTaxRegistration] = useState(seller?.taxRegistration ?? "");
  const commandRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const attachKeys = useRef<Record<string, string>>({});
  const menu = workspace.menus.find((m) => m.id === selectedMenu) ?? workspace.menus[0];
  const currency = workspace.context.currency;
  const dishes = useMemo(
    () =>
      menu?.categories
        .filter((c) => !category || c.id === category)
        .flatMap((c) =>
          c.items.filter((i) => i.name.toLowerCase().includes(search.trim().toLowerCase()))
        ) ?? [],
    [menu, category, search]
  );
  const subtotal = cart.reduce((sum, c) => sum + BigInt(c.unitMinor) * BigInt(c.line.quantity), 0n);
  const canCheckout = workspace.context.enabled && menu?.open && cart.length > 0 && !busy;

  async function refresh() {
    const fresh = await json<PosWorkspace>(await fetch(endpoint, { cache: "no-store" }));
    setWorkspace(fresh);
    if (!fresh.menus.some((m) => m.id === selectedMenu)) setSelectedMenu(fresh.menus[0]?.id ?? "");
  }
  async function configure(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setBusy(true);
    try {
      await json(
        await fetch(endpoint + "/settings", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            expectedRevision: workspace.context.revision,
            enabled: true,
            legalName,
            registeredAddress: address,
            country: workspace.context.country,
            taxRegime,
            taxRegistration: taxRegistration || null,
          }),
        })
      );
      await refresh();
      setEditingSettings(false);
      setMessage(
        "The Till is enabled for unpaid, pre-tax order recording. No tax invoice or payment collection is enabled."
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to save settings.");
    } finally {
      setBusy(false);
    }
  }
  function openDish(item: Dish) {
    if (item.soldOut || !item.open) return;
    setDish(item);
    setVariant("");
    setGroups({});
    setMessage("");
  }
  function choose(groupId: string, optionId: string, maximum: number) {
    setGroups((old) => {
      const values = old[groupId] ?? [];
      const next = values.includes(optionId)
        ? values.filter((id) => id !== optionId)
        : maximum === 1
          ? [optionId]
          : values.length < maximum
            ? [...values, optionId]
            : values;
      return { ...old, [groupId]: next };
    });
  }
  function addDish() {
    if (!dish || !menu) return;
    const selectedVariant = dish.variants.find((v) => v.id === variant);
    if (dish.variants.length && !selectedVariant) return setMessage("Select a variant.");
    const selectedGroups = dish.addOnGroups.map((g) => ({
      groupId: g.id,
      optionIds: groups[g.id] ?? [],
    }));
    if (dish.addOnGroups.some((g) => (groups[g.id] ?? []).length < g.min))
      return setMessage("Complete the required add-ons.");
    const optionsMinor = dish.addOnGroups.reduce(
      (s, g) =>
        s +
        g.options
          .filter((o) => (groups[g.id] ?? []).includes(o.id))
          .reduce((v, o) => v + o.priceMinor, 0),
      0
    );
    const unitMinor = (selectedVariant?.priceMinor ?? dish.priceMinor) + optionsMinor;
    const line: Line = {
      dishId: dish.id,
      variantId: selectedVariant?.id ?? null,
      groups: selectedGroups,
      quantity: 1,
    };
    setCart((prev) =>
      prev.length >= 50
        ? prev
        : [
            ...prev,
            {
              id: crypto.randomUUID(),
              line,
              name: dish.name,
              variantName: selectedVariant?.name ?? null,
              unitMinor,
            },
          ]
    );
    commandRef.current = null;
    setDish(null);
    setMessage("");
  }
  function changeQty(id: string, delta: number) {
    setCart((prev) =>
      prev.flatMap((c) =>
        c.id === id
          ? c.line.quantity + delta <= 0
            ? []
            : [{ ...c, line: { ...c.line, quantity: Math.min(99, c.line.quantity + delta) } }]
          : [c]
      )
    );
    commandRef.current = null;
  }
  async function submit() {
    if (!menu || !canCheckout) return;
    setBusy(true);
    setMessage("");
    setSuccess(null);
    const payload = {
      selection: {
        menuId: menu.id,
        expectedRevision: menu.revision,
        lines: cart.map((c) => c.line),
      },
      fulfillmentMode: mode,
      tableId: mode === "dine_in" ? tableId || null : null,
      customerName: customer,
      notes: note,
      expectedSubtotalMinor: subtotal.toString(),
    };
    const fingerprint = JSON.stringify(payload);
    if (!commandRef.current || commandRef.current.fingerprint !== fingerprint)
      commandRef.current = { fingerprint, key: crypto.randomUUID() };
    try {
      const result = await json<PosSaleResult>(
        await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "submit",
            input: { ...payload, key: commandRef.current.key },
          }),
        })
      );
      setSuccess(result);
      setCart([]);
      commandRef.current = null;
      await refresh();
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Order was not confirmed. Retry with the same cart to recover it."
      );
    } finally {
      setBusy(false);
    }
  }
  async function attach(order: AttachOrder) {
    setBusy(true);
    setMessage("");
    setSuccess(null);
    attachKeys.current[order.orderId] ??= crypto.randomUUID();
    try {
      const result = await json<PosSaleResult>(
        await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "attach",
            input: { key: attachKeys.current[order.orderId], orderId: order.orderId },
          }),
        })
      );
      setSuccess(result);
      delete attachKeys.current[order.orderId];
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to attach this ticket.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="till-page">
      <header className="till-heading">
        <div>
          <span className="till-eyebrow">MENUMINUTE / THE TILL</span>
          <h1>Service, meet settlement.</h1>
          <p>
            Record staff orders and link eligible tickets to a private draft sale. Payment and
            fiscal issue are not enabled yet.
          </p>
        </div>
        <div className="till-heading-actions">
          <Link href="/dashboard/pos/ledger">The Ledger <BookOpenText size={15} /></Link>
        <Link href="/dashboard/pos/closing">Closing Desk <ClipboardCheck size={15} /></Link>
        <Link href="/dashboard/orders">
            Service Counter <ArrowRight size={15} />
          </Link>
          <Link href="/kitchen">
            Kitchen <ArrowRight size={15} />
          </Link>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={busy}
            aria-label="Refresh Till"
          >
            <RefreshCcw size={17} />
          </button>
          {workspace.context.canConfigure && (
            <button
              type="button"
              onClick={() => setEditingSettings(!editingSettings)}
              aria-label="Seller settings"
            >
              <Settings2 size={17} />
            </button>
          )}
        </div>
      </header>
      <section className="till-status" aria-label="Financial status">
        <span>OUTLET · {workspace.context.outletName}</span>
        <strong>{workspace.context.enabled ? "DRAFT POS ACTIVE" : "POS DISABLED"}</strong>
        <span>TAX NOT CALCULATED · NO PAYMENT CAPTURE · NO INVOICE ISSUANCE</span>
      </section>
      {message && (
        <div role="alert" className="till-notice">
          {message}
        </div>
      )}
      {success && (
        <div role="status" className="till-success">
          <CheckCircle2 size={20} />
          <div>
            <strong>Recorded · Order #{success.orderNumber}</strong>
            <p>
              Sale {success.saleId} · {money(success.subtotalMinor, success.currency)} pre-tax. This
              is not a receipt or tax invoice. Follow through in Service Counter.
            </p>
          </div>
          <Link href="/dashboard/orders">View orders</Link>
        </div>
      )}
      {editingSettings && workspace.context.canConfigure && (
        <form className="till-settings" onSubmit={(e) => void configure(e)}>
          <div>
            <span className="till-eyebrow">SELLER IDENTITY · OWNER / ADMIN</span>
            <h2>Activate draft POS</h2>
            <p>
              Record genuine merchant identity. Tax profiles and legally issued documents are
              separately release-gated; selecting a status here is not tax certification.
            </p>
          </div>
          <label>
            Legal seller name
            <input
              required
              maxLength={160}
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
            />
          </label>
          <label>
            Registered seller address
            <textarea
              required
              minLength={5}
              maxLength={500}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </label>
          <label>
            Tax review status
            <select
              value={taxRegime}
              onChange={(e) => setTaxRegime(e.target.value as typeof taxRegime)}
            >
              <option value="unconfigured">Not configured</option>
              <option value="requires_review">Requires accountant review</option>
              <option value="not_registered">Merchant declares not registered (unverified)</option>
            </select>
          </label>
          <label>
            Tax registration, if any
            <input
              maxLength={64}
              value={taxRegistration}
              onChange={(e) => setTaxRegistration(e.target.value)}
            />
          </label>
          <button className="till-primary" type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save identity and enable draft orders"}
          </button>
        </form>
      )}
      {workspace.context.enabled && (
        <div className="till-layout">
          <section className="till-catalog" aria-label="Published menu">
            <div className="till-sectionhead">
              <div>
                <span className="till-eyebrow">01 / FAST ENTRY</span>
                <h2>Published menu</h2>
              </div>
              <span>{dishes.length} dishes</span>
            </div>
            <div className="till-tools">
              <select
                aria-label="Published menu"
                value={menu?.id ?? ""}
                onChange={(e) => {
                  if (cart.length) {
                    setMessage("Clear your current cart before switching menus.");
                    return;
                  }
                  setSelectedMenu(e.target.value);
                  setCategory("");
                }}
              >
                {workspace.menus.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · revision {m.revision}
                  </option>
                ))}
              </select>
              <label className="till-search">
                <Search size={17} />
                <input
                  aria-label="Find a dish"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Find a dish…"
                />
              </label>
            </div>
            <div className="till-categories">
              <button
                type="button"
                className={!category ? "active" : ""}
                onClick={() => setCategory("")}
              >
                All dishes
              </button>
              {menu?.categories.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  className={category === c.id ? "active" : ""}
                  onClick={() => setCategory(c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>
            {!menu?.open && (
              <p className="till-notice">This menu is outside its scheduled service window.</p>
            )}
            <div className="till-dishes">
              {dishes.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  disabled={item.soldOut || !item.open || !menu?.open || busy || cart.length >= 50}
                  onClick={() => openDish(item)}
                  className="till-dish"
                >
                  <strong>{item.name}</strong>
                  <span>
                    {item.soldOut
                      ? "Sold out"
                      : !item.open
                        ? "Outside service"
                        : money(item.variants[0]?.priceMinor ?? item.priceMinor, currency)}
                  </span>
                  <Plus size={18} />
                </button>
              ))}
            </div>
            {!dishes.length && (
              <p className="till-empty">No dishes found. Publish a menu or adjust the search.</p>
            )}
            <section className="till-existing">
              <div className="till-sectionhead">
                <div>
                  <span className="till-eyebrow">02 / EXISTING TICKETS</span>
                  <h2>Link an order</h2>
                </div>
              </div>
              <p>
                Eligible accepted, preparing, ready and completed unpaid orders. Each order can be
                attached only once.
              </p>
              {workspace.attachable.map((o) => (
                <div className="till-existing-row" key={o.orderId}>
                  <div>
                    <strong>
                      #{o.orderNumber} · {o.customerName || o.fulfillmentMode.replace("_", " ")}
                    </strong>
                    <small>
                      {o.status} · {money(o.subtotalMinor, o.currency)}
                    </small>
                  </div>
                  <button type="button" disabled={busy} onClick={() => void attach(o)}>
                    Attach <ArrowRight size={15} />
                  </button>
                </div>
              ))}
              {!workspace.attachable.length && (
                <p className="till-empty">No eligible unpaid tickets currently available.</p>
              )}
            </section>
          </section>
          <aside className="till-cart" aria-label="Staff order cart">
            <div className="till-sectionhead">
              <div>
                <span className="till-eyebrow">03 / ORDER PAD</span>
                <h2>Current ticket</h2>
              </div>
              <ShoppingBasket size={22} />
            </div>
            <div className="till-fields">
              <label>
                Fulfillment
                <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
                  {workspace.context.fulfillmentModes.includes("pickup") && (
                    <option value="pickup">Pickup / counter</option>
                  )}
                  {workspace.context.fulfillmentModes.includes("dine_in") && (
                    <option value="dine_in">Dine-in</option>
                  )}
                </select>
              </label>
              {mode === "dine_in" && (
                <label>
                  Table / service point
                  <select value={tableId} onChange={(e) => setTableId(e.target.value)}>
                    <option value="">No assigned table</option>
                    {workspace.context.tables.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                Guest name (optional)
                <input
                  maxLength={80}
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                  placeholder="Walk-in customer"
                />
              </label>
            </div>
            {cart.length ? (
              cart.map((entry) => (
                <div className="till-cartline" key={entry.id}>
                  <div>
                    <strong>{entry.name}</strong>
                    <small>
                      {entry.variantName ?? "Regular"} · {money(entry.unitMinor, currency)} each
                    </small>
                  </div>
                  <div className="till-quantity">
                    <button
                      aria-label={"Reduce " + entry.name}
                      onClick={() => changeQty(entry.id, -1)}
                      type="button"
                    >
                      <Minus size={13} />
                    </button>
                    <span>{entry.line.quantity}</span>
                    <button
                      aria-label={"Increase " + entry.name}
                      onClick={() => changeQty(entry.id, 1)}
                      type="button"
                      disabled={entry.line.quantity >= 99}
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="till-empty">Select a dish to start an order.</p>
            )}
            <label className="till-notefield">
              Order note (optional)
              <textarea
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Kitchen instructions or service notes"
              />
            </label>
            <div className="till-total">
              <span>Pre-tax subtotal</span>
              <strong>{money(subtotal.toString(), currency)}</strong>
            </div>
            <p className="till-disclaimer">
              This is an unpaid operational order, not the amount due on a fiscal bill. Tax, tender
              and invoicing will be added in subsequent PRs.
            </p>
            <button
              type="button"
              className="till-primary"
              disabled={!canCheckout}
              onClick={() => void submit()}
            >
              {busy ? "Recording…" : "Send to Service Counter"} <ArrowRight size={17} />
            </button>
            <button
              type="button"
              className="till-clear"
              disabled={busy || !cart.length}
              onClick={() => {
                setCart([]);
                commandRef.current = null;
              }}
            >
              Clear cart
            </button>
          </aside>
        </div>
      )}
      {workspace.context.enabled && (
        <section className="till-recent">
          <div className="till-sectionhead">
            <div>
              <span className="till-eyebrow">04 / DRAFT REGISTER</span>
              <h2>Recently recorded</h2>
            </div>
            <ClipboardList size={20} />
          </div>
          {workspace.recent.map((sale) => (
            <div className="till-existing-row" key={sale.saleId}>
              <div>
                <strong>
                  Order #{sale.orderNumber} ·{" "}
                  {sale.origin === "staff" ? "Staff entry" : "Existing ticket"}
                </strong>
                <small>
                  {sale.saleId} · {sale.status}
                </small>
              </div>
              <span>{money(sale.subtotalMinor, sale.currency)}</span>
            </div>
          ))}
          {!workspace.recent.length && <p className="till-empty">The draft register is empty.</p>}
        </section>
      )}
      {dish && (
        <div className="till-modal-backdrop" role="presentation">
          <section
            className="till-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="till-dish-title"
          >
            <div className="till-sectionhead">
              <div>
                <span className="till-eyebrow">CONFIGURE DISH</span>
                <h2 id="till-dish-title">{dish.name}</h2>
              </div>
              <button type="button" onClick={() => setDish(null)} aria-label="Close dish chooser">
                <X size={19} />
              </button>
            </div>
            {dish.variants.length > 0 && (
              <fieldset>
                <legend>Choose a variant</legend>
                {dish.variants.map((v) => (
                  <label key={v.id} className="till-option">
                    <input
                      type="radio"
                      name="dish-variant"
                      value={v.id}
                      checked={variant === v.id}
                      disabled={!v.isAvailable}
                      onChange={() => setVariant(v.id)}
                    />
                    {v.name}
                    <span>{money(v.priceMinor, currency)}</span>
                  </label>
                ))}
              </fieldset>
            )}
            {dish.addOnGroups.map((g) => (
              <fieldset key={g.id}>
                <legend>
                  {g.name} · choose {g.min}–{g.max}
                </legend>
                {g.options.map((o) => (
                  <label key={o.id} className="till-option">
                    <input
                      type="checkbox"
                      checked={(groups[g.id] ?? []).includes(o.id)}
                      disabled={!o.isAvailable}
                      onChange={() => choose(g.id, o.id, g.max)}
                    />
                    {o.name}
                    <span>+{money(o.priceMinor, currency)}</span>
                  </label>
                ))}
              </fieldset>
            ))}
            <button type="button" className="till-primary" onClick={addDish}>
              Add dish <Plus size={16} />
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
