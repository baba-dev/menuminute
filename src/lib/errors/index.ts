/**
 * Application error types.
 * Use these instead of generic Error for consistent error handling.
 */

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string, statusCode = 500) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, "NOT_FOUND", 404);
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, "UNAUTHORIZED", 401);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, "FORBIDDEN", 403);
    this.name = "ForbiddenError";
  }
}

export class ValidationError extends AppError {
  public readonly fields?: Record<string, string[]>;

  constructor(message: string, fields?: Record<string, string[]>) {
    super(message, "VALIDATION_ERROR", 422);
    this.name = "ValidationError";
    this.fields = fields;
  }
}

/**
 * A plan resource cap was reached. Carries only non-sensitive plan metadata so
 * callers can render an upgrade prompt; it never reveals other tenants' data.
 */
export class LimitReachedError extends AppError {
  public readonly resource: string;
  public readonly limit: number;
  public readonly upgradeTo: string | null;

  constructor(resource: string, limit: number, upgradeTo: string | null) {
    super(`Your plan allows ${limit} ${resource}.`, "LIMIT_REACHED", 402);
    this.name = "LimitReachedError";
    this.resource = resource;
    this.limit = limit;
    this.upgradeTo = upgradeTo;
  }
}

/**
 * The organization has used its AI credits for the month. Manual editing keeps working; credits reset at
 * the start of the next UTC month. Same HTTP shape as LIMIT_REACHED so clients can offer the upgrade.
 */
export class AiCreditsExhaustedError extends AppError {
  public readonly limit: number;
  public readonly resetsAt: string;
  public readonly upgradeTo: string | null;

  constructor(limit: number, resetsAt: string, upgradeTo: string | null) {
    const day = new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(new Date(resetsAt));
    super(
      `You have used all ${limit.toLocaleString("en-US")} AI credits for this month. They reset on ${day}. Editing by hand still works.`,
      "AI_CREDITS_EXHAUSTED",
      402
    );
    this.name = "AiCreditsExhaustedError";
    this.limit = limit;
    this.resetsAt = resetsAt;
    this.upgradeTo = upgradeTo;
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, "CONFLICT", 409);
    this.name = "ConflictError";
  }
}

export class RateLimitError extends AppError {
  public readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("Too many requests", "RATE_LIMITED", 429);
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class UnavailableError extends AppError {
  constructor(message = "Service temporarily unavailable") {
    super(message, "UNAVAILABLE", 503);
    this.name = "UnavailableError";
  }
}

/**
 * Safe error serialization for API responses.
 * Never exposes stack traces or internal details in production.
 */
export function serializeError(
  err: unknown,
  isDev = process.env["NODE_ENV"] === "development"
): { message: string; code?: string; fields?: Record<string, string[]> } {
  if (err instanceof ValidationError) {
    return { message: err.message, code: err.code, fields: err.fields };
  }

  if (err instanceof AppError) {
    return { message: err.message, code: err.code };
  }

  if (isDev && err instanceof Error) {
    return { message: err.message };
  }

  return { message: "An unexpected error occurred" };
}
