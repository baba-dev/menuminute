/** Fixed first-party route IDs. Model content and user strings never become hrefs. */
export const navigation={
 overview:{label:"Restaurant overview",href:"/dashboard"},
 menu:{label:"Menu Studio",href:"/dashboard/menu"},
 orders:{label:"Service Counter",href:"/dashboard/orders"},
 qr:{label:"QR Studio",href:"/dashboard/qr-codes"},
 settings:{label:"Outlet settings",href:"/dashboard/settings"},
} as const;
export type RouteId=keyof typeof navigation;
export function navigationForPermissions(p:{menuRead:boolean;ordersRead:boolean;menuWrite:boolean}){
 const allowed:RouteId[]=["overview"];
 if(p.menuRead)allowed.push("menu","qr");
 if(p.ordersRead)allowed.push("orders");
 if(p.menuWrite)allowed.push("settings");
 return allowed.map(id=>({id,...navigation[id]}));
}
export function routesForEvidence(evidence:unknown,allowed:RouteId[]){
 if(!Array.isArray(evidence))return [];
 const ids=new Set<RouteId>();
 for(const item of evidence){
  if(typeof item!=="object"||!item)continue;
  const name="tool" in item?item.tool:null;
  if(name==="orders.pulse"||name==="orders.history")ids.add("orders");
  if(name==="menu.summary")ids.add("menu");
 }
 return [...ids].filter(id=>allowed.includes(id)).map(id=>({id,...navigation[id]}));
}
