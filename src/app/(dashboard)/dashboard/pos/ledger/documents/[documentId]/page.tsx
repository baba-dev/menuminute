import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import { financeRead, type DocumentDetail } from "@/modules/pos/finance";
import { PrintActions } from "./print-actions";
import "./print.css";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Private POS Document | MenuMinute",robots:{index:false,follow:false}};
type Bill = NonNullable<DocumentDetail["snapshot"]["bill"]>;
function money(minor:string|number|undefined,currency:string){
 const ex=new Intl.NumberFormat("en",{style:"currency",currency}).resolvedOptions().maximumFractionDigits??2;
 return new Intl.NumberFormat(undefined,{style:"currency",currency}).format(Number(minor??0)/10**ex);
}
export default async function Page({params}:{params:Promise<{documentId:string}>}){
 const {documentId}=await params;
 const session=await auth();if(!session?.user.id)redirect("/login");
 const outlet=await getDefaultOrActiveRestaurant(session.user.id,session.activeOutletId);
 if(!outlet)redirect("/dashboard");
 const d=await financeRead({userId:session.user.id,sessionId:session.session.id},outlet.organizationId,outlet.id,
  {view:"document",id:documentId}) as DocumentDetail;
 const bill=d.snapshot.bill as Bill|undefined;
 const seller=bill?.seller??{};
 const customer=bill?.customer??{};
 const lines=bill?.lines??[];
 const currency=String((bill as Record<string,unknown>|undefined)?.currency??outlet.currency);
 return <main className="document-page">
  <header className="document-toolbar"><Link href="/dashboard/pos/ledger">← The Ledger</Link><PrintActions/></header>
  <article className="document-sheet" aria-label="Immutable merchant document">
   <div className="document-top"><div><span className="document-brand">MENU MINUTE / MERCHANT RECORD</span><h1>{d.kind==="credit_note"?"Credit note":d.kind==="receipt"?"Sales receipt":"Merchant tax invoice"}</h1>
    <strong>{d.number}</strong></div><span>{new Date(d.issuedAt).toLocaleString("en",{dateStyle:"medium",timeStyle:"short"})}</span></div>
   <div className="document-parties"><div><small>ISSUED BY</small><h2>{String(seller.legalName??outlet.name)}</h2>
    <p>{String(seller.registeredAddress??"")}</p><p>{String(seller.country??"")}</p>
    {seller.taxRegistration&&<p>Registration: {String(seller.taxRegistration)}</p>}</div>
    {Object.keys(customer).length>0&&<div><small>BILL TO</small><h2>{String(customer.name??"Customer")}</h2>
     <p>{String(customer.address??"")}</p>{customer.taxRegistration&&<p>Registration: {String(customer.taxRegistration)}</p>}</div>}</div>
   {d.kind==="credit_note"&&<div className="document-credit"><strong>Reversal of {d.snapshot.reverses}</strong>
    <p>Reason: {d.snapshot.reason}. This document preserves the original invoice or receipt.</p></div>}
   <table><thead><tr><th>Item / classification</th><th>Qty</th><th>Base</th><th>Tax</th><th>Total</th></tr></thead><tbody>
    {lines.map((line,i)=><tr key={i}><td><strong>{String(line.name)}</strong><small>{String(line.classification??"")} · {String(line.rateBps??0)} bp</small></td>
     <td>{String(line.quantity)}</td><td>{money(String(line.baseMinor??0),currency)}</td><td>{money(String(line.taxMinor??0),currency)}</td>
     <td>{money(String(line.totalMinor??0),currency)}</td></tr>)}</tbody></table>
   <div className="document-totals"><div><span>Original item subtotal</span><strong>{money(bill?.subtotalMinor,currency)}</strong></div>
    <div><span>Tax</span><strong>{money(bill?.taxMinor,currency)}</strong></div>
    <div className="document-due"><span>{d.kind==="credit_note"?"Amount reversed":"Total collected"}</span><strong>{money(bill?.totalMinor,currency)}</strong></div></div>
   {d.snapshot.settlement&&<div className="document-tenders"><h3>Recorded tenders</h3>{d.snapshot.settlement.map((t,i)=>
    <p key={i}>{t.method} · {money(t.amountMinor,currency)} · {t.evidence==="staff_recorded"?"Staff-recorded external/cash entry":t.evidence}</p>)}</div>}
   <footer><span>Issued document ID: {d.id}</span>
    <p>{d.kind==="invoice"?"This merchant document is not, by itself, an IRP-registered e-invoice or proof of local legal compliance.":
     d.kind==="credit_note"?"Refund entries record staff attestations; external payment reversal must be performed and reconciled with the provider separately.":
     "Non-tax receipt based on the merchant's declared non-registration status; verify local documentary obligations."}</p>
    <p>Historical document data is immutable. Reprints do not allocate a new serial.</p></footer>
  </article>
 </main>;
}
