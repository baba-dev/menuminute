"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { FloorTable } from "@/modules/hospitality/floor-matrix";
export function TableFloorMatrix({tables,currency}:{tables:FloorTable[]|null;currency:string}){
 const router=useRouter();
 const [filter,setFilter]=useState<"all"|"active"|"unpaid">("all");
 const [refreshing,setRefreshing]=useState(false);
 useEffect(()=>{
   const id=window.setInterval(()=>{
      if(document.visibilityState==="visible")router.refresh();
   },20000);
   return ()=>window.clearInterval(id);
 },[router]);
 const rows=(tables??[]).filter(t=>filter==="all"||(filter==="active"?t.activeOrders>0:t.unpaidOrders>0));
 const fmt=(minor:string)=>{
   const dec=new Intl.NumberFormat("en",{style:"currency",currency}).resolvedOptions().maximumFractionDigits??2;
   return new Intl.NumberFormat(undefined,{style:"currency",currency}).format(Number(minor)/10**dec);
 };
 return <section aria-labelledby="floor-matrix-title" className="my-6 rounded-xl border border-stone-300 bg-stone-50 p-4 dark:border-stone-700 dark:bg-stone-950">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><h2 id="floor-matrix-title" className="font-display text-lg font-bold">Dining Room · Order Activity</h2>
    <p className="text-xs text-stone-500 dark:text-stone-400">Outstanding table orders and unpaid balances · Updates approximately every 20 seconds. Not a physical occupancy sensor.</p></div>
   <button type="button" onClick={()=>{setRefreshing(true);router.refresh();window.setTimeout(()=>setRefreshing(false),700)}} disabled={refreshing}
    className="min-h-11 rounded-lg border border-current/20 px-4 py-2 text-sm">Refresh floor</button>
  </div>
  {tables===null?<p role="status" className="py-6 text-sm">Floor data unavailable or your role does not include order access. No table availability claim is being made.</p>
  :tables.length===0?<p className="py-6 text-sm">No active dining tables configured. <Link href="/dashboard/qr-codes" className="underline">Manage service points</Link>.</p>
  :<>
   <div className="my-4 flex flex-wrap gap-2" role="group" aria-label="Filter dining room order activity">
    {(["all","active","unpaid"] as const).map(k=><button type="button" key={k}
      aria-pressed={filter===k} onClick={()=>setFilter(k)}
      className={`min-h-11 rounded-lg border px-4 py-2 text-xs font-semibold ${filter===k?"bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-950":"border-current/20"}`}>
      {k==="all"?"All tables":k==="active"?"Active orders":"Unpaid tabs"} ({k==="all"?tables.length:k==="active"?tables.filter(t=>t.activeOrders>0).length:tables.filter(t=>t.unpaidOrders>0).length})
     </button>)}
   </div>
   <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
    {rows.map(t=><li key={t.id} className="rounded-lg border border-stone-300 bg-white p-4 dark:border-stone-700 dark:bg-stone-900">
     <div className="flex items-start justify-between gap-2"><strong>Table {t.tableNumber}</strong>
      <span className="rounded-md border border-current/20 px-2 py-1 text-xs">{t.unpaidOrders>0?"Unpaid":t.activeOrders>0?"Order active":"No open tickets"}</span></div>
     {t.label&&<p className="mt-1 text-xs opacity-70">{t.label}</p>}
     <p className="mt-3 text-xs">{t.activeOrders} in progress · {t.unpaidOrders} unpaid</p>
     {t.unpaidOrders>0&&<p className="mt-1 font-semibold">Due: {fmt(t.dueMinor)}</p>}
     {t.latestOrderId&&<div className="mt-3 flex flex-wrap gap-2 border-t border-current/10 pt-3 text-xs">
       <Link href={`/dashboard/pos?attachOrder=${encodeURIComponent(t.latestOrderId)}`} className="underline underline-offset-2">View in Till</Link>
       <Link href="/dashboard/orders" className="underline underline-offset-2">Orders Rail</Link>
      </div>}
    </li>)}
   </ul>
   {rows.length===0&&<p className="py-6 text-sm">No tables match this filter.</p>}
  </>}
 </section>;
}
