"use client";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, ArrowLeft, ArrowRight, RefreshCcw, ScanLine, ShieldCheck, Sparkles, X, CheckCircle2, AlertCircle, UploadCloud } from "lucide-react";
import { currencyExponent } from "@/lib/money";

type Source = { id: string; pageIndex: number; status: string; width: number | null; height: number | null };
type Candidate = { document: { categories: Array<{ id: string; name: { value: string | null };
  items: Array<{ id: string; name: { value: string | null }; priceMinor: { value: number | null; review: string } }> }> } };
type Session = { id: string; status: string; revision: number; currency: string; sources: Source[]; candidate: Candidate | null };
type SessionSummary = Pick<Session, "id" | "revision" | "currency" | "status">;
type Draft = { id: string; pageIndex: number; file: File; preview: string; state: "pending" | "uploading" | "ready" | "error"; error?: string };
const MAX_PHOTO = 5 * 1024 * 1024;
const supported = new Set(["image/jpeg", "image/png", "image/webp"]);
function statusText(status: string) {
  return ({ collecting:"Collect photographs", queued:"Waiting for processing", processing:"Interpreting your menu",
    needs_review:"Ready for human review", ready:"Awaiting review", applied:"Applied", failed:"Processing needs attention",
    cancelled:"Cancelled", expired:"Expired" } as Record<string,string>)[status] ?? "Checking status";
}
export function CaptureWizard({ outletId, outletName, currency }: {outletId:string;outletName:string;currency:string}) {
  const [history,setHistory]=useState<SessionSummary[]>([]);
  const [session,setSession]=useState<Session | null>(null);
  const [drafts,setDrafts]=useState<Draft[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [engine,setEngine]=useState(false);
  const [consent,setConsent]=useState(false);
  const [previews,setPreviews]=useState<Record<string,string>>({});
  const creation=useRef<{id:string;key:string}|null>(null);
  const localUrls=useRef(new Set<string>());
  const json=useCallback(async <T,>(url:string,options:RequestInit={}):Promise<T>=>{
    const response=await fetch(url,{...options,cache:"no-store",headers:{"x-outlet-id":outletId,...options.headers}});
    const body=await response.json().catch(()=>({message:"The server did not return a valid response"}));
    if(!response.ok) throw new Error(body.message ?? "Request failed. Your existing photos are safe.");
    return body as T;
  // The outlet selector is explicit; never depend on a demo/implicit tenant.
  },[outletId]);
  const refresh=useCallback(async(id:string)=>{
    const next=await json<Session>("/api/menu-imports/"+encodeURIComponent(id));
    setSession(next);return next;
  },[json]);
  useEffect(()=>{
    let active=true;
    void json<SessionSummary[]>("/api/menu-imports").then(rows=>{if(active)setHistory(rows);})
      .catch(()=>{if(active)setError("Import history could not be loaded. Retry from this page.");});
    void json<{enabled:boolean}>("/api/menu-imports/engine").then(data=>{if(active)setEngine(data.enabled);})
      .catch(()=>{if(active)setEngine(false);});
    const urls=localUrls.current;
    return ()=>{active=false;urls.forEach(url=>URL.revokeObjectURL(url));};
  },[json]);
  useEffect(()=>{
    if(!session || !["queued","processing"].includes(session.status))return;
    let live=true;
    const timer=window.setInterval(()=>{void refresh(session.id).catch(()=>{if(live)setNotice("Connection interrupted. Use Refresh to check your existing session.");});},4000);
    return ()=>{live=false;window.clearInterval(timer);};
  },[session?.id,session?.status,refresh]);
  const sourceIds=session?.sources.filter(s=>s.status==="ready").map(s=>s.id).join(",") ?? "";
  useEffect(()=>{
    const id=session?.id;if(!id||!sourceIds)return;
    let active=true;const urls:string[]=[];
    void Promise.all(sourceIds.split(",").map(async sourceId=>{
      const response=await fetch("/api/menu-imports/"+encodeURIComponent(id)+"/sources/"+encodeURIComponent(sourceId),
        {cache:"no-store",headers:{"x-outlet-id":outletId}});
      if(!response.ok)return null;
      const blob=await response.blob();
      if(!active)return null;
      const url=URL.createObjectURL(blob);urls.push(url);
      return [sourceId,url] as const;
    })).then(rows=>{if(active)setPreviews(Object.fromEntries(rows.filter((r):r is readonly [string,string]=>r!==null)));})
      .catch(()=>{if(active)setNotice("Some private previews could not be loaded. Your uploaded files are still saved.");});
    return ()=>{active=false;urls.forEach(URL.revokeObjectURL);};
  },[session?.id,sourceIds,outletId]);
  async function begin(){
    if(busy)return;setBusy(true);setError("");setNotice("");
    const command=creation.current ?? {id:crypto.randomUUID(),key:crypto.randomUUID()};creation.current=command;
    try{
      const created=await json<{id:string}>("/api/menu-imports",{method:"POST",
        headers:{"content-type":"application/json"},body:JSON.stringify(command)});
      creation.current=null;setDrafts([]);setConsent(false);
      await refresh(created.id);setNotice("Private draft created. Your live menu remains unchanged.");
      setHistory(prev=>prev.filter(i=>i.id!==created.id));
    }catch(err){setError(err instanceof Error?err.message:"Could not start import. Retry safely.");}
    finally{setBusy(false);}
  }
  function choose(files:FileList|null) {
    if(!session||session.status!=="collecting"||!files?.length)return;
    setError("");setNotice("");
    const chosen=Array.from(files);
    if(chosen.some(f=>!supported.has(f.type)||f.size===0||f.size>MAX_PHOTO)){
      setError("Only nonempty JPEG, PNG or WebP files up to 5 MiB each are supported.");return;
    }
    const ready=session.sources.filter(s=>s.status==="ready");
    const reserved=session.sources.filter(s=>s.status!=="ready").sort((a,b)=>a.pageIndex-b.pageIndex);
    if(chosen.length+ready.length+drafts.filter(d=>d.state!=="ready").length>12){
      setError("One draft supports up to 12 photographs. Remove extras or start a new draft.");return;
    }
    const next=Math.max(-1,...session.sources.map(s=>s.pageIndex),...drafts.map(d=>d.pageIndex))+1;
    let cursor=0;
    const items=chosen.map(file=>{
      const retry=reserved[cursor];
      const index=retry?retry.pageIndex:next+cursor-reserved.length-1;
      cursor++;
      const preview=URL.createObjectURL(file);localUrls.current.add(preview);
      return {id:retry?.id??crypto.randomUUID(),pageIndex:index,file,preview,state:"pending" as const};
    });
    setDrafts(prev=>[...prev,...items]);setNotice("Use a clear, flat image with all prices visible.");
  }
  function drop(id:string){
    setDrafts(prev=>prev.filter(d=>{if(d.id===id){URL.revokeObjectURL(d.preview);localUrls.current.delete(d.preview);return false;}return true;}));
  }
  async function upload(){
    if(!session||busy||!drafts.some(d=>d.state==="pending"||d.state==="error"))return;
    setBusy(true);setError("");setNotice("");
    let current=session;
    for(const item of drafts.filter(d=>d.state==="pending"||d.state==="error").sort((a,b)=>a.pageIndex-b.pageIndex)){
      setDrafts(prev=>prev.map(d=>d.id===item.id?{...d,state:"uploading",error:undefined}:d));
      try{
        const response=await fetch("/api/menu-imports/"+encodeURIComponent(current.id)+"/sources",{
          method:"POST",cache:"no-store",headers:{"x-outlet-id":outletId,"content-type":item.file.type,
            "x-import-source-id":item.id,"x-import-page-index":String(item.pageIndex)},body:item.file});
        const body=await response.json().catch(()=>({message:"Upload response unavailable"}));
        if(!response.ok)throw new Error(body.message ?? "Upload could not be completed");
        setDrafts(prev=>prev.map(d=>d.id===item.id?{...d,state:"ready"}:d));
        current=await refresh(current.id);
      }catch(err){
        const message=err instanceof Error?err.message:"Upload interrupted";
        setDrafts(prev=>prev.map(d=>d.id===item.id?{...d,state:"error",error:message}:d));
        setError("An upload stopped. Retry uses the same source ID; nothing is published.");
        break;
      }
    }
    setBusy(false);
  }
  async function cancel(){
    if(!session||busy)return;
    setBusy(true);setError("");
    try{await json("/api/menu-imports/"+encodeURIComponent(session.id)+"/cancel",{
      method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({expectedRevision:session.revision})});
      await refresh(session.id);setNotice("Import cancelled. Stored photos remain private under the retention policy.");
    }catch(err){setError(err instanceof Error?err.message:"Cancellation failed; refresh the status.");}
    finally{setBusy(false);}
  }
  async function process(){
    if(!session||busy||!consent||!engine)return;
    setBusy(true);setError("");
    try{await json("/api/menu-imports/"+encodeURIComponent(session.id)+"/process",{
      method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({expectedRevision:session.revision,consent:true})});
      await refresh(session.id);setNotice("Extraction queued. This is a review draft, never an automatic menu change.");
    }catch(err){setError(err instanceof Error?err.message:"Could not start extraction.");}
    finally{setBusy(false);}
  }
  const collecting=session?.status==="collecting";
  const readyCount=session?.sources.filter(s=>s.status==="ready").length??0;
  const totalCount=session?.sources.length??0;
  const minor=currencyExponent(currency)??2;
  function money(n:number){return new Intl.NumberFormat(undefined,{style:"currency",currency}).format(n/10**minor);}
  return <div className="mx-auto max-w-5xl space-y-7 pb-16">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link href="/dashboard/menu" className="inline-flex items-center gap-2 text-sm font-semibold text-stone-600 hover:text-orange-700"><ArrowLeft className="size-4"/>Back to Menu Studio</Link>
      <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-bold text-orange-800">PRIVATE · REVIEW FIRST</span>
    </div>
    <header className="rounded-3xl border border-orange-200 bg-gradient-to-br from-orange-50 via-white to-amber-50 p-6 shadow-sm sm:p-9">
      <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-orange-600 text-white shadow-lg shadow-orange-200"><ScanLine className="size-6"/></div>
      <p className="text-xs font-bold tracking-[.2em] text-orange-700 uppercase">Smart Menu Studio / Capture</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-stone-950 sm:text-4xl">From a paper menu to a beautiful draft.</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-600">Photograph your printed menu for {outletName}. Store clear pages privately, then review extracted dishes and prices before making any changes. Your published menu is never overwritten by this wizard.</p>
      <div className="mt-6 flex flex-wrap gap-3 text-xs font-semibold text-stone-600"><span className="inline-flex items-center gap-1"><ShieldCheck className="size-4 text-orange-700"/>Private source storage</span><span>12 pages maximum</span><span>5 MiB per photo</span><span>{currency} outlet prices</span></div>
    </header>
    <div className="grid gap-4 sm:grid-cols-3">
      {([{number:"01",title:"Capture",copy:"Camera or gallery. Keep prices sharp and visible."},
        {number:"02",title:"Extract",copy:"Optional provider processing, only when licensed and enabled."},
        {number:"03",title:"Review",copy:"Uncertain prices stay blank. No automatic publishing."}]).map(step=>
        <div key={step.number} className="rounded-2xl border border-stone-200 bg-white p-5"><span className="text-xs font-black text-orange-600">{step.number}</span><h2 className="mt-1 font-bold text-stone-900">{step.title}</h2><p className="mt-2 text-sm leading-6 text-stone-600">{step.copy}</p></div>)}
    </div>
    {error&&<div role="alert" className="flex gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertCircle className="size-5 shrink-0"/>{error}</div>}
    {notice&&<p role="status" className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">{notice}</p>}
    {!session?<section className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
      <h2 className="text-xl font-bold text-stone-950">Your private import drafts</h2>
      <p className="mt-2 text-sm text-stone-600">Reopen an interrupted draft, or create a fresh one. Camera files are not stored in your browser between visits.</p>
      <button type="button" onClick={begin} disabled={busy} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-50"><ImagePlus className="size-4"/>Create private draft</button>
      {history.length>0&&<div className="mt-6 space-y-2">{history.map(item=><button key={item.id} type="button" disabled={busy} onClick={()=>{setDrafts([]);setConsent(false);setError("");void refresh(item.id).catch(()=>setError("Could not reopen this draft."));}} className="flex w-full items-center justify-between rounded-xl border border-stone-200 p-4 text-left hover:border-orange-400"><span className="min-w-0"><span className="block text-sm font-semibold text-stone-900">{statusText(item.status)}</span><span className="block truncate text-xs text-stone-500">{item.id}</span></span><ArrowRight className="size-4 text-orange-600"/></button>)}</div>}
    </section>:<>
      <section className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-xs font-bold tracking-widest text-orange-700 uppercase">Current draft</p><h2 className="mt-1 text-xl font-bold text-stone-950">{statusText(session.status)}</h2><p className="mt-1 text-xs text-stone-500">Revision {session.revision} · {readyCount} securely uploaded</p></div>
          <div className="flex gap-2"><button type="button" onClick={()=>{void refresh(session.id).catch(()=>setError("Refresh failed"));}} aria-label="Refresh import" className="rounded-xl border border-stone-200 p-3 text-stone-700"><RefreshCcw className="size-4"/></button><button type="button" onClick={()=>{setSession(null);setDrafts([]);setConsent(false);}} className="rounded-xl border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-700">All drafts</button></div>
        </div>
        {collecting&&<div className="mt-6 space-y-5">
          <div className="rounded-2xl border border-dashed border-orange-300 bg-orange-50/60 p-5">
            <div className="flex flex-wrap gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-orange-600 px-4 py-3 text-sm font-bold text-white"><Camera className="size-4"/>Use camera<input aria-label="Capture menu photograph" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" disabled={busy} onChange={e=>{choose(e.target.files);e.target.value="";}}/></label>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm font-bold text-stone-900"><ImagePlus className="size-4"/>Choose from gallery<input aria-label="Choose menu photographs" type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" disabled={busy} onChange={e=>{choose(e.target.files);e.target.value="";}}/></label>
            </div>
            <p className="mt-3 text-xs leading-6 text-stone-600">Include the full page, lay it flat, avoid shadows and glare, and photograph small print up close. JPEG/PNG/WebP only; no PDF in this camera workflow.</p>
          </div>
          {drafts.length>0&&<div className="space-y-3">{drafts.map(d=><div key={d.id} className="flex items-center gap-3 rounded-xl border border-stone-200 p-3">
            <Image src={d.preview} width={64} height={64} unoptimized alt={"Selected menu photograph "+(d.pageIndex+1)} className="size-16 rounded-lg object-cover"/>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-stone-900">{d.file.name}</p><p className="text-xs text-stone-600">Page {d.pageIndex+1} · {(d.file.size/1048576).toFixed(2)} MiB · {d.state}</p>{d.error&&<p role="alert" className="text-xs text-red-700">{d.error}</p>}</div>
            {d.state!=="ready"&&d.state!=="uploading"&&<button type="button" onClick={()=>drop(d.id)} aria-label={"Remove "+d.file.name} className="rounded-lg p-2 text-stone-500 hover:text-red-700"><X className="size-4"/></button>}
            {d.state==="ready"&&<CheckCircle2 className="size-5 text-green-700"/>}
          </div>)}</div>}
          <button type="button" disabled={busy||!drafts.some(d=>d.state==="pending"||d.state==="error")} onClick={()=>{void upload();}} className="inline-flex items-center gap-2 rounded-xl bg-stone-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-40"><UploadCloud className="size-4"/>Upload photos privately</button>
        </div>}
        {session.sources.length>0&&<div className="mt-6"><h3 className="text-sm font-bold text-stone-900">Saved sources</h3><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">{session.sources.map(s=><div key={s.id} className="rounded-xl border border-stone-200 p-2">
          {previews[s.id]?<Image src={previews[s.id]} width={250} height={180} unoptimized alt={"Private menu source page "+(s.pageIndex+1)} className="h-28 w-full rounded-lg object-cover"/>:<div className="flex h-28 items-center justify-center rounded-lg bg-stone-100 text-stone-500"><ScanLine className="size-7"/></div>}
          <p className="mt-2 text-xs font-bold text-stone-800">Page {s.pageIndex+1} · {s.status}</p><p className="text-xs text-stone-500">{s.width&&s.height?s.width+" × "+s.height:"Upload may need retry"}</p>
        </div>)}</div></div>}
        {collecting&&<div className="mt-6 rounded-2xl border border-stone-200 p-5"><div className="flex items-center gap-2 font-bold text-stone-900"><Sparkles className="size-5 text-orange-600"/>Optional AI interpretation</div>
          {!engine?<p className="mt-2 text-sm text-stone-600">Extraction is currently unavailable. Your {totalCount} stored page(s) remain private. You can return when the licensed provider is enabled.</p>:<><p className="mt-2 text-sm text-stone-600">This sends your saved photos to the configured AI provider for transcription. A person must verify the resulting draft; it never publishes automatically.</p>
            <label className="mt-3 flex items-start gap-2 text-sm text-stone-700"><input aria-label="Consent to AI image interpretation" type="checkbox" className="mt-1" checked={consent} onChange={e=>setConsent(e.target.checked)}/>I am authorized to submit these images for third-party AI interpretation.</label>
            <button type="button" disabled={busy||!consent||!readyCount||session.sources.some(s=>s.status!=="ready")||drafts.some(d=>d.state!=="ready")} onClick={()=>{void process();}} className="mt-4 rounded-xl bg-orange-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-40">Start extraction</button>
          </>}
        </div>}
        {["queued","processing"].includes(session.status)&&<p role="status" className="mt-5 rounded-xl bg-orange-50 p-4 text-sm text-orange-900">Your draft is being processed. This page checks progress automatically; returning later is safe.</p>}
        {session.status==="failed"&&<p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">The engine could not produce a trustworthy draft. Nothing has been published. Start a fresh private import if you want to try again.</p>}
        {!["applied","cancelled","failed","expired"].includes(session.status)&&<button type="button" onClick={()=>{void cancel();}} disabled={busy} className="mt-6 text-sm font-semibold text-red-700 underline disabled:opacity-50">Cancel this import</button>}
      </section>
      {session.candidate&&<section className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-7">
        <div className="flex items-center gap-2"><ShieldCheck className="size-5 text-orange-600"/><h2 className="text-xl font-bold text-stone-900">Extraction preview — review required</h2></div>
        <p className="mt-2 text-sm text-stone-600">These are untrusted suggestions. Check every name and price against the photographs. This package does not apply or publish them.</p>
        <div className="mt-5 space-y-5">{session.candidate.document.categories.map(c=><div key={c.id} className="overflow-hidden rounded-xl border border-stone-200">
          <h3 className="bg-stone-50 px-4 py-3 font-bold text-stone-900">{c.name.value??"Unreadable heading"}</h3>
          {c.items.map(i=><div key={i.id} className="flex justify-between gap-4 border-t border-stone-100 px-4 py-3 text-sm"><span className="font-medium text-stone-800">{i.name.value??"Unreadable dish"}</span><span className={i.priceMinor.value===null?"font-semibold text-orange-700":"font-bold text-stone-900"}>{i.priceMinor.value===null?"Confirm price":money(i.priceMinor.value)}</span></div>)}
        </div>)}</div>
      </section>}
    </>}
  </div>;
}
