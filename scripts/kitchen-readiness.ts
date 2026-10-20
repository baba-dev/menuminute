/** Read-only evidence collector. NEVER enables Kitchen Pro or changes production resources.
 * Run only from an exact reviewed release with private migration-owner credentials.
 * Do not print URL, account names, database tokens, guest data or query rows.
 */
import {Pool} from "pg";
import {realpath} from "node:fs/promises";
import {verifyMigrationState} from "./migration-runner";
const url=process.env["MIGRATION_DATABASE_URL"];
const sha=process.env["KITCHEN_EXPECTED_SHA"];
if(process.env["KITCHEN_READINESS_ACK"]!=="READ_ONLY"||!url||
 !sha||! /^[a-f0-9]{40}$/.test(sha))throw new Error("Explicit read-only operator acknowledgement, owner database URL and exact 40-char SHA required");
async function run(){
 const identity=await Promise.allSettled([
  realpath("/var/www/menuminute/current"),
  realpath("/var/www/menuminute/worker-current")
 ]);
 const links=identity.map(v=>v.status==="fulfilled"?v.value.endsWith("/"+sha):false);
 // This is the exact candidate migration checksum ledger, not a simulated database check.
 await verifyMigrationState(url!);
 const pool=new Pool({connectionString:url,max:1,connectionTimeoutMillis:5000,statement_timeout:10000,
  options:"-c default_transaction_read_only=on"});
 try{
  const [settings,work,event,outbox]=await Promise.all([
   pool.query<{total:string;enabled:string}>("select count(*)::text as total,count(*) filter (where enabled)::text as enabled from kitchen_outlet_settings"),
   pool.query<{total:string;unsettled:string}>("select count(*)::text as total,count(*) filter (where status in ('queued','preparing'))::text as unsettled from kitchen_work"),
   pool.query<{total:string;maxseq:string}>("select count(*)::text as total,coalesce(max(seq),0)::text as maxseq from kitchen_events"),
   pool.query<{total:string}>("select count(*)::text as total from outbox_events where type='kitchen.changed' and processed_at is null")
  ]);
  const evidence={
   sha,webAndWorkerSameExpectedSha:links.every(Boolean),
   candidateMigrationChecksums:"MATCH",settingsCount:Number(settings.rows[0]?.total??0),
   enabledOutletCount:Number(settings.rows[0]?.enabled??0),
   totalWorkCount:Number(work.rows[0]?.total??0),unfinishedWorkCount:Number(work.rows[0]?.unsettled??0),
   kitchenEventCount:Number(event.rows[0]?.total??0),maxEventSequence:event.rows[0]?.maxseq??"0",
   pendingKitchenOutbox:Number(outbox.rows[0]?.total??0),
   independentReview:"NOT_VERIFIED_BY_THIS_SCRIPT",
   restoredSQLAndMedia:"NOT_VERIFIED_BY_THIS_SCRIPT",ERPResourceMeasurements:"NOT_VERIFIED_BY_THIS_SCRIPT",
   customerActivationAuthorized:false
  };
  // No private source/customer fields; zero enabled production outlets is deliberate prior to handoff.
  process.stdout.write(JSON.stringify(evidence,null,2)+"\\n");
  if(!links.every(Boolean)||evidence.enabledOutletCount!==0)process.exitCode=2;
 }finally{await pool.end();}
}
void run().catch(()=>{console.error("Kitchen read-only readiness verification failed; no changes made");process.exitCode=1;});
