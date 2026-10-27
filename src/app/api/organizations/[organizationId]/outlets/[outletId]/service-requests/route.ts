import { NextResponse } from "next/server";
import { requestActor,errorResponse } from "@/lib/request-context";
import { staffServiceRequests,staffServiceRequestAction } from "@/modules/hospitality/service";
type Params={params:Promise<{organizationId:string;outletId:string}>};
const headers={"cache-control":"private, no-store"};
export async function GET(req:Request,{params}:Params){
 try{const actor=await requestActor(req);const {organizationId,outletId}=await params;
  return NextResponse.json(await staffServiceRequests(actor,organizationId,outletId),{headers});
 }catch(e){return errorResponse(e,req);}
}
export async function POST(req:Request,{params}:Params){
 try{const actor=await requestActor(req,true);const {organizationId,outletId}=await params;
  return NextResponse.json(await staffServiceRequestAction(actor,organizationId,outletId,await req.json()),{headers});
 }catch(e){return errorResponse(e,req);}
}
