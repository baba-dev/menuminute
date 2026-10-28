import { constants } from "node:fs";
import { open, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

export interface AdminLogEntry {
  timestamp: string; level: "debug" | "info" | "warn" | "error" | "fatal";
  service: "web" | "worker"; message: string;
  event: string | null; traceId: string | null;
  organizationId: string | null; outletId: string | null;
  release: string | null; errorCode: string | null; status: number | null;
}
export interface AdminLogResult {
  available: boolean; reason?: string; capturedAt: string;
  entries: AdminLogEntry[]; nextBefore: string | null;
  collection: { capturedAt: string; bytes: number; indexed: number; skipped: number } | null;
}
const ROOT = "/var/lib/menuminute/log-index";
const FILE = /^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}\.ndjson$/;
const LEVELS = new Set(["debug", "info", "warn", "error", "fatal"]);
const SERVICES = new Set(["web", "worker"]);
const MAX_READ = 256 * 1024;
const MAX_FILES = 96;
const MAX_RESULTS = 100;
const MAX_SEARCH = 80;
const WINDOW_MAX_MS = 14 * 86400000;
export interface LogFilters {
  level?: string; service?: string; search?: string; before?: string; range?: string;
}
function isEntry(item: unknown): item is AdminLogEntry {
  if (!item || typeof item !== "object" || Array.isArray(item)) return false;
  const p = item as Record<string, unknown>;
  return typeof p.timestamp === "string" && Number.isFinite(Date.parse(p.timestamp)) &&
    typeof p.message === "string" && p.message.length <= 500 &&
    typeof p.level === "string" && LEVELS.has(p.level) &&
    typeof p.service === "string" && SERVICES.has(p.service);
}
function normalizedRange(range?: string): number {
  switch (range) {
    case "1h": return 3600000;
    case "7d": return 7 * 86400000;
    case "14d": return WINDOW_MAX_MS;
    default: return 86400000;
  }
}
async function tailFile(fileName: string): Promise<string[]> {
  const full = path.join(ROOT, fileName);
  const fh = await open(full, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const s = await fh.stat();
    if (!s.isFile()) return [];
    const len = Math.min(MAX_READ, s.size);
    const buffer = Buffer.alloc(len);
    const offset = s.size - len;
    const { bytesRead } = await fh.read(buffer, 0, len, offset);
    let source = buffer.subarray(0, bytesRead).toString("utf8");
    // The first line may be a fragment if we began mid-file.
    if (offset > 0) source = source.slice(source.indexOf("\n") + 1);
    return source.trimEnd().split("\n");
  } finally { await fh.close(); }
}
export async function readAdminLogs(filters: LogFilters): Promise<AdminLogResult> {
  const capturedAt = new Date().toISOString();
  const unavailable = (reason: string): AdminLogResult =>
    ({available:false,reason,capturedAt,entries:[],nextBefore:null,collection:null});
  let files: string[];
  try { files = (await readdir(ROOT)).filter(f=>FILE.test(f)).sort().reverse(); }
  catch { return unavailable("Log collector is not installed or its index is unreadable"); }
  let collection: AdminLogResult["collection"] = null;
  try {
    const raw = JSON.parse(await readFile(path.join(ROOT, "health.json"), "utf8")) as Record<string, unknown>;
    if (typeof raw.capturedAt === "string" && Number.isFinite(Date.parse(raw.capturedAt))) {
      collection = {
        capturedAt: raw.capturedAt,
        bytes: Number(raw.bytes) || 0,
        indexed: Number(raw.indexed) || 0,
        skipped: Number(raw.skipped) || 0,
      };
    }
  } catch { /* Collector may not have started yet. */ }
  if (!collection || Date.now() - Date.parse(collection.capturedAt) > 150000)
    return unavailable("Log collector is offline or its index is stale");
  const earliest = Date.now() - normalizedRange(filters.range);
  const before = filters.before && Number.isFinite(Date.parse(filters.before))
    ? Date.parse(filters.before) : Infinity;
  const level = LEVELS.has(filters.level ?? "") ? filters.level : null;
  const service = SERVICES.has(filters.service ?? "") ? filters.service : null;
  const query = (filters.search ?? "").trim().slice(0, MAX_SEARCH).toLowerCase();
  const matches: AdminLogEntry[] = [];
  for (const file of files.slice(0, MAX_FILES)) {
    // Each file is fixed-format hourly segment from the collector, not user supplied.
    if (Number.isNaN(Date.parse(file.slice(0, 10)))) continue;
    const fileDate = Date.parse(file.slice(0, 10));
    if (fileDate < earliest - 86400000) break;
    let lines: string[];
    try { lines = await tailFile(file); } catch { return unavailable("Log index could not be read safely"); }
    for (let i=lines.length-1;i>=0;i--) {
      let entry: unknown;
      try { entry = JSON.parse(lines[i] ?? ""); } catch { continue; }
      if (!isEntry(entry)) continue;
      const time = Date.parse(entry.timestamp);
      if (time < earliest || time >= before) continue;
      if (level && entry.level !== level) continue;
      if (service && entry.service !== service) continue;
      if (query && ![entry.message,entry.traceId,entry.event,entry.errorCode,entry.outletId,entry.organizationId]
        .some(field => field?.toLowerCase().includes(query))) continue;
      matches.push(entry);
      if (matches.length >= MAX_RESULTS + 1) break;
    }
    if (matches.length >= MAX_RESULTS + 1) break;
  }
  const hasMore = matches.length > MAX_RESULTS;
  const entries = matches.slice(0, MAX_RESULTS);
  return { available:true,capturedAt,entries,
    nextBefore: hasMore ? entries.at(-1)?.timestamp ?? null : null, collection };
}
