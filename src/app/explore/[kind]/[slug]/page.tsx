import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import {
  AtlasArt, AtlasArticleHero, AtlasArticleSections, AtlasBreadcrumbs, AtlasFacts,
  AtlasFoodCard, AtlasPreviewNotice, AtlasSectionHeading,
} from "@/components/encyclopedia/atlas";
import { foodKinds,foodPath,isEditoriallyIndexable,type FoodEntry,type FoodKind } from "@/modules/food-encyclopedia/contracts";
import { getFoodEntry } from "@/modules/food-encyclopedia/pilot";
import {
  getPublishedFoodEntry,getPublicFoodRedirect,listPublishedFood,
} from "@/modules/food-encyclopedia/editorial-service";
import { safeJsonLd,PUBLIC_ORIGIN } from "@/lib/marketing/seo";

export const dynamic="force-dynamic";
type Params=Promise<{kind:string;slug:string}>;
async function resolve(kind:string,slug:string):Promise<FoodEntry|null> {
 if(!foodKinds.some(k=>k===kind)||!slug||slug.length>90)return null;
 const found=await getPublishedFoodEntry(kind as FoodKind,slug);
 if(found)return found;
 // Pilot pages remain available for local design review only, NEVER in production.
 if(process.env.NODE_ENV!=="production")return getFoodEntry(kind as FoodKind,slug)??null;
 return null;
}
export async function generateMetadata({params}:{params:Params}):Promise<Metadata>{
 const {kind,slug}=await params;
 const entry=await resolve(kind,slug);
 if(!entry)return {title:"Food guide unavailable",robots:{index:false,follow:false}};
 const indexable=isEditoriallyIndexable(entry);
 return {
   title:entry.title,description:entry.description,
   alternates:{canonical:foodPath(entry)},
   robots:{index:indexable,follow:indexable},
   openGraph:{title:entry.title+" — The Atlas",description:entry.description,
     url:PUBLIC_ORIGIN+foodPath(entry),type:"article",
     images:entry.imagePath?[{url:entry.imagePath,alt:entry.imageAlt??entry.title}]:undefined},
 };
}
export default async function AtlasEditorialArticle({params}:{params:Params}){
 const {kind,slug}=await params;
 if(!foodKinds.some(k=>k===kind))notFound();
 const entry=await resolve(kind,slug);
 if(!entry){
   const redirect=await getPublicFoodRedirect(kind as FoodKind,slug);
   if(redirect&&redirect!==slug)permanentRedirect("/explore/"+kind+"/"+encodeURIComponent(redirect));
   notFound();
 }
 const relatedPool=entry.status==="published"?await listPublishedFood(undefined,undefined,100):[];
 const related=entry.relatedSlugs.flatMap(name=>{
   const relatedEntry=relatedPool.find(p=>p.slug===name);
   return relatedEntry?[relatedEntry]:[];
 }).slice(0,4);
 const indexed=isEditoriallyIndexable(entry);
 return <main id="atlas-main" className="atlas-wrap">
   {indexed&&<script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJsonLd({
     "@context":"https://schema.org",
     "@graph":[
       {"@type":"Article",headline:entry.title,description:entry.description,
         datePublished:entry.publishedAt,dateModified:entry.reviewedAt,
         author:{"@type":"Organization",name:"MenuMinute Editorial Team"},
         publisher:{"@type":"Organization",name:"MenuMinute",url:PUBLIC_ORIGIN},
         mainEntityOfPage:PUBLIC_ORIGIN+foodPath(entry)},
       {"@type":"BreadcrumbList",itemListElement:[
         {"@type":"ListItem",position:1,name:"Explore",item:PUBLIC_ORIGIN+"/explore"},
         {"@type":"ListItem",position:2,name:kind,item:PUBLIC_ORIGIN+"/explore/browse?kind="+kind},
         {"@type":"ListItem",position:3,name:entry.title,item:PUBLIC_ORIGIN+foodPath(entry)}
       ]}
     ]
   })}}/>}
   <AtlasBreadcrumbs items={[
      {label:kind==="compare"?"Comparisons":kind.charAt(0).toUpperCase()+kind.slice(1),href:"/explore/browse?kind="+kind},
      {label:entry.title}
   ]}/>
   {!indexed&&<AtlasPreviewNotice/>}
   <AtlasArticleHero entry={entry}/><AtlasFacts entry={entry}/>
   {kind==="compare"&&slug==="naan-vs-roti"&&<div className="atlas-compare-grid" aria-label="Naan and roti side by side">
     <div className="atlas-compare-panel"><AtlasArt entry={entry}/><div>
       <span className="atlas-kicker">01 / OFTEN LEAVENED</span><h2>Naan</h2>
       <p>Often made with leavening and associated with tandoor cooking.</p>
     </div></div>
     <div className="atlas-compare-panel"><div className="atlas-art atlas-art-sage"><div className="atlas-art-fallback">ROTI / TAWA FLATBREAD</div></div><div>
       <span className="atlas-kicker">02 / COMMONLY UNLEAVENED</span><h2>Roti</h2>
       <p>Typically a flatbread prepared on a tawa, with regional variations.</p>
     </div></div>
   </div>}
   <AtlasArticleSections entry={entry} related={related}/>
   {(kind==="cuisines"||kind==="ingredients")&&related.length>0&&<section className="atlas-content-section">
     <AtlasSectionHeading kicker="RELATED CULINARY KNOWLEDGE" title="Keep exploring"
       description="Related dishes and ingredients from the reviewed encyclopedia."/>
     <div className="atlas-card-grid">{related.map(item=><AtlasFoodCard key={item.id} entry={item}/>)}</div>
   </section>}
   <div style={{paddingTop:36}}><Link href="/explore/browse" className="atlas-more-link">
     Explore more food guides <ArrowRight size={19} aria-hidden="true"/>
   </Link></div>
 </main>;
}
