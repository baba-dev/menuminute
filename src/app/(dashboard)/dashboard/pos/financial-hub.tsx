"use client";
import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenText,
  ClipboardCheck,
  FileText,
  LockKeyhole,
  Printer,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";
import type { PosWorkspace } from "@/modules/pos/service";
import type { Detail, FinanceContext, LedgerRow, ShiftRow } from "@/modules/pos/finance";

type Mode = "ledger" | "closing";
type Preview = {
  saleId: string;
  currency: string;
  subtotalMinor: string;
  taxMinor: string;
  totalMinor: string;
  taxProfileRevision: number;
  taxMode: string;
  taxLabel: string;
  lines: Array<{
    name: string;
    quantity: number;
    rateBps: number;
    totalMinor: string;
    taxMinor: string;
  }>;
};
const methodOptions = [
  { value: "cash", label: "Cash" },
  { value: "card_external", label: "Card terminal · staff recorded" },
  { value: "upi_external", label: "UPI · staff recorded" },
  { value: "bank_external", label: "Bank transfer · staff recorded" },
] as const;
const e = (currency: string) =>
  new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
    .maximumFractionDigits ?? 2;
function money(minor: string | null | undefined, currency: string) {
  if (minor == null) return "—";
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(
    Number(minor) / 10 ** e(currency)
  );
}
function toMinor(value: string, currency: string) {
  const exponent = e(currency);
  if (!/^\d+(?:\.\d+)?$/.test(value)) throw Error("Enter a valid nonnegative amount.");
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > exponent) throw Error("Too many decimal places for this currency.");
  const result =
    BigInt(whole!) * 10n ** BigInt(exponent) + BigInt(fraction.padEnd(exponent, "0") || "0");
  if (result > 2147483647n) throw Error("Amount exceeds the supported POS limit.");
  return result.toString();
}
async function response<T>(r: Response): Promise<T> {
  const data = await r.json().catch(() => null);
  if (!r.ok)
    throw Error(
      data?.message ?? "Financial operation could not be confirmed. Retry using the same command."
    );
  return data as T;
}
export function FinancialHub({
  mode,
  outletId,
  organizationId,
  workspace,
  initialFinance,
  initialLedger,
  initialShifts,
}: {
  mode: Mode;
  outletId: string;
  organizationId: string;
  workspace: PosWorkspace;
  initialFinance: FinanceContext;
  initialLedger: LedgerRow[];
  initialShifts: ShiftRow[];
}) {
  const currency = workspace.context.currency;
  const endpoint =
    "/api/organizations/" +
    encodeURIComponent(organizationId) +
    "/outlets/" +
    encodeURIComponent(outletId) +
    "/pos/finance";
  const [finance, setFinance] = useState(initialFinance),
    [ledger, setLedger] = useState(initialLedger),
    [shifts, setShifts] = useState(initialShifts);
  const [selected, setSelected] = useState<Detail | null>(null),
    [preview, setPreview] = useState<Preview | null>(null);
  const [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [taxMode, setTaxMode] = useState<"non_registered" | "classified">(
    finance.taxProfile?.mode ?? "non_registered"
  );
  const [taxInclusive, setTaxInclusive] = useState(finance.taxProfile?.inclusive ?? false);
  const [taxLabel, setTaxLabel] = useState(finance.taxProfile?.taxLabel ?? "Configured tax");
  const [rates, setRates] = useState<Record<string, { classification: string; rateBps: string }>>(
    Object.fromEntries(
      (finance.taxProfile?.classes ?? []).map((c) => [
        c.dishId,
        { classification: c.classification, rateBps: String(c.rateBps) },
      ])
    )
  );
  const [buyer, setBuyer] = useState({ name: "", address: "", taxRegistration: "" });
  const [registerName, setRegisterName] = useState("counter"),
    [opening, setOpening] = useState("0"),
    [shiftId, setShiftId] = useState("");
  const [tenderMethod, setTenderMethod] = useState<(typeof methodOptions)[number]["value"]>("cash");
  const [tenderAmount, setTenderAmount] = useState(""),
    [cashGiven, setCashGiven] = useState(""),
    [tenderReference, setTenderReference] = useState("");
  const [movementDirection, setMovementDirection] = useState<"in" | "out">("in"),
    [movementAmount, setMovementAmount] = useState(""),
    [movementReason, setMovementReason] = useState("");
  const [counted, setCounted] = useState(""),
    [refundReason, setRefundReason] = useState("");
  const pending = useRef<Record<string, string>>({});
  const [reconciliation, setReconciliation] = useState<{
    checkedAt: string;
    anomalies: { saleId: string; reason: string }[];
  } | null>(null);
  const activeShift = shifts.find((s) => s.state === "open");
  const dishes = workspace.menus
    .flatMap((m) => m.categories.flatMap((c) => c.items))
    .filter((d, i, a) => a.findIndex((x) => x.id === d.id) === i);
  async function get<T>(view: string, id?: string): Promise<T> {
    const qs = new URLSearchParams({ view });
    if (id) qs.set("id", id);
    return response<T>(await fetch(endpoint + "?" + qs.toString(), { cache: "no-store" }));
  }
  async function refresh() {
    const [f, l, s] = await Promise.all([
      get<FinanceContext>("context"),
      get<LedgerRow[]>("ledger"),
      get<ShiftRow[]>("shifts"),
    ]);
    setFinance(f);
    setLedger(l);
    setShifts(s);
    if (selected) await selectSale(selected.saleId);
  }
  async function selectSale(id: string) {
    setSelected(await get<Detail>("sale", id));
    setPreview(null);
  }
  async function command(action: string, data: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    setNotice("");
    const fingerprint = action + ":" + JSON.stringify(data);
    pending.current[fingerprint] ??= crypto.randomUUID();
    try {
      const result = await response<Record<string, unknown>>(
        await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action, key: pending.current[fingerprint], data }),
        })
      );
      delete pending.current[fingerprint];
      if (action === "freeze") setPreview(null);
      await refresh();
      setNotice(
        action === "tender"
          ? "Staff-recorded tender saved. This is not provider-confirmed gateway settlement."
          : action === "refund"
            ? "Full-sale reversal and linked credit document recorded. External provider refunds are not initiated by MenuMinute."
            : action === "issue"
              ? "Immutable document issued. Print or save from The Ledger."
              : "Saved: " + JSON.stringify(result)
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to confirm this request.");
    } finally {
      setBusy(false);
    }
  }
  function setProfile(event: FormEvent) {
    event.preventDefault();
    const classes =
      taxMode === "classified"
        ? dishes.map((d) => ({
            dishId: d.id,
            classification: rates[d.id]?.classification?.trim() ?? "",
            rateBps: Number(rates[d.id]?.rateBps ?? ""),
          }))
        : [];
    void command("profile", {
      expectedRevision: finance.taxProfile?.revision ?? 0,
      mode: taxMode,
      inclusive: taxInclusive,
      taxLabel,
      classes,
    });
  }
  function exportCsv() {
    const lines = [
      [
        "saleId",
        "orderId",
        "createdAt",
        "currency",
        "subtotalMinor",
        "totalMinor",
        "taxMinor",
        "paidMinor",
        "refundedMinor",
        "documentNumber",
      ],
      ...ledger.map((l) => [
        l.saleId,
        l.orderId,
        l.createdAt,
        l.currency,
        l.subtotalMinor,
        l.totalMinor ?? "",
        l.taxMinor ?? "",
        l.paidMinor,
        l.refundedMinor,
        l.documentNumber ?? "",
      ]),
    ];
    const csv = lines
      .map((row) => row.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(","))
      .join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "menuminute-pos-register.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <main className="till-page finance-page">
      <header className="till-heading">
        <div>
          <span className="till-eyebrow">MENUMINUTE / POS OPERATIONS</span>
          <h1>{mode === "ledger" ? "The Ledger." : "The Closing Desk."}</h1>
          <p>
            {mode === "ledger"
              ? "Every bill, allocation and document has one source of truth."
              : "Register accountability, cash movement and explainable end-of-shift totals."}
          </p>
        </div>
        <div className="till-heading-actions">
          <Link href="/dashboard/pos">
            The Till <ArrowRight size={15} />
          </Link>
          <Link href="/dashboard/pos/ledger">
            The Ledger <BookOpenText size={15} />
          </Link>
          <Link href="/dashboard/pos/closing">
            Closing Desk <ClipboardCheck size={15} />
          </Link>
          <button
            type="button"
            disabled={busy}
            onClick={() => void refresh()}
            aria-label="Refresh finance"
          >
            <RefreshCcw size={17} />
          </button>
        </div>
      </header>
      <div className="finance-status" role="status">
        {finance.paymentsEnabled ? <ShieldCheck size={18} /> : <LockKeyhole size={18} />}
        <strong>
          {finance.paymentsEnabled
            ? "OPERATOR-GATED COLLECTION ENABLED"
            : "LIVE FINANCE GATE IS CLOSED"}
        </strong>
        <span>
          {finance.documentsEnabled ? "Document issue enabled" : "Document issue disabled"} ·
          External tender entries are staff-recorded, not gateway-confirmed
        </span>
      </div>
      {notice && (
        <div className="till-notice" role="alert">
          {notice}
        </div>
      )}
      {mode === "ledger" ? (
        <>
          <div className="finance-summary">
            <div>
              <span>Recorded sales (recent 60)</span>
              <strong>{ledger.length}</strong>
            </div>
            <div>
              <span>Frozen bills</span>
              <strong>{ledger.filter((l) => l.totalMinor != null).length}</strong>
            </div>
            <div>
              <span>Documents issued</span>
              <strong>{ledger.filter((l) => l.documentNumber != null).length}</strong>
            </div>
            <div>
              <span>Outlet currency</span>
              <strong>{currency}</strong>
            </div>
          </div>
          {finance.canManage && (
            <details className="finance-panel finance-tax">
              <summary>
                <span>
                  <ShieldCheck size={18} /> Tax classification & seller policy
                </span>
                <span>Configure rules</span>
              </summary>
              <form onSubmit={setProfile}>
                <p>
                  Choose explicit merchant-approved classifications. Rates are never inferred from
                  dish names. Legal invoice activation additionally requires operator and
                  jurisdiction approval.
                </p>
                <div className="finance-fields">
                  <label>
                    Tax mode
                    <select
                      value={taxMode}
                      onChange={(event) => setTaxMode(event.target.value as typeof taxMode)}
                    >
                      <option value="non_registered">
                        Seller-declared non-registered · zero tax receipt
                      </option>
                      <option value="classified">
                        Item-classified tax · requires regulatory review
                      </option>
                    </select>
                  </label>
                  <label>
                    Tax label
                    <input
                      required
                      maxLength={40}
                      value={taxLabel}
                      onChange={(event) => setTaxLabel(event.target.value)}
                    />
                  </label>
                  <label className="finance-check">
                    <input
                      type="checkbox"
                      checked={taxInclusive}
                      onChange={(event) => setTaxInclusive(event.target.checked)}
                    />{" "}
                    Published price includes tax
                  </label>
                </div>
                {taxMode === "classified" && (
                  <div className="finance-class-list">
                    {dishes.map((d) => (
                      <div key={d.id}>
                        <strong>{d.name}</strong>
                        <label>
                          Classification
                          <input
                            required
                            maxLength={32}
                            value={rates[d.id]?.classification ?? ""}
                            onChange={(event) =>
                              setRates((old) => ({
                                ...old,
                                [d.id]: {
                                  classification: event.target.value,
                                  rateBps: old[d.id]?.rateBps ?? "",
                                },
                              }))
                            }
                          />
                        </label>
                        <label>
                          Rate (basis points)
                          <input
                            required
                            type="number"
                            min="0"
                            max="10000"
                            step="1"
                            value={rates[d.id]?.rateBps ?? ""}
                            onChange={(event) =>
                              setRates((old) => ({
                                ...old,
                                [d.id]: {
                                  rateBps: event.target.value,
                                  classification: old[d.id]?.classification ?? "",
                                },
                              }))
                            }
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                )}
                <button className="till-primary" type="submit" disabled={busy}>
                  Save tax policy (not legal certification)
                </button>
              </form>
            </details>
          )}
          <section className="finance-panel">
            <div className="till-sectionhead">
              <div>
                <span className="till-eyebrow">01 / PRIVATE REGISTER</span>
                <h2>Recent sales</h2>
              </div>
              <button type="button" onClick={exportCsv}>
                Export visible CSV
              </button>
            </div>
            <div className="finance-scroll">
              <table className="finance-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Subtotal</th>
                    <th>Bill</th>
                    <th>Recorded</th>
                    <th>Document</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((l) => (
                    <tr key={l.saleId}>
                      <td>
                        <strong>{l.orderId.slice(0, 12)}</strong>
                        <small>{new Date(l.createdAt).toLocaleString()}</small>
                      </td>
                      <td>{money(l.subtotalMinor, l.currency)}</td>
                      <td>{money(l.totalMinor, l.currency)}</td>
                      <td>{money(l.paidMinor, l.currency)}</td>
                      <td>{l.documentNumber ?? "Not issued"}</td>
                      <td>
                        <button type="button" onClick={() => void selectSale(l.saleId)}>
                          Open <ArrowRight size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!ledger.length && (
              <p className="till-empty">
                No sale records yet. Start with a published-menu order in The Till.
              </p>
            )}
          </section>
          {selected && (
            <section className="finance-panel finance-detail" aria-label="Selected sale">
              <div className="till-sectionhead">
                <div>
                  <span className="till-eyebrow">02 / FINANCIAL RECORD</span>
                  <h2>{selected.saleId}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(null);
                    setPreview(null);
                  }}
                >
                  Close
                </button>
              </div>
              <p>
                Source order: {selected.orderId}. All financial totals below are scoped to this
                outlet and snapshot.
              </p>
              {selected.bill ? (
                <>
                  <div className="finance-bill-total">
                    <span>Frozen payable</span>
                    <strong>{money(selected.bill.totalMinor, currency)}</strong>
                    <small>
                      Tax {money(selected.bill.taxMinor, currency)} · {selected.bill.taxMode}
                    </small>
                  </div>
                  <div className="finance-line-list">
                    {selected.bill.lines.map((l, i) => (
                      <div key={i}>
                        <span>
                          {String(l.name)} × {l.quantity}
                        </span>
                        <strong>{money(String(l.totalMinor), currency)}</strong>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="finance-flow">
                  <p>
                    No bill snapshot is frozen. Tax calculation re-reads the seller profile and
                    every dish classification.
                  </p>
                  <button
                    disabled={!finance.paymentsEnabled || busy}
                    onClick={async () => {
                      setNotice("");
                      try {
                        setPreview(await get<Preview>("preview", selected.saleId));
                      } catch (error) {
                        setNotice(error instanceof Error ? error.message : "Cannot calculate bill");
                      }
                    }}
                  >
                    Calculate current bill
                  </button>
                  {preview && (
                    <>
                      <p>
                        Subtotal: {money(preview.subtotalMinor, currency)} · Tax:{" "}
                        {money(preview.taxMinor, currency)} · Payable:{" "}
                        <strong>{money(preview.totalMinor, currency)}</strong>
                      </p>
                      <div className="finance-fields">
                        <label>
                          Buyer name (optional)
                          <input
                            value={buyer.name}
                            onChange={(ev) => setBuyer((b) => ({ ...b, name: ev.target.value }))}
                          />
                        </label>
                        <label>
                          Buyer address (optional)
                          <input
                            value={buyer.address}
                            onChange={(ev) => setBuyer((b) => ({ ...b, address: ev.target.value }))}
                          />
                        </label>
                        <label>
                          Buyer tax registration (optional)
                          <input
                            value={buyer.taxRegistration}
                            onChange={(ev) =>
                              setBuyer((b) => ({ ...b, taxRegistration: ev.target.value }))
                            }
                          />
                        </label>
                      </div>
                      <button
                        className="till-primary"
                        disabled={busy}
                        onClick={() =>
                          void command("freeze", {
                            saleId: selected.saleId,
                            expectedTotalMinor: preview.totalMinor,
                            expectedTaxRevision: preview.taxProfileRevision,
                            customer: Object.fromEntries(
                              Object.entries(buyer).filter(([, v]) => v.trim())
                            ),
                          })
                        }
                      >
                        Freeze immutable bill
                      </button>
                    </>
                  )}
                </div>
              )}
              {selected.tenders.length > 0 && (
                <div className="finance-line-list">
                  <h3>Tender allocations</h3>
                  {selected.tenders.map((t) => (
                    <div key={t.id}>
                      <span>{t.method.replace("_external", " (staff-recorded)")}</span>
                      <strong>{money(t.amountMinor, currency)}</strong>
                    </div>
                  ))}
                </div>
              )}
              {selected.bill && (
                <section className="finance-flow">
                  <h3>Split settlement</h3>
                  <p>
                    Each tender is independently recorded. Cash change is tracked separately;
                    external references are staff attestations, not provider-confirmed transactions.
                  </p>
                  <div className="finance-fields">
                    <label>
                      Open shift
                      <select value={shiftId} onChange={(ev) => setShiftId(ev.target.value)}>
                        <option value="">Select a shift</option>
                        {shifts
                          .filter((s) => s.state === "open")
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.registerName} · {s.id.slice(0, 12)}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Method
                      <select
                        value={tenderMethod}
                        onChange={(ev) => setTenderMethod(ev.target.value as typeof tenderMethod)}
                      >
                        {methodOptions.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Apply ({currency})
                      <input
                        inputMode="decimal"
                        placeholder="0.00"
                        value={tenderAmount}
                        onChange={(ev) => setTenderAmount(ev.target.value)}
                      />
                    </label>
                    {tenderMethod === "cash" ? (
                      <label>
                        Cash handed over ({currency})
                        <input
                          inputMode="decimal"
                          placeholder="0.00"
                          value={cashGiven}
                          onChange={(ev) => setCashGiven(ev.target.value)}
                        />
                      </label>
                    ) : (
                      <label>
                        External terminal/reference
                        <input
                          maxLength={80}
                          value={tenderReference}
                          onChange={(ev) => setTenderReference(ev.target.value)}
                        />
                      </label>
                    )}
                  </div>
                  <button
                    className="till-primary"
                    disabled={!finance.paymentsEnabled || !finance.canCollect || !shiftId || busy}
                    onClick={() => {
                      try {
                        const a = toMinor(tenderAmount, currency),
                          t = tenderMethod === "cash" ? toMinor(cashGiven, currency) : a;
                        void command("tender", {
                          saleId: selected.saleId,
                          shiftId,
                          method: tenderMethod,
                          amountMinor: a,
                          tenderedMinor: t,
                          reference: tenderMethod === "cash" ? null : tenderReference.trim(),
                        });
                      } catch (error) {
                        setNotice(error instanceof Error ? error.message : "Invalid amount");
                      }
                    }}
                  >
                    Record tender (manual attestation)
                  </button>
                </section>
              )}
              {selected.documents.length > 0 && (
                <div className="finance-flow">
                  <h3>Issued documents</h3>
                  {selected.documents.map((d) => (
                    <div className="finance-document" key={d.id}>
                      <strong>{d.number}</strong>
                      <span>{d.kind}</span>
                      <Link
                        href={"/dashboard/pos/ledger/documents/" + encodeURIComponent(d.id)}
                        target="_blank"
                        rel="noopener"
                      >
                        <Printer size={15} /> Print / save PDF
                      </Link>
                    </div>
                  ))}
                </div>
              )}
              {selected.bill && (
                <div className="finance-actions">
                  <button
                    disabled={
                      !finance.documentsEnabled ||
                      !finance.canIssue ||
                      busy ||
                      selected.documents.some((d) => d.kind !== "credit_note")
                    }
                    onClick={() => void command("issue", { saleId: selected.saleId })}
                  >
                    <FileText size={17} /> Issue document when fully paid
                  </button>
                  <label>
                    Full-sale reversal reason
                    <input
                      minLength={5}
                      maxLength={200}
                      value={refundReason}
                      onChange={(ev) => setRefundReason(ev.target.value)}
                      placeholder="Explain reversal"
                    />
                  </label>
                  <button
                    disabled={
                      !finance.documentsEnabled ||
                      !finance.canRefund ||
                      !activeShift ||
                      refundReason.trim().length < 5 ||
                      busy ||
                      selected.refunds.length > 0
                    }
                    onClick={() => {
                      if (
                        window.confirm(
                          "Record a FULL-SALE reversal and issue a linked credit document? This does not contact any external payment provider."
                        )
                      )
                        void command("refund", {
                          saleId: selected.saleId,
                          shiftId: activeShift!.id,
                          reason: refundReason.trim(),
                          externalRefundAttested: true,
                        });
                    }}
                  >
                    Reverse full sale & create credit
                  </button>
                </div>
              )}
            </section>
          )}
        </>
      ) : (
        <>
          <div className="finance-summary">
            <div>
              <span>Open registers</span>
              <strong>{shifts.filter((s) => s.state === "open").length}</strong>
            </div>
            <div>
              <span>Past register sessions</span>
              <strong>{shifts.filter((s) => s.state === "closed").length}</strong>
            </div>
            <div>
              <span>Currency</span>
              <strong>{currency}</strong>
            </div>
          </div>
          <section className="finance-panel">
            <span className="till-eyebrow">01 / OPEN DRAWER</span>
            <h2>Start a shift</h2>
            <p>One open shift per register. A cashier’s float is not revenue.</p>
            <div className="finance-fields">
              <label>
                Register
                <input
                  maxLength={40}
                  value={registerName}
                  onChange={(ev) => setRegisterName(ev.target.value)}
                />
              </label>
              <label>
                Opening cash ({currency})
                <input
                  inputMode="decimal"
                  value={opening}
                  onChange={(ev) => setOpening(ev.target.value)}
                />
              </label>
            </div>
            <button
              className="till-primary"
              disabled={!finance.paymentsEnabled || busy}
              onClick={() => {
                try {
                  void command("open_shift", {
                    registerName,
                    openingMinor: toMinor(opening, currency),
                  });
                } catch (e) {
                  setNotice(e instanceof Error ? e.message : "Invalid float");
                }
              }}
            >
              Open register
            </button>
          </section>
          {activeShift && (
            <section className="finance-panel">
              <span className="till-eyebrow">02 / LIVE DRAWER</span>
              <h2>{activeShift.registerName}</h2>
              <p>
                Opened {new Date(activeShift.openedAt).toLocaleString()} · Float{" "}
                {money(activeShift.openingMinor, currency)}
              </p>
              <div className="finance-fields">
                <label>
                  Cash action
                  <select
                    value={movementDirection}
                    onChange={(ev) =>
                      setMovementDirection(ev.target.value as typeof movementDirection)
                    }
                  >
                    <option value="in">Cash in</option>
                    <option value="out">Cash out / bank drop</option>
                  </select>
                </label>
                <label>
                  Amount ({currency})
                  <input
                    inputMode="decimal"
                    value={movementAmount}
                    onChange={(ev) => setMovementAmount(ev.target.value)}
                  />
                </label>
                <label>
                  Explanation
                  <input
                    maxLength={200}
                    value={movementReason}
                    onChange={(ev) => setMovementReason(ev.target.value)}
                  />
                </label>
              </div>
              <button
                disabled={busy}
                onClick={() => {
                  try {
                    void command("cash_move", {
                      shiftId: activeShift.id,
                      direction: movementDirection,
                      amountMinor: toMinor(movementAmount, currency),
                      reason: movementReason.trim(),
                    });
                  } catch (e) {
                    setNotice(e instanceof Error ? e.message : "Invalid amount");
                  }
                }}
              >
                Record drawer movement
              </button>
              <div className="finance-line-list">
                <div>
                  <span>Cash collections</span>
                  <strong>{money(activeShift.cashTakenMinor, currency)}</strong>
                </div>
                <div>
                  <span>Cash reversals</span>
                  <strong>{money(activeShift.cashRefundMinor, currency)}</strong>
                </div>
              </div>
              {finance.canIssue && (
                <div className="finance-flow">
                  <h3>Close & reconcile</h3>
                  <label>
                    Counted physical cash ({currency})
                    <input
                      inputMode="decimal"
                      value={counted}
                      onChange={(ev) => setCounted(ev.target.value)}
                    />
                  </label>
                  <button
                    disabled={busy}
                    onClick={() => {
                      try {
                        void command("close_shift", {
                          shiftId: activeShift.id,
                          countedMinor: toMinor(counted, currency),
                        });
                      } catch (e) {
                        setNotice(e instanceof Error ? e.message : "Invalid count");
                      }
                    }}
                  >
                    Close register and retain variance
                  </button>
                </div>
              )}
            </section>
          )}
          <section className="finance-panel">
            <span className="till-eyebrow">03 / CASHIER HISTORY</span>
            <h2>Register history</h2>
            <div className="finance-scroll">
              <table className="finance-table">
                <thead>
                  <tr>
                    <th>Register</th>
                    <th>Opened</th>
                    <th>Expected</th>
                    <th>Counted</th>
                    <th>State</th>
                  </tr>
                </thead>
                <tbody>
                  {shifts.map((s) => (
                    <tr key={s.id}>
                      <td>{s.registerName}</td>
                      <td>{new Date(s.openedAt).toLocaleString()}</td>
                      <td>{money(s.expectedMinor, currency)}</td>
                      <td>{money(s.countedMinor, currency)}</td>
                      <td>{s.state}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="finance-panel">
            <span className="till-eyebrow">04 / INVARIANT MONITOR</span>
            <h2>Ledger reconciliation</h2>
            <p>
              Read-only bounded scan for overcollection, over-refund, line-total mismatch and
              order-paid disagreement.
            </p>
            <button
              type="button"
              disabled={!finance.canIssue || busy}
              onClick={async () => {
                try {
                  setReconciliation(await get("reconcile"));
                } catch (e) {
                  setNotice(e instanceof Error ? e.message : "Unable to reconcile");
                }
              }}
            >
              Run current consistency scan
            </button>
            {reconciliation && (
              <p role="status">
                {reconciliation.anomalies.length
                  ? reconciliation.anomalies.map((a) => a.saleId + " · " + a.reason).join("; ")
                  : "No invariant mismatch found in this scan. This is not bank reconciliation or compliance certification."}
              </p>
            )}
          </section>
        </>
      )}
    </main>
  );
}
