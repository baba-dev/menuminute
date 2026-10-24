import { NextResponse } from "next/server";
import { requestActor, errorResponse } from "@/lib/request-context";
import { conversationInput, conversationHistory } from "@/modules/intelligence/store";
export async function GET(req:Request,context:{params:Promise<{conversationId:string}>}){
 try{
  const actor=await requestActor(req);
  const input=conversationInput.omit({key:true}).parse(
   Object.fromEntries(new URL(req.url).searchParams.entries()));
  const {conversationId}=await context.params;
  return NextResponse.json(await conversationHistory({...input,actor},conversationId),
   {headers:{"cache-control":"private, no-store"}});
 }catch(error){return errorResponse(error);}
}
