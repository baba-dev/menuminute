"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bell, Check, Printer, RefreshCw, Volume2, VolumeX, X } from "lucide-react";
import { playKitchenBell } from "@/lib/sound-effects";
import type { PosIncomingOrder, PosSaleResult } from "@/modules/pos/service";

type Inbox = { orders: PosIncomingOrder[]; overflow: boolean };
const formatMoney = (minor: string, currency: string) =>
  new Intl.NumberFormat(undefined,{style:"currency",currency}).format(
    Number(minor) / (["OMR","BHD","KWD","JOD","TND"].includes(currency)?1000:100));

export function PosIncomingOrders({ organizationId, outletId, onUpdated }: {
  organizationId:string; outletId:string; onUpdated:()=>Promise<void>;
}) {
  const endpoint="/api/organizations/"+encodeURIComponent(organizationId)+"/outlets/"+
    encodeURIComponent(outletId)+"/pos";
  const [inbox,setInbox]=useState<Inbox|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [busy,setBusy]=useState<string|null>(null);
  const [dismissed,setDismissed]=useState<Set<string>>(()=>new Set());
  const [sound,setSound]=useState(false);
  const [lastAccepted,setLastAccepted]=useState<{order:number;saleId:string}|null>(null);
  const keys=useRef<Map<string,string>>(new Map());
  const seen=useRef<Set<string>|null>(null);
  const sounding=useRef(false);
  useEffect(()=>{try { setSound(localStorage.getItem("mm.pos.sound."+outletId)==="on"); }catch{}},[outletId]);
  useEffect(()=>{sounding.current=sound;},[sound]);
  const refresh=useCallback(async(signal?:AbortSignal)=>{
    try {
      const response=await fetch(endpoint+"?view=inbox",{cache:"no-store",signal});
      if(!response.ok)throw new Error("Incoming orders unavailable ("+response.status+").");
      const value=await response.json() as Inbox;
      if(signal?.aborted)return;
      if(!Array.isArray(value.orders))throw new Error("Invalid order-inbox response");
      const next=new Set(value.orders.map(o=>o.orderId));
      if(seen.current && sounding.current &&
        [...next].some(id=>!seen.current?.has(id))) {
        try {playKitchenBell("orders");}catch{}
      }
      seen.current=next;
      setInbox(value);
      setError(null);
    } catch(e) {
      if(signal?.aborted)return;
      setError(e instanceof Error?e.message:"Could not synchronize customer orders.");
    }
  },[endpoint]);
  useEffect(()=>{
    const controller=new AbortController();
    void refresh(controller.signal);
    const handle=()=>{if(document.visibilityState==="visible")void refresh(controller.signal);};
    const timer=window.setInterval(handle,5000);
    document.addEventListener("visibilitychange",handle);
    window.addEventListener("online",handle);
    return ()=>{controller.abort();window.clearInterval(timer);
      document.removeEventListener("visibilitychange",handle);window.removeEventListener("online",handle);};
  },[refresh]);
  async function accept(order:PosIncomingOrder){
    if(busy)return;
    setBusy(order.orderId);
    const key=keys.current.get(order.orderId)??crypto.randomUUID();
    keys.current.set(order.orderId,key);
    try{
      const response=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({action:"accept_customer",
          input:{key,orderId:order.orderId,expectedVersion:order.version}})});
      const result=await response.json().catch(()=>null) as (PosSaleResult&{message?:string})|null;
      if(!response.ok)throw new Error(result?.message??"Could not confirm order acceptance.");
      if(!result?.saleId)throw new Error("Acceptance confirmation missing sale details.");
      setLastAccepted({order:order.orderNumber,saleId:result.saleId});
      keys.current.delete(order.orderId);
      setDismissed(previous=>new Set([...previous,order.orderId]));
      await Promise.all([refresh(),onUpdated()]);
    }catch(e){
      setError((e instanceof Error?e.message:"Acceptance result unknown.")+
        " Check the order status before retrying; the same request will be reused.");
      void refresh();
    }finally{setBusy(null);}
  }
  const pending=inbox?.orders??[];
  const alert=pending.find(order=>!dismissed.has(order.orderId));
  return <section className="pos-inbox" aria-labelledby="pos-inbox-title">
    <header className="till-sectionhead">
      <div><span className="till-eyebrow">02 / INCOMING ORDERS</span>
        <h2 id="pos-inbox-title">Customer Order Inbox</h2>
        <p>Orders from customer menus, including QR ordering, await cashier acceptance.</p>
      </div>
      <div className="pos-inbox-tools">
        <span className="pos-inbox-count" aria-label={pending.length+" awaiting"}>
          {inbox?pending.length:"—"} awaiting</span>
        <button type="button" aria-label={sound?"Mute order alerts":"Enable order alert sound"}
          onClick={()=>{const next=!sound;setSound(next);
            try{localStorage.setItem("mm.pos.sound."+outletId,next?"on":"off");}catch{}}}>
          {sound?<Volume2 size={17}/>:<VolumeX size={17}/>}
        </button>
        <button type="button" aria-label="Refresh incoming orders" onClick={()=>void refresh()}>
          <RefreshCw size={17}/>
        </button>
      </div>
    </header>
    {alert&&<div className="pos-inbox-alert" role="status" aria-live="polite">
      <Bell size={19} aria-hidden="true"/>
      <div><strong>New customer order #{alert.orderNumber}</strong>
        <small>{alert.servicePoint??"Customer menu"} · {alert.items.length} items</small></div>
      <button disabled={!!busy} type="button" onClick={()=>void accept(alert)}>
        {busy===alert.orderId?"Accepting…":"Accept & Send"}</button>
      <button type="button" aria-label="Dismiss notification, keep order"
        onClick={()=>setDismissed(prev=>new Set([...prev,alert.orderId]))}><X size={17}/></button>
    </div>}
    {lastAccepted&&<div className="pos-inbox-confirm" role="status"><Check size={16}/>
      Order #{lastAccepted.order} accepted and sent to service.
      <Link href={"/dashboard/pos/receipts/"+encodeURIComponent(lastAccepted.saleId)}
        target="_blank" rel="noopener"><Printer size={15}/> Print bill</Link></div>}
    {error&&<p className="till-notice" role="alert">{error}</p>}
    {!inbox&&!error&&<p className="till-empty">Loading incoming orders…</p>}
    {inbox&&pending.length===0&&<p className="till-empty">All caught up. New customer orders will appear here.</p>}
    <div className="pos-inbox-grid">
      {pending.map(order=><article className="pos-inbox-order" key={order.orderId}>
        <div className="pos-inbox-order-head">
          <div><strong>Order #{order.orderNumber}</strong>
            <small>{order.source==="online"?"Online":"Customer menu"} · {order.servicePoint??order.fulfillmentMode.replace("_"," ")}</small></div>
          <span className="pos-awaiting">Awaiting acceptance</span>
        </div>
        <div className="pos-inbox-items">
          {order.items.map((item,index)=><div key={index}>
            <span>{item.quantity} × {item.name}{item.variant?" · "+item.variant:""}</span>
            {item.notes&&<small>{item.notes}</small>}
          </div>)}
        </div>
        {order.customerName&&<small>Guest: {order.customerName}</small>}
        <div className="pos-inbox-foot">
          <strong>{formatMoney(order.subtotalMinor,order.currency)} <small>pre-tax</small></strong>
          <button type="button" disabled={!!busy} onClick={()=>void accept(order)}>
            {busy===order.orderId?"Accepting…":"Accept & Send"} <ArrowRight size={15}/>
          </button>
        </div>
      </article>)}
    </div>
    {inbox?.overflow&&<p className="till-notice">More orders are awaiting acceptance than the first 50 shown. Accept or process older orders to reveal the rest.</p>}
  </section>;
}
