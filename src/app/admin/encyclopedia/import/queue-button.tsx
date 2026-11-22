"use client";
import { useState, useTransition } from "react";
import { queueExistingDishCatalogue } from "./actions";
export function CatalogueImportButton(){
 const [pending,startTransition]=useTransition();
 const [message,setMessage]=useState<{ok:boolean;text:string}|null>(null);
 return <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-900 dark:bg-orange-950/20">
   <p className="mb-3 text-sm">A fresh administrator step-up is required before importing the candidate list. Repeated imports skip existing IDs; published content is never touched.</p>
   <button type="button" disabled={pending} onClick={()=>startTransition(async()=>{
     const result=await queueExistingDishCatalogue(crypto.randomUUID());
     setMessage({ok:result.ok,text:result.message});
   })} className="rounded-xl bg-orange-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{pending?"Importing candidates…":"Queue catalogue candidates"}</button>
   {message&&<p role={message.ok?"status":"alert"} className="mt-3 text-sm">{message.text}</p>}
 </div>;
}
