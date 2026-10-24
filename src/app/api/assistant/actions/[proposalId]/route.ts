import {NextResponse} from "next/server";
import {env} from "@/lib/config/env";
import {requestActor,errorResponse} from "@/lib/request-context";
import {boundedJson} from "@/modules/intelligence/request";
import {decisionInput,decideAvailability} from "@/modules/intelligence/actions";
type Context={params:Promise<{proposalId:string}>};
export async function POST(req:Request,c:Context){
 try{
  const actor=await requestActor(req,true);
  if(!env.AI_ASSISTANT_ACTIONS_ENABLED||!env.AI_ASSISTANT_READ_ONLY_ENABLED)
   return NextResponse.json({message:"Assistant actions are disabled"},{status:503});
  const p=decisionInput.parse(await boundedJson(req));
  const result=await decideAvailability({actor,organizationId:p.organizationId,outletId:p.outletId},(await c.params).proposalId,p);
  return NextResponse.json(result,{headers:{"cache-control":"private, no-store"}});
 }catch(error){return errorResponse(error);}
}
