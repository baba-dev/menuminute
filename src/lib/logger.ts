import { getTraceContext } from "./tracing";

export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";
export const LOG_LEVELS: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50,
};
const SECRET_KEY =
  /(?:password|passwd|secret|token|authorization|cookie|csrf|totp|otp|cvv|cvc|card(?:number)?|credential|private.?key|api.?key|session|payment.?method|email|phone|address|prompt|body|headers|query|url)/i;
const MAX_DEPTH = 5;
const MAX_KEYS = 32;
const MAX_STRING = 1000;
const MAX_LINE = 8192;
const MAX_ARRAY = 32;
const MAX_BUFFERED_BYTES = 1024 * 1024;
let activeLogLevel: LogLevel =
  (Object.keys(LOG_LEVELS) as LogLevel[]).find(
    (level) => level === process.env["LOG_LEVEL"]?.toLowerCase()
  ) ?? (process.env.NODE_ENV === "production" ? "info" : "debug");
let dropped = 0;

export function setLogLevel(level: LogLevel): void {
  if (!(level in LOG_LEVELS)) throw new TypeError("Invalid log level");
  activeLogLevel = level;
}
export function getLogLevel(): LogLevel {
  return activeLogLevel;
}
export function getLoggerHealth() {
  return { dropped, stdoutBackpressured: Boolean(process.stdout.writableNeedDrain) };
}

/** Best-effort defensive redaction. Callers must NEVER supply raw request bodies or secrets. */
export function redactLogString(input: string): string {
  return input
    .replace(
      /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/gi,
      "[REDACTED KEY]"
    )
    .replace(/(?:Bearer|Basic)\s+[A-Za-z0-9+/._~=-]+/gi, "[REDACTED AUTH]")
    .replace(
      /(?:password|passwd|token|secret|api[_-]?key|session|cookie|authorization|otp|cvv)\s*[:=]\s*["']?[^\s,;&"']+/gi,
      "[REDACTED FIELD]"
    )
    .replace(/(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi, "[REDACTED EMAIL]")
    .replace(/(?:https?:\/\/[^\s?#]+)[?#][^\s]+/gi, "[REDACTED URL]")
    .replace(/(?:sk_(?:live|test)_[A-Za-z0-9_-]+)/g, "[REDACTED KEY]")
    .slice(0, MAX_STRING);
}

/** Never invoke customer supplied toJSON(), getters, or arbitrary custom class methods. */
export function redactSensitiveData(
  value: unknown,
  seen: WeakSet<object> = new WeakSet<object>(),
  depth = 0
): unknown {
  if (value == null || typeof value === "boolean" || typeof value === "number") {
    return typeof value === "number" && !Number.isFinite(value) ? null : value;
  }
  if (typeof value === "bigint") return "[BIGINT]";
  if (typeof value === "string") return redactLogString(value);
  if (typeof value !== "object") return "[UNSUPPORTED]";
  if (depth >= MAX_DEPTH) return "[TRUNCATED]";
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);
  if (value instanceof Date)
    return Number.isFinite(value.getTime()) ? value.toISOString() : "[INVALID DATE]";
  if (value instanceof Error) {
    const output: Record<string, unknown> = {
      name: redactLogString(value.name),
      message: redactLogString(value.message),
    };
    // No raw stack, cause object or headers; stacks often contain URLs, payloads and credentials.
    const code = Object.getOwnPropertyDescriptor(value, "code");
    if (code && "value" in code && typeof code.value === "string") {
      output["code"] = redactLogString(code.value);
    }
    return output;
  }
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY).map((item) => redactSensitiveData(item, seen, depth + 1));
  }
  const output: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const key of Object.keys(descriptors).slice(0, MAX_KEYS)) {
    // Protect against prototype pollution and strange JSON rehydration.
    if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
    const descriptor = descriptors[key];
    if (!descriptor || !descriptor.enumerable) continue;
    output[key.slice(0, 80)] = SECRET_KEY.test(key)
      ? "[REDACTED]"
      : "value" in descriptor
        ? redactSensitiveData(descriptor.value, seen, depth + 1)
        : "[ACCESSOR]";
  }
  return output;
}

function emit(level: LogLevel, message: string, meta?: Record<string, unknown>, error?: unknown) {
  try {
    const trace = getTraceContext();
    const record = {
      timestamp: new Date().toISOString(),
      level,
      service: process.env["MENUMINUTE_SERVICE"] ?? "web",
      release: process.env["NEXT_PUBLIC_RELEASE_SHA"] ?? "unknown",
      message: redactLogString(message),
      ...(trace
        ? {
            traceId: redactLogString(trace.traceId),
            ...(trace.organizationId && { organizationId: redactLogString(trace.organizationId) }),
            ...(trace.outletId && { outletId: redactLogString(trace.outletId) }),
            ...(trace.actorId && { actorId: redactLogString(trace.actorId) }),
          }
        : {}),
      ...(meta ? { meta: redactSensitiveData(meta) } : {}),
      ...(error !== undefined ? { error: redactSensitiveData(error) } : {}),
    };
    let line = JSON.stringify(record);
    if (line.length > MAX_LINE) {
      line = JSON.stringify({
        timestamp: record.timestamp,
        level,
        service: record.service,
        message: record.message,
        truncated: true,
      });
    }
    if (process.env.NODE_ENV === "test") {
      if (level === "error" || level === "fatal") console.error(line);
      else if (level === "warn") console.warn(line);
      else console.log(line);
      return;
    }
    const stream = level === "error" || level === "fatal" ? process.stderr : process.stdout;
    // Avoid unbounded buffer growth on noisy paths. Critical errors use a separate stream.
    if (
      level !== "error" &&
      level !== "fatal" &&
      (stream.writableNeedDrain || stream.writableLength >= MAX_BUFFERED_BYTES)
    ) {
      dropped++;
      return;
    }
    stream.write(line + "\n");
  } catch {
    dropped++;
    // Never print unsafe input as a fallback, and never crash the request due to logging.
  }
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>) {
    if (LOG_LEVELS[activeLogLevel] <= LOG_LEVELS.debug) emit("debug", message, meta);
  },
  info(message: string, meta?: Record<string, unknown>) {
    if (LOG_LEVELS[activeLogLevel] <= LOG_LEVELS.info) emit("info", message, meta);
  },
  warn(message: string, meta?: Record<string, unknown>) {
    if (LOG_LEVELS[activeLogLevel] <= LOG_LEVELS.warn) emit("warn", message, meta);
  },
  error(message: string, error?: unknown, meta?: Record<string, unknown>) {
    if (LOG_LEVELS[activeLogLevel] <= LOG_LEVELS.error) emit("error", message, meta, error);
  },
  fatal(message: string, error?: unknown, meta?: Record<string, unknown>) {
    if (LOG_LEVELS[activeLogLevel] <= LOG_LEVELS.fatal) emit("fatal", message, meta, error);
  },
  setLogLevel,
  getLogLevel,
};
