"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowDown, FileText, RefreshCw, Search, ShieldCheck, X } from "lucide-react";
import type { AdminLogEntry, AdminLogResult } from "@/modules/admin/logs.service";

const levelLabels = ["all","debug","info","warn","error","fatal"] as const;
const serviceLabels = ["all","web","worker"] as const;
export function LogExplorer() {
  const [level,setLevel] = useState<string>("all");
  const [service,setService] = useState<string>("all");
  const [range,setRange] = useState("24h");
  const [search,setSearch] = useState("");
  const [live,setLive] = useState(false);
  const [pageCursor,setPageCursor] = useState<string | null>(null);
  const [result,setResult] = useState<AdminLogResult | null>(null);
  const [selected,setSelected] = useState<AdminLogEntry | null>(null);
  const [loading,setLoading] = useState(false);
  const [failure,setFailure] = useState<string | null>(null);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setFailure(null);
    try {
      const q = new URLSearchParams({range});
      if (level !== "all") q.set("level",level);
      if (service !== "all") q.set("service",service);
      if (search.trim()) q.set("search",search.trim().slice(0,80));
      if (pageCursor) q.set("before",pageCursor);
      const response = await fetch("/api/admin/logs?"+q.toString(),{
        cache:"no-store",credentials:"same-origin",signal,
      });
      if (!response.ok) throw new Error("Log access unavailable ("+response.status+")");
      const data = (await response.json()) as AdminLogResult;
      if (!signal?.aborted) setResult(data);
    } catch (error) {
      if (!signal?.aborted) setFailure(error instanceof Error ? error.message : "Unable to read logs");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  },[level,service,range,search,pageCursor]);
  useEffect(()=>{
    const controller = new AbortController();
    void refresh(controller.signal);
    if (!live) return ()=>controller.abort();
    const interval = setInterval(()=>{
      if (document.visibilityState === "visible") void refresh(controller.signal);
    },8000);
    return ()=>{controller.abort();clearInterval(interval);};
  },[refresh,live]);
  const resetCursor = () => setPageCursor(null);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><FileText className="h-6 w-6 text-orange-400"/><h1 className="text-2xl font-bold tracking-tight">Logs &amp; Diagnostics</h1></div>
          <p className="mt-1 max-w-2xl text-sm text-stone-400">Read-only, sanitized MenuMinute web and worker events. Database audit records remain in Security &amp; Audits.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 rounded-xl border border-stone-700 px-3 py-2 text-xs text-stone-200"><input type="checkbox" checked={live} onChange={event=>setLive(event.target.checked)} className="accent-orange-500"/> Live tail (8s)</label>
          <button type="button" onClick={()=>void refresh()} className="flex items-center gap-2 rounded-xl bg-orange-600 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-500"><RefreshCw className="h-4 w-4"/>Refresh</button>
        </div>
      </div>
      <div className="grid gap-3 rounded-2xl border border-stone-800 bg-stone-900 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-stone-400">Severity<select aria-label="Severity" value={level} onChange={e=>{setLevel(e.target.value);resetCursor();}} className="mt-1 block w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100">{levelLabels.map(x=><option key={x} value={x}>{x==="all"?"All severities":x.toUpperCase()}</option>)}</select></label>
        <label className="text-xs text-stone-400">Service<select aria-label="Service" value={service} onChange={e=>{setService(e.target.value);resetCursor();}} className="mt-1 block w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100">{serviceLabels.map(x=><option key={x} value={x}>{x==="all"?"Both services":x}</option>)}</select></label>
        <label className="text-xs text-stone-400">Time range<select aria-label="Time range" value={range} onChange={e=>{setRange(e.target.value);resetCursor();}} className="mt-1 block w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100">{["1h","24h","7d","14d"].map(x=><option key={x}>{x}</option>)}</select></label>
        <label className="text-xs text-stone-400">Search<input aria-label="Search logs" maxLength={80} value={search} onChange={e=>{setSearch(e.target.value);resetCursor();}} placeholder="Trace, error, outlet..." className="mt-1 block w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100" /></label>
      </div>
      {failure && <div role="alert" className="rounded-xl border border-red-800 bg-red-950/40 p-4 text-sm text-red-300"><AlertTriangle className="mr-2 inline h-4 w-4"/>{failure}</div>}
      {result && !result.available && <div role="status" className="rounded-xl border border-amber-800 bg-amber-950/30 p-5 text-sm text-amber-200"><AlertTriangle className="mr-2 inline h-4 w-4"/>{result.reason}. No absence-of-errors claim can be made while collection is unavailable.</div>}
      {result?.available && <>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-400">
          <span><ShieldCheck className="mr-1 inline h-4 w-4 text-emerald-400"/> Sanitized collector · {result.entries.length} displayed · {loading?"Refreshing": "Snapshot"} </span>
          <span>Collected {new Date(result.collection?.capturedAt ?? result.capturedAt).toLocaleString()} · {Math.round((result.collection?.bytes ?? 0)/1048576)} MiB indexed</span>
        </div>
        <div className="overflow-hidden rounded-2xl border border-stone-800 bg-stone-900">
          <div className="divide-y divide-stone-800">
            {result.entries.map((entry,i)=><button type="button" key={entry.timestamp+"-"+i} onClick={()=>setSelected(entry)} className="grid w-full gap-2 px-4 py-3 text-left transition hover:bg-stone-800/70 sm:grid-cols-[150px_68px_68px_minmax(0,1fr)] sm:items-center">
              <time className="font-mono text-[11px] text-stone-400">{new Date(entry.timestamp).toLocaleString()}</time>
              <span className={"w-fit rounded-md px-2 py-0.5 text-[10px] font-bold uppercase "+(entry.level==="error"||entry.level==="fatal"?"bg-rose-950 text-rose-300":entry.level==="warn"?"bg-amber-950 text-amber-300":"bg-stone-800 text-sky-300")}>{entry.level}</span>
              <span className="text-xs text-stone-400">{entry.service}</span>
              <span className="min-w-0 truncate text-xs text-stone-200">{entry.message}</span>
            </button>)}
            {result.entries.length===0 && <p className="p-10 text-center text-sm text-stone-400">No indexed events match these filters.</p>}
          </div>
        </div>
        {result.nextBefore && <button onClick={()=>{setPageCursor(result.nextBefore);setLive(false);}} className="flex items-center gap-2 rounded-lg border border-stone-700 px-3 py-2 text-xs text-stone-300 hover:bg-stone-800"><ArrowDown className="h-4 w-4"/>Older entries</button>}
      </>}
      {selected && <div role="dialog" aria-modal="true" aria-label="Log entry details" className="fixed inset-0 z-50 flex justify-end bg-black/70" onClick={()=>setSelected(null)}>
        <div className="h-full w-full max-w-lg overflow-y-auto border-l border-stone-700 bg-stone-950 p-5 shadow-2xl" onClick={e=>e.stopPropagation()}>
          <div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-bold">Event details</h2><button aria-label="Close" onClick={()=>setSelected(null)}><X className="h-5 w-5"/></button></div>
          <p className="mb-4 text-sm text-stone-300">{selected.message}</p>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-xl border border-stone-800 bg-stone-900 p-4 text-xs leading-relaxed text-stone-300">{JSON.stringify(selected,null,2)}</pre>
          <p className="mt-4 text-xs text-stone-500">Only approved sanitized fields are displayed. Raw journal entries are never exposed.</p>
        </div>
      </div>}
      <div className="flex items-center gap-2 text-xs text-stone-500"><Search className="h-4 w-4"/>This read-only viewer does not run host shell commands or query other applications.</div>
    </div>
  );
}
