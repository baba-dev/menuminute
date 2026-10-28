import { AsyncLocalStorage } from "node:async_hooks";

export interface TraceContext {
  traceId: string;
  spanId?: string;
  organizationId?: string;
  outletId?: string;
  actorId?: string;
  method?: string;
  path?: string;
  startedAt: number;
  metadata?: Record<string, unknown>;
}

export const traceStorage = new AsyncLocalStorage<TraceContext>();

/**
 * Retrieve the current active trace context, if established in the call chain.
 */
export function getTraceContext(): TraceContext | undefined {
  return traceStorage.getStore();
}

/**
 * Create a new TraceContext instance with a unique traceId if not provided.
 */
export function createTraceContext(init?: Partial<TraceContext>): TraceContext {
  return {
    traceId: init?.traceId ?? crypto.randomUUID(),
    spanId: init?.spanId,
    organizationId: init?.organizationId,
    outletId: init?.outletId,
    actorId: init?.actorId,
    method: init?.method,
    path: init?.path,
    startedAt: init?.startedAt ?? Date.now(),
    metadata: init?.metadata ? { ...init.metadata } : undefined,
  };
}

/**
 * Execute a function within the scope of a given trace context.
 */
export function runWithTrace<T>(context: TraceContext, fn: () => T): T {
  return traceStorage.run(context, fn);
}

/**
 * Mutate or enrich the current active trace context in-place.
 */
export function setTraceContext(update: Partial<TraceContext>): void {
  const store = traceStorage.getStore();
  if (!store) return;
  if (update.organizationId !== undefined) store.organizationId = update.organizationId;
  if (update.outletId !== undefined) store.outletId = update.outletId;
  if (update.actorId !== undefined) store.actorId = update.actorId;
  if (update.spanId !== undefined) store.spanId = update.spanId;
  if (update.method !== undefined) store.method = update.method;
  if (update.path !== undefined) store.path = update.path;
  if (update.metadata) {
    store.metadata = { ...store.metadata, ...update.metadata };
  }
}
