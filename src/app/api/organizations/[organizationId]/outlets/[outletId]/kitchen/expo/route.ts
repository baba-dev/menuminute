import { NextResponse } from "next/server";
import { requestActor, errorResponse } from "@/lib/request-context";
import { kitchenExpoSnapshot } from "@/modules/kitchen/service";
export async function GET(req:Request,{params}:{params:Promise<{organizationId:string;outletId:string}>}){
 try {
  const actor=await requestActor(req);const {organizationId,outletId}=await params;
  return NextResponse.json(await kitchenExpoSnapshot(actor,organizationId,outletId),{headers:{"cache-control":"private, no-store"}});
 } catch(e) {return errorResponse(e);}
}
