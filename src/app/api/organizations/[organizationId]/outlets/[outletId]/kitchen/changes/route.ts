import { NextResponse } from "next/server";
import { requestActor,errorResponse } from "@/lib/request-context";
import { kitchenChanges } from "@/modules/kitchen/service";
export async function GET(req:Request,{params}:{params:Promise<{organizationId:string;outletId:string}>}){
 try{
  const actor=await requestActor(req);
  const {organizationId,outletId}=await params;
  const raw=new URL(req.url).searchParams.get("cursor")??"0";
  if(!/^(0|[1-9][0-9]{0,14})$/.test(raw) || !Number.isSafeInteger(Number(raw)))
   return NextResponse.json({message:"Invalid cursor"},{status:422});
  return NextResponse.json(await kitchenChanges(actor,organizationId,outletId,Number(raw)),{headers:{"cache-control":"private, no-store"}});
 }catch(e){return errorResponse(e);}
}
