"use client";
import { useEffect,useMemo,useRef,useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import {
 ArrowRight,BookOpen,Check,ChevronRight,ClipboardList,ExternalLink,Globe2,
 LockKeyhole,MapPin,Palette,RefreshCw,Save,Settings2,ShieldCheck,Store,
 UsersRound,Wallet,X,Mail,Phone,
} from "lucide-react";
import { ThemeControl } from "@/components/menu-product/theme-control";
import type { OutletProfileFields } from "@/modules/restaurants/profile";
type Outlet={name:string;slug:string;publicId:string;country:string;currency:string;timezone:string;
 outletType:string;fulfillmentModes:string[];isActive:boolean;isDemoData:boolean;profileVersion:number};
type Props={organizationId:string;outletId:string;outlet:Outlet;initial:OutletProfileFields;canManage:boolean;
 billing:{freeMenu:boolean;ordering:boolean;kitchen:boolean}|null};
const normalize=(fields:OutletProfileFields):OutletProfileFields=>({
 ...fields,description:fields.description?.trim()||null,phone:fields.phone?.trim()||null,
 email:fields.email?.trim()||null,website:fields.website?.trim()||null,
 addressLine1:fields.addressLine1?.trim()||null,addressLine2:fields.addressLine2?.trim()||null,
 city:fields.city?.trim()||null,state:fields.state?.trim()||null,
 postalCode:fields.postalCode?.trim()||null,
});
const safeColor=(v:string|null|undefined,fallback:string)=>/^#[0-9a-fA-F]{6}$/.test(v||"")?v!:fallback;
const anchors=[
 {id:"profile",label:"Restaurant profile",Icon:Store},
 {id:"contact",label:"Contact & location",Icon:MapPin},
 {id:"branding",label:"Brand appearance",Icon:Palette},
 {id:"operations",label:"Operational identity",Icon:ClipboardList},
 {id:"plan",label:"Plan & capabilities",Icon:Wallet},
 {id:"access",label:"People & security",Icon:ShieldCheck},
];
export function OutletAtelier({organizationId,outletId,outlet,initial,canManage,billing}:Props) {
 const [saved,setSaved]=useState<OutletProfileFields>(()=>normalize(initial));
 const [draft,setDraft]=useState<OutletProfileFields>(()=>normalize(initial));
 const [version,setVersion]=useState(outlet.profileVersion);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const controller=useRef<AbortController|null>(null);
 const bypassUnload=useRef(false);
 const current=normalize(draft);
 const dirty=JSON.stringify(current)!==JSON.stringify(saved);
 useEffect(()=>{
  const warn=(event:BeforeUnloadEvent)=>{
   if(!dirty||bypassUnload.current)return;event.preventDefault();event.returnValue="";
  };
  window.addEventListener("beforeunload",warn);
  return ()=>window.removeEventListener("beforeunload",warn);
 },[dirty]);
 useEffect(()=>()=>controller.current?.abort(),[]);
 const display=useMemo(()=>({
  primary:safeColor(draft.primaryColor,"#f97316"),
  secondary:safeColor(draft.secondaryColor,"#1c1917"),
 }),[draft.primaryColor,draft.secondaryColor]);
 function change<K extends keyof OutletProfileFields>(key:K,value:OutletProfileFields[K]){
  setDraft(old=>({...old,[key]:value}));setNotice("");setError("");
 }
 async function save(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  if(!canManage||!dirty||busy)return;
  const normalized=normalize(draft);
  setBusy(true);setError("");setNotice("");
  const abort=new AbortController();controller.current=abort;
  try{
   const response=await fetch("/api/organizations/"+encodeURIComponent(organizationId)+"/outlets/"+
    encodeURIComponent(outletId)+"/profile",{
     method:"PATCH",headers:{"content-type":"application/json"},
     body:JSON.stringify({expectedVersion:version,fields:normalized}),signal:abort.signal,
   });
   const body=await response.json().catch(()=>null);
   if(!response.ok){
    if(response.status===409)throw new Error("The outlet profile changed elsewhere. Review the latest version before saving again.");
    throw new Error(body?.message||"Unable to save the outlet profile.");
   }
   const next=normalize(body.fields as OutletProfileFields);
   setSaved(next);setDraft(next);setVersion(body.profileVersion);
   setNotice("Profile saved successfully.");
  }catch(cause){
   if(!abort.signal.aborted)setError(cause instanceof Error?cause.message:"Unable to confirm the save. Refresh to verify the current profile.");
  }finally{if(controller.current===abort){controller.current=null;setBusy(false);}}
 }
 const input=(key:keyof OutletProfileFields,label:string,options?:{type?:string;placeholder?:string;max?:number;help?:string})=>
  <label className="os-field" key={key}><span>{label}</span>
   <input name={key} type={options?.type||"text"} value={String(draft[key]||"")}
    maxLength={options?.max} placeholder={options?.placeholder} disabled={!canManage||busy}
    onChange={e=>change(key,e.target.value)} />
   {options?.help&&<small>{options.help}</small>}
  </label>;
 return <div className="product mm-settings" data-testid="outlet-atelier">
  <header className="os-hero">
   <div className="os-topbar">
    <nav aria-label="Breadcrumb" className="os-breadcrumb"><Link href="/dashboard">Workspace</Link><span aria-hidden="true">/</span><span aria-current="page">Settings</span></nav>
    <div className="os-top-actions"><ThemeControl/><Link href="/account">My account <ArrowRight size={14} aria-hidden="true"/></Link></div>
   </div>
   <div className="os-hero-copy"><span className="os-eyebrow">THE OUTLET ATELIER / SETTINGS</span>
    <h1>Every detail,<br/> beautifully yours.</h1>
    <p>Make <strong>{outlet.name}</strong> feel like your restaurant, wherever your guests discover it.</p>
    <div className="os-hero-actions"><a className="os-action os-action-primary" href="#profile">Personalize outlet <ArrowRight size={17} aria-hidden="true"/></a>
     <Link className="os-action os-action-outline" href="/dashboard/organization">Organization settings <UsersRound size={16} aria-hidden="true"/></Link></div>
   </div>
   <div className="os-hero-art" aria-hidden="true"><span className="os-art-ring"/><span className="os-art-card"><span className="os-art-symbol"><Store size={34}/></span><span className="os-art-line"/><span className="os-art-line os-art-short"/><span className="os-art-swatches"><i/><i/><i/></span></span><span className="os-art-pencil"/><span className="os-art-star"/></div>
  </header>
  <div className="os-body">
   <section className="os-pulse" aria-label="Current outlet overview"><div><span className="os-eyebrow">CURRENT OUTLET</span><strong>{outlet.name}</strong><small>{outlet.isDemoData?"Demo outlet":outlet.isActive?"Active workspace":"Inactive outlet"}</small></div>
    <div><span className="os-eyebrow">GUEST CURRENCY</span><strong>{outlet.currency}</strong><small>Existing prices remain unchanged</small></div>
    <div><span className="os-eyebrow">LOCAL TIMEZONE</span><strong>{outlet.timezone}</strong><small>{outlet.country} · {outlet.outletType.replaceAll("_"," ")}</small></div>
    <div><span className="os-eyebrow">PROFILE ACCESS</span><strong>{canManage?"Editor":"View only"}</strong><small>{canManage?"Authorized outlet management":"Ask your outlet manager"}</small></div>
   </section>
   <div className="os-workspace">
    <nav className="os-contents" aria-label="Settings sections"><span className="os-eyebrow">YOUR SETTINGS</span>
     {anchors.map(({id,label,Icon},i)=><a key={id} href={"#"+id}><Icon size={17} aria-hidden="true"/><span>{label}</span><small>{String(i+1).padStart(2,"0")}</small></a>)}
     <div className="os-contents-note"><Settings2 size={18} aria-hidden="true"/><p>Operational changes are linked to the appropriate guarded settings pages.</p></div>
    </nav>
    <div className="os-sections">
     <form onSubmit={save} className="os-edit-form">
      <section id="profile" className="os-panel" aria-labelledby="os-profile-title">
       <div className="os-panel-head"><span className="os-panel-icon"><Store size={20}/></span><div><span className="os-eyebrow">01 / THE ESSENTIALS</span><h2 id="os-profile-title">Restaurant profile.</h2><p>The details your guests recognize.</p></div></div>
       <label className="os-field"><span>Restaurant name</span><input value={outlet.name} readOnly aria-describedby="os-name-help"/><small id="os-name-help">Name and outlet identity are changed through the audited organization workflow.</small></label>
       <div className="os-field"><label htmlFor="os-description">Description</label><textarea id="os-description" name="description" value={draft.description||""} maxLength={500} rows={4} disabled={!canManage||busy}
        onChange={e=>change("description",e.target.value)} placeholder="What makes your restaurant special?"/><small>{(draft.description||"").length}/500 characters · This may appear on your public menu.</small></div>
       <Link className="os-inline-link" href="/dashboard/organization">Change outlet name <ArrowRight size={15}/></Link>
      </section>
      <section id="contact" className="os-panel" aria-labelledby="os-contact-title">
       <div className="os-panel-head"><span className="os-panel-icon"><MapPin size={20}/></span><div><span className="os-eyebrow">02 / STAY CONNECTED</span><h2 id="os-contact-title">Contact & location.</h2><p>Help guests find and reach you.</p></div></div>
       <div className="os-fields-two">{input("phone","Public phone",{type:"tel",max:40,placeholder:"+91 00000 00000"})}
        {input("email","Public email",{type:"email",max:254,placeholder:"hello@example.com"})}</div>
       {input("website","Website URL",{type:"url",max:512,placeholder:"https://example.com",help:"Use a complete HTTP or HTTPS address."})}
       {input("addressLine1","Address line 1",{max:180,placeholder:"Street address, building"})}
       {input("addressLine2","Address line 2",{max:180,placeholder:"Floor, landmark (optional)"})}
       <div className="os-fields-two">{input("city","City",{max:100})}{input("state","State / region",{max:100})}{input("postalCode","Postal code",{max:24})}</div>
       <p className="os-fine"><Mail size={15}/> Contact details are public-facing outlet information, not your private account recovery details.</p>
      </section>
      <section id="branding" className="os-panel" aria-labelledby="os-brand-title">
       <div className="os-panel-head"><span className="os-panel-icon"><Palette size={20}/></span><div><span className="os-eyebrow">03 / VISUAL IDENTITY</span><h2 id="os-brand-title">Brand appearance.</h2><p>Choose colors that make your outlet unmistakable.</p></div></div>
       <div className="os-brand-preview" style={{background:display.secondary,color:"#fff"}}>
        <div className="os-preview-mark" style={{background:display.primary}}><Store size={20} aria-hidden="true"/></div>
        <span>RESTAURANT PREVIEW</span><strong>{outlet.name}</strong><p>{draft.description||"Your story begins here."}</p>
        <i style={{background:display.primary}}/></div>
       <div className="os-fields-two">{(["primaryColor","secondaryColor"] as const).map((key)=>
        <label className="os-field" key={key}><span>{key==="primaryColor"?"Primary color":"Secondary color"}</span>
         <div className="os-color-control"><input aria-label={key==="primaryColor"?"Choose primary color":"Choose secondary color"}
           type="color" value={key==="primaryColor"?display.primary:display.secondary} disabled={!canManage||busy}
           onChange={e=>change(key,e.target.value)}/>
          <input type="text" aria-label={key==="primaryColor"?"Primary hex color":"Secondary hex color"} pattern="#[a-fA-F0-9]{6}"
           maxLength={7} value={draft[key]||""} disabled={!canManage||busy} onChange={e=>change(key,e.target.value)}/></div>
        </label>)}</div>
       <p className="os-fine">Preview is illustrative. The published menu uses its own release and styling rules.</p>
      </section>
      <div className="os-savebar"><div><strong>{!canManage?"View-only profile":dirty?"Unsaved changes":"All profile edits saved"}</strong><small>{canManage?"Profile version "+version:"Only authorized outlet managers may edit this profile."}</small></div>
       {canManage&&<div className="os-savebar-actions"><button type="button" className="os-reset" disabled={!dirty||busy} onClick={()=>{setDraft(saved);setError("");setNotice("");}}>Discard</button>
        <button type="submit" className="os-save" disabled={!dirty||busy}><Save size={16}/>{busy?"Saving…":"Save profile"}</button></div>}</div>
      {notice&&<p role="status" className="os-success"><Check size={16}/>{notice}</p>}
      {error&&<div role="alert" className="os-error"><span>{error}</span><button type="button" onClick={()=>{bypassUnload.current=true;window.location.reload();}}><RefreshCw size={15}/> Reload latest</button></div>}
     </form>
     <section id="operations" className="os-panel" aria-labelledby="os-operations-title">
      <div className="os-panel-head"><span className="os-panel-icon"><ClipboardList size={20}/></span><div><span className="os-eyebrow">04 / OPERATIONAL CONTROLS</span><h2 id="os-operations-title">Operational identity.</h2><p>Stable, auditable configuration for this outlet.</p></div></div>
      <dl className="os-info-grid">{[
       ["URL slug",outlet.slug],["Country",outlet.country],["Currency",outlet.currency],
       ["Timezone",outlet.timezone],["Outlet type",outlet.outletType.replaceAll("_"," ")],
       ["Fulfillment",outlet.fulfillmentModes.join(" + ").replaceAll("_","-")],
      ].map(([name,value])=><div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>
      <p className="os-fine"><LockKeyhole size={16}/> Currency changes with existing prices or orders require the guarded repricing workflow.</p>
      <Link className="os-card-link" href="/dashboard/organization">Manage outlet configuration <ChevronRight size={18}/></Link>
     </section>
     <section id="plan" className="os-panel" aria-labelledby="os-plan-title">
      <div className="os-panel-head"><span className="os-panel-icon"><Wallet size={20}/></span><div><span className="os-eyebrow">05 / CAPABILITIES</span><h2 id="os-plan-title">Plan & access.</h2><p>Actual organization entitlements, not estimated subscription labels.</p></div></div>
      {billing?<div className="os-plan-list"><div><BookOpen size={18}/><span>Public QR menus</span><strong>{billing.freeMenu?"Available":"Unavailable"}</strong></div>
       <div><Globe2 size={18}/><span>New online ordering</span><strong>{billing.ordering?"Enabled":"No active grant"}</strong></div>
       <div><ClipboardList size={18}/><span>New Kitchen Pro work</span><strong>{billing.kitchen?"Enabled":"No active grant"}</strong></div></div>:
       <p className="os-fine">Subscription and commercial entitlement details are available to authorized organization administrators.</p>}
      <Link className="os-card-link" href="/dashboard/organization">Organization & billing <ChevronRight size={18}/></Link>
     </section>
     <section id="access" className="os-panel" aria-labelledby="os-access-title">
      <div className="os-panel-head"><span className="os-panel-icon"><ShieldCheck size={20}/></span><div><span className="os-eyebrow">06 / SAFETY & PEOPLE</span><h2 id="os-access-title">People & security.</h2><p>Keep outlet operations and account protections distinct.</p></div></div>
      <div className="os-link-grid"><Link href="/dashboard/organization"><UsersRound size={21}/><strong>Organization & roles</strong><small>Team members, outlet grants and ownership</small><ArrowRight size={17}/></Link>
       <Link href="/account/security"><ShieldCheck size={21}/><strong>Account security</strong><small>Sign-in, MFA and active devices</small><ArrowRight size={17}/></Link>
       <Link href="/dashboard/qr-codes"><Globe2 size={21}/><strong>QR & guest access</strong><small>Permanent links and printable QR codes</small><ArrowRight size={17}/></Link></div>
     </section>
    </div>
   </div>
  </div>
 </div>;
}
