import type { Metadata } from "next";
import Link from "next/link";
import { AtlasEmptyState,AtlasFoodCard,AtlasSearchForm } from "@/components/encyclopedia/atlas";
import { foodKinds,type FoodKind } from "@/modules/food-encyclopedia/contracts";
import { listPublishedFood } from "@/modules/food-encyclopedia/editorial-service";
export const dynamic="force-dynamic";
export async function generateMetadata():Promise<Metadata>{
 const published=await listPublishedFood(undefined,undefined,1);
 return {title:"Browse the Food Encyclopedia",
   description:"Discover the reviewed MenuMinute guide to dishes, ingredients, cuisines and culinary language.",
   alternates:{canonical:"/explore/browse"},robots:{index:published.length>0,follow:true}};
}
const filters=[{label:"All topics",kind:""},{label:"Dishes",kind:"dishes"},
 {label:"Ingredients",kind:"ingredients"},{label:"Cuisines",kind:"cuisines"},
 {label:"Terms",kind:"terms"},{label:"Comparisons",kind:"compare"}];
export default async function BrowseFood({searchParams}:{searchParams:Promise<{kind?:string;page?:string}>}){
 const p=await searchParams;
 const kind:FoodKind|undefined=foodKinds.find(k=>k===p.kind);
 const page=Math.min(1000,Math.max(1,Number.parseInt(p.page??"1",10)||1));
 const result=await listPublishedFood(kind,undefined,25,(page-1)*24);
 const hasNext=result.length===25;
 const items=result.slice(0,24);
 return <main id="atlas-main" className="atlas-wrap">
   <section className="atlas-page-intro"><span className="atlas-kicker">THE COLLECTION / DISCOVER</span>
     <h1>Find your next<br/>food curiosity.</h1><p>A growing reference to independently reviewed dishes, ingredients, cuisines and menu terminology.</p>
   </section>
   <AtlasSearchForm compact/>
   <nav className="atlas-filter-nav" aria-label="Filter food topics">{filters.map(f=>
     <Link key={f.label} href={f.kind?"/explore/browse?kind="+f.kind:"/explore/browse"}
       aria-current={(kind??"")===f.kind?"page":undefined} className="atlas-filter">{f.label}</Link>)}</nav>
   <p className="atlas-result-summary">{items.length} reviewed guides shown on page {page}</p>
   {items.length?<div className="atlas-card-grid">{items.map(e=><AtlasFoodCard key={e.id} entry={e}/>)}</div>
   :<AtlasEmptyState title="The first reviewed guides are being prepared."
     description="This section will populate after articles pass source, accuracy and editorial review."/>}
   <nav aria-label="Browse pages" className="atlas-filter-nav" style={{marginTop:40}}>
     {page>1?<Link className="atlas-filter" href={"/explore/browse?page="+(page-1)+(kind?"&kind="+kind:"")}>Previous page</Link>:null}
     {hasNext?<Link className="atlas-filter" href={"/explore/browse?page="+(page+1)+(kind?"&kind="+kind:"")}>Next page</Link>:null}
   </nav>
 </main>;
}
