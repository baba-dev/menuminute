import type { Metadata } from "next";
import Link from "next/link";
import { verifySuperAdmin } from "@/lib/admin-guard";
import { catalogueCandidates, listStoredCandidates } from "@/modules/food-encyclopedia/catalogue";
import { CatalogueImportButton } from "./queue-button";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Food catalogue candidates | Editorial Studio",robots:{index:false}};
export default async function CatalogueImportPage(){
 const actor=await verifySuperAdmin();
 let stored:Awaited<ReturnType<typeof listStoredCandidates>>=[];
 let installed=true;
 try{stored=await listStoredCandidates(actor);}catch{installed=false}
 const ids=new Set(stored.map(x=>x.id));
 return <div className="space-y-6">
   <Link href="/admin/encyclopedia" className="text-sm font-semibold text-orange-700 underline dark:text-orange-300">Back to Editorial Studio</Link>
   <header><p className="text-xs font-semibold uppercase tracking-widest text-orange-600">Unpublished research candidates</p>
     <h1 className="mt-2 font-display text-3xl font-bold">Existing dish catalogue</h1>
     <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone-600 dark:text-stone-400">
       The catalogue is suggestion data only. Importing queues names and descriptions for human research; it never creates a public article or asserts any dietary safety.
     </p></header>
   <div className="grid gap-3 sm:grid-cols-3">{[["Available candidates",catalogueCandidates.length],["Queued",stored.length],["Not yet queued",catalogueCandidates.length-stored.length]].map(([title,value])=>
     <div key={title} className="rounded-xl border border-stone-200 p-4 dark:border-stone-800">
       <p className="text-xs text-stone-500">{title}</p><strong className="mt-1 block text-3xl">{value}</strong></div>)}</div>
   {!installed?<p role="alert" className="rounded-xl bg-amber-100 p-4 text-sm text-amber-950">The editorial database is not installed yet. No import has run.</p>
    :<CatalogueImportButton />}
   <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{catalogueCandidates.slice(0,60).map(c=><div key={c.id} className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
     <div className="flex items-center justify-between gap-2"><span className="font-semibold">{c.name}</span><span className="text-xs text-stone-500">{ids.has(c.id)?"Queued":"Pending"}</span></div>
     <p className="mt-2 text-xs text-stone-500">{c.hint} · {c.id}</p>
     <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">{c.suggestion}</p>
     <Link className="mt-3 inline-block text-sm font-bold text-orange-700 dark:text-orange-300" href={"/admin/encyclopedia/new?candidate="+encodeURIComponent(c.id)}>Research this dish →</Link>
   </div>)}</div>
 </div>;
}
