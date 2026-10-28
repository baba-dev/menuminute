// Standalone least-privilege service: only the two allowlisted MenuMinute units
// can populate an admin-visible log index. No web process journal access.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
const ROOT = "/var/lib/menuminute/log-index";
const UNITS = new Set(["menuminute-web.service", "menuminute-worker.service"]);
const TOTAL_BYTES = 256 * 1024 * 1024;
const SEGMENT_BYTES = 8 * 1024 * 1024;
const MAX_RETENTION_MS = 14 * 86400000;
const MESSAGE_LENGTH = 500;
const savedCursor = path.join(ROOT, "cursor");
fs.mkdirSync(ROOT, { recursive: true, mode: 0o750 });
const safe = (s) => String(s ?? "")
  .replace(/(?:Bearer|Basic)\s+[\w+./=~:-]+/gi, "[REDACTED AUTH]")
  .replace(/(?:password|token|secret|cookie|authorization|key|otp)\s*[:=]\s*\S+/gi, "[REDACTED FIELD]")
  .replace(/[\w.%+-]+@[\w.-]+\.[a-z]{2,}/gi, "[REDACTED EMAIL]")
  .replace(/https?:\/\/[^\s?#]+[?#][^\s]+/gi, "[REDACTED URL]")
  .slice(0, MESSAGE_LENGTH);
const allowedLevel = new Set(["debug", "info", "warn", "error", "fatal"]);
const validId = /^[a-z0-9_-]{1,128}$/i;
let cursor = fs.existsSync(savedCursor) ? fs.readFileSync(savedCursor, "utf8").trim() : "";
let indexCount = 0, skipped = 0;
function segmentPath() {
  const d = new Date().toISOString().slice(0, 13).replace("T", "-");
  for (let n = 0; n < 50; n++) {
    const file = path.join(ROOT, d + "-" + String(n).padStart(2, "0") + ".ndjson");
    if (!fs.existsSync(file) || fs.statSync(file).size < SEGMENT_BYTES) return file;
  }
  return null;
}
function prune() {
  const files = fs.readdirSync(ROOT).filter(x => /^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}\.ndjson$/.test(x))
    .map(name => ({ name, full: path.join(ROOT, name) }))
    .map(x => ({...x, stat:fs.statSync(x.full)})).sort((a,b)=>a.name.localeCompare(b.name));
  let used = files.reduce((n,f)=>n+f.stat.size,0);
  for (const file of files) {
    if (Date.now() - file.stat.mtimeMs <= MAX_RETENTION_MS && used <= TOTAL_BYTES) break;
    fs.unlinkSync(file.full);
    used -= file.stat.size;
  }
  fs.writeFileSync(path.join(ROOT, "health.json"),JSON.stringify({
    capturedAt:new Date().toISOString(), indexed:indexCount, skipped,
    bytes:used, ceilingBytes:TOTAL_BYTES, retentionDays:14, source:"journald",
  }), {mode:0o640});
}
function writeJournalLine(line) {
  let journal;
  try { journal = JSON.parse(line); } catch { return; }
  const unit = journal._SYSTEMD_UNIT;
  if (!UNITS.has(unit)) return;
  const nextCursor = journal.__CURSOR;
  if (typeof nextCursor === "string" && nextCursor.length < 512) {
    cursor = nextCursor;
    fs.writeFileSync(savedCursor, cursor, { mode:0o640 });
  }
  let original;
  try { original = JSON.parse(journal.MESSAGE); } catch { skipped++; return; }
  if (!original || typeof original !== "object" || !allowedLevel.has(original.level)) {
    skipped++; return;
  }
  // Purposefully drop arbitrary metadata, error stacks, bodies and unknown fields.
  const record = {
    timestamp: typeof original.timestamp === "string" && Number.isFinite(Date.parse(original.timestamp))
      ? new Date(original.timestamp).toISOString() : new Date().toISOString(),
    level: original.level,
    service: unit === "menuminute-web.service" ? "web" : "worker",
    message: safe(original.message),
    event: typeof original.meta?.event === "string" ? safe(original.meta.event) : null,
    traceId: typeof original.traceId === "string" && validId.test(original.traceId) ? original.traceId : null,
    organizationId: typeof original.organizationId === "string" && validId.test(original.organizationId) ? original.organizationId : null,
    outletId: typeof original.outletId === "string" && validId.test(original.outletId) ? original.outletId : null,
    release: typeof original.release === "string" && validId.test(original.release) ? original.release : null,
    errorCode: typeof original.error?.code === "string" ? safe(original.error.code) : null,
    status: Number.isInteger(original.meta?.status) ? original.meta.status : null,
  };
  const dest = segmentPath();
  if (!dest) { skipped++; return; }
  fs.appendFileSync(dest, JSON.stringify(record)+"\n", { mode:0o640 });
  indexCount++;
  if (indexCount % 100 === 0) prune();
}
const args = ["--no-pager","-o","json","-f","--unit=menuminute-web.service","--unit=menuminute-worker.service"];
if (cursor) args.push("--after-cursor="+cursor);
else args.push("--since=-1h");
const proc=spawn("/usr/bin/journalctl", args, { stdio:["ignore","pipe","inherit"],env:{PATH:"/usr/bin:/bin",LANG:"C"} });
const lines=readline.createInterface({input:proc.stdout,crlfDelay:Infinity});
lines.on("line",line=>{ try { writeJournalLine(line); } catch { skipped++; } });
proc.on("exit", code=>{ prune(); process.exit(code === 0 ? 1 : (code || 1)); });
for (const signal of ["SIGTERM","SIGINT"]) process.on(signal,()=>{proc.kill(signal);prune();});
setInterval(prune,60000).unref();
prune();
