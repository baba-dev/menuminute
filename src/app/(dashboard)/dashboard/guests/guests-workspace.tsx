"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, ChevronLeft, ChevronRight, Phone, Search, UserPlus, UsersRound, X, Trash2, Save, ReceiptText } from "lucide-react";
import type { GuestDetail, GuestList } from "@/modules/crm/service";

type Props = {
  organizationId: string; outletId: string; outletName: string; initial: GuestList;
};
function masked(phone: string) {
  return phone.length > 4 ? phone.slice(0, Math.min(4,phone.length - 4)) + " •••• " + phone.slice(-4) : "••••";
}
function money(minor: string, currency: string) {
  try {
    const digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Number(minor)/10**digits);
  } catch { return minor + " " + currency; }
}
export function GuestsWorkspace({ organizationId, outletId, outletName, initial }: Props) {
  const endpoint = "/api/organizations/" + encodeURIComponent(organizationId) +
    "/outlets/" + encodeURIComponent(outletId) + "/guests";
  const [data, setData] = useState(initial);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<GuestDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  async function refresh(nextPage: number, nextQuery: string, abort?: AbortSignal) {
    const res = await fetch(endpoint + "?view=list&page=" + nextPage + "&search=" + encodeURIComponent(nextQuery), {
      cache: "no-store", signal: abort,
    });
    if (!res.ok) throw new Error("Could not refresh guests");
    return res.json() as Promise<GuestList>;
  }
  useEffect(() => {
    if (!query && page === 0) return;
    const abort = new AbortController();
    const timer = window.setTimeout(() => {
      void refresh(page, query, abort.signal).then(setData).catch(() => {
        if (!abort.signal.aborted) setError("Guest list could not be refreshed. Try again.");
      });
    }, 250);
    return () => { window.clearTimeout(timer); abort.abort(); };
  // Initial server data is shown without requesting it twice.
  }, [page, query, endpoint]);
  useEffect(() => {
    if (!selected || selected === "new") return;
    const abort = new AbortController();
    setLoading(true);
    fetch(endpoint + "?view=detail&id=" + encodeURIComponent(selected), {cache:"no-store",signal:abort.signal})
      .then((r) => { if (!r.ok) throw new Error("Guest unavailable"); return r.json(); })
      .then((v: GuestDetail | null) => {
        if (!abort.signal.aborted) {
          setDetail(v); setName(v?.name ?? ""); setPhone(v?.phone ?? ""); setNotes(v?.notes ?? "");
        }
      })
      .catch(() => { if (!abort.signal.aborted) setError("Could not load guest details."); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [selected, endpoint]);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("guest");
    if (id && /^[A-Za-z0-9_-]{1,128}$/.test(id)) setSelected(id);
  }, []);
  async function save() {
    setSaving(true); setError("");
    try {
      const response = await fetch(endpoint, {method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({id:selected === "new" ? null : selected, phone, name, notes})});
      if (!response.ok) throw new Error("Could not save guest. Check your permissions and number.");
      const updated = await response.json() as { id: string };
      setSelected(null); setDetail(null);
      setData(await refresh(0, query)); setPage(0);
      if (updated.id) window.history.replaceState(null, "", "/dashboard/guests");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save guest"); }
    finally { setSaving(false); }
  }
  async function erase() {
    if (!selected || selected === "new" || !window.confirm(
      "Remove this guest profile and stop automatically retaining this number? Historical orders and receipts remain unchanged."
    )) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(endpoint, {method:"DELETE",headers:{"content-type":"application/json"},
        body: JSON.stringify({id:selected})});
      if (!response.ok) throw new Error("Only organization administrators can erase guest profiles.");
      setSelected(null); setDetail(null); setData(await refresh(0, query)); setPage(0);
      window.history.replaceState(null, "", "/dashboard/guests");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not remove guest"); }
    finally { setSaving(false); }
  }
  return (
    <main className="guests-shell">
      <header className="guests-hero">
        <div>
          <Link href="/dashboard" className="guests-back"><ArrowLeft size={15}/> Dashboard</Link>
          <span className="guests-eyebrow">RELATIONSHIPS / 01</span>
          <h1>Every guest has a story.</h1>
          <p>Recognize familiar faces, see what they have ordered, and serve them thoughtfully.
            No extra work at the counter.</p>
          <span className="guests-outlet">{outletName} · Private guest directory</span>
        </div>
        <div className="guests-hero-art" aria-hidden="true"><UsersRound size={74} strokeWidth={1.1} /></div>
      </header>
      <div className="guests-content">
        <section className="guests-highlights" aria-label="Guest overview">
          <div><small>GUEST DIRECTORY</small><strong>{data.total.toLocaleString()}</strong><span>Customers recorded for this organization</span></div>
          <div><small>RETURNING ON THIS PAGE</small><strong>{data.items.filter((g) => g.visits > 1).length}</strong><span>With more than one completed visit at this outlet</span></div>
        </section>
        <section className="guests-directory">
          <div className="guests-section-heading">
            <div><span className="guests-eyebrow">02 / THE GUEST BOOK</span><h2>Your guests</h2></div>
            <button type="button" className="guests-add" onClick={() => {
              setSelected("new"); setDetail(null); setName(""); setNotes(""); setPhone("");
            }}><UserPlus size={17}/> Add guest</button>
          </div>
          <label className="guests-search"><Search size={17}/><span className="sr-only">Search guests</span>
            <input value={query} placeholder="Search by name or phone…" onChange={(e) => {setQuery(e.target.value); setPage(0);}} />
          </label>
          {error && <div className="guests-error" role="alert">{error}
            <button type="button" onClick={() => {setError(""); void refresh(page,query).then(setData);}}>Retry</button></div>}
          <div className="guests-table-wrap">
            <table className="guests-table">
              <thead><tr><th>Guest</th><th>Mobile</th><th>Visits here</th><th>Last visit</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {data.items.map((guest) => (
                  <tr key={guest.id}>
                    <td data-label="Guest"><span className="guests-avatar"><UsersRound size={17}/></span>
                      <strong>{guest.name || "Unnamed guest"}</strong></td>
                    <td data-label="Mobile">{masked(guest.phone)}</td>
                    <td data-label="Visits">{guest.visits}</td>
                    <td data-label="Last visit">{guest.lastVisit ? new Date(guest.lastVisit).toLocaleDateString() : "—"}</td>
                    <td><button className="guests-view" type="button" onClick={() => {setError("");setDetail(null);setSelected(guest.id);}}>View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.items.length && <div className="guests-empty"><UsersRound size={28}/>
              <h3>{query ? "No guests match your search" : "Your guest book starts here"}</h3>
              <p>Guests appear automatically as their mobile numbers are recorded on orders.</p></div>}
          </div>
          <footer className="guests-pagination">
            <span>{data.total ? (page * 20 + 1) : 0}–{Math.min((page+1)*20,data.total)} of {data.total} guests</span>
            <div><button aria-label="Previous page" type="button" disabled={page===0} onClick={() => setPage(p=>p-1)}><ChevronLeft size={18}/></button>
            <button aria-label="Next page" type="button" disabled={(page+1)*20>=data.total} onClick={() => setPage(p=>p+1)}><ChevronRight size={18}/></button></div>
          </footer>
        </section>
      </div>
      <Dialog.Root open={selected!==null} onOpenChange={(open) => {if(!open){setSelected(null);setDetail(null);setError("");}}}>
        <Dialog.Portal>
          <Dialog.Overlay className="guests-overlay"/>
          <Dialog.Content className="guests-drawer" aria-describedby="guest-drawer-description">
            <div className="guests-drawer-header"><span className="guests-eyebrow">GUEST PROFILE</span>
              <Dialog.Close className="guests-close" aria-label="Close"><X size={18}/></Dialog.Close></div>
            <Dialog.Title>{selected === "new" ? "Add a guest" : detail?.name || "Guest details"}</Dialog.Title>
            <Dialog.Description id="guest-drawer-description">
              {selected === "new" ? "Add a guest to your private customer directory." :
                "A private record of visits associated with this mobile number."}
            </Dialog.Description>
            {loading && <p role="status">Loading guest…</p>}
            {(!loading && (detail || selected==="new")) && <>
              <div className="guests-profile-fields">
                <label>Name (optional)<input maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="Guest name"/></label>
                <label>Mobile number<input type="tel" maxLength={32} disabled={selected!=="new"} required
                  value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+91 98765 43210"/></label>
                <label>Staff notes (private)<textarea rows={3} maxLength={1000} value={notes} onChange={e=>setNotes(e.target.value)}
                  placeholder="Service preferences or details the guest has shared" /></label>
                <p className="guests-privacy">A mobile number identifies a record; it does not verify ownership or grant marketing consent.</p>
                <button type="button" className="guests-save" disabled={saving} onClick={()=>void save()}><Save size={16}/>{saving?"Saving…":"Save guest"}</button>
              </div>
              {detail && <>
                <div className="guests-timeline-heading"><h3>Recent orders</h3><span>Last 20 at this outlet</span></div>
                {detail.orders.length ? <ul className="guests-timeline">
                  {detail.orders.map(o=><li key={o.id}><ReceiptText size={17}/>
                    <div><strong>Order #{o.number}</strong><small>{new Date(o.createdAt).toLocaleString()} · {o.status}</small></div>
                    <span>{money(o.totalMinor,o.currency)}</span></li>)}
                </ul> : <p className="guests-privacy">No orders at this outlet yet.</p>}
                <button type="button" disabled={saving} className="guests-erase" onClick={()=>void erase()}><Trash2 size={15}/> Erase CRM profile</button>
              </>}
            </>}
            {error && <p className="guests-error" role="alert">{error}</p>}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </main>
  );
}
