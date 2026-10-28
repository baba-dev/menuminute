import { getTraceContext } from "./tracing";

export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50,
};

const SENSITIVE_KEY_PATTERN =
  /(password|token|secret|authorization|cookie|totp|card|cvv|credential|private_key|apiKey)/i;

const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9._~+/-]+=*/gi;

let activeLogLevel: LogLevel = (() => {
  const envLevel = process.env["LOG_LEVEL"]?.toLowerCase() as LogLevel | undefined;
  if (envLevel && envLevel in LOG_LEVELS) {
    return envLevel;
  }
  return process.env["NODE_ENV"] === "production" ? "info" : "debug";
})();

export function setLogLevel(level: LogLevel): void {
  activeLogLevel = level;
}

export function getLogLevel(): LogLevel {
  return activeLogLevel;
}

/**
 * Redact sensitive fields and string patterns recursively with cycle detection.
 */
export function redactSensitiveData(value: unknown, seen = new WeakSet()): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return value.replace(BEARER_PATTERN, "Bearer [REDACTED]");
  }

  if (typeof value !== "object") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactSensitiveData(value.message, seen),
      stack: value.stack ? String(redactSensitiveData(value.stack, seen)) : undefined,
      ...(value.cause ? { cause: redactSensitiveData(value.cause, seen) } : {}),
    };
  }

  if (seen.has(value)) {
    return "[CIRCULAR]";
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveData(item, seen));
  }

  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (SENSITIVE_KEY_PATTERN.test(k)) {
      result[k] = "[REDACTED]";
    } else {
      result[k] = redactSensitiveData(v, seen);
    }
  }
  return result;
}

function writeLog(level: LogLevel, line: string): void {
  if (process.env.NODE_ENV === "test") {
    if (level === "error" || level === "fatal") {
      console.error(line);
    } else if (level === "warn") {
      console.warn(line);
    } else {
      // eslint-disable-next-line no-console
      console.log(line);
    }
    return;
  }

  if (level === "error" || level === "fatal") {
    if (typeof process !== "undefined" && typeof process.stderr?.write === "function") {
      process.stderr.write(line + "\n");
    } else {
      console.error(line);
    }
  } else {
    if (typeof process !== "undefined" && typeof process.stdout?.write === "function") {
      process.stdout.write(line + "\n");
    } else {
      // eslint-disable-next-line no-console
      console.log(line);
    }
  }
}

function emitLog(
  level: LogLevel,
  message: string,
  meta?: Record<string, unknown>,
  error?: unknown
): void {
  const trace = getTraceContext();
  const record: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  if (trace) {
    record["traceId"] = trace.traceId;
    if (trace.organizationId) record["organizationId"] = trace.organizationId;
    if (trace.outletId) record["outletId"] = trace.outletId;
    if (trace.actorId) record["actorId"] = trace.actorId;
  }

  if (meta) {
    const cleanedMeta = redactSensitiveData(meta) as Record<string, unknown>;
    Object.assign(record, cleanedMeta);
  }

  if (error !== undefined) {
    record["error"] = redactSensitiveData(error);
  }

  let json: string;
  try {
    json = JSON.stringify(record);
  } catch {
    json = JSON.stringify({
      timestamp: record["timestamp"],
      level,
      message,
      error: "SerializationError: Object could not be serialized to JSON",
    });
  }

  writeLog(level, json);
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>) {
    if (LOG_LEVELS[activeLogLevel] <= LOG_LEVELS.debug) {
      emitLog("debug", message, meta);
    }
  },
  info(message: string, meta?: Record<string, unknown>) {
    if (LOG_LEVELS[activeLogLevel] <= LOG_LEVELS.info) {
      emitLog("info", message, meta);
    }
  },
  warn(message: string, meta?: Record<string, unknown>) {
    if (LOG_LEVELS[activeLogLevel] <= LOG_LEVELS.warn) {
      emitLog("warn", message, meta);
    }
  },
  error(message: string, error?: unknown, meta?: Record<string, unknown>) {
    if (LOG_LEVELS[activeLogLevel] <= LOG_LEVELS.error) {
      emitLog("error", message, meta, error);
    }
  },
  fatal(message: string, error?: unknown, meta?: Record<string, unknown>) {
    if (LOG_LEVELS[activeLogLevel] <= LOG_LEVELS.fatal) {
      emitLog("fatal", message, meta, error);
    }
  },
  setLogLevel,
  getLogLevel,
};
