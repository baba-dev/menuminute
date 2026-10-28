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
export function getTraceContext(): TraceContext | undefined {
  return traceStorage.getStore();
}
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
export function runWithTrace<T>(context: TraceContext, fn: () => T): T {
  return traceStorage.run(context, fn);
}
export function setTraceContext(update: Partial<TraceContext>): void {
  const current = traceStorage.getStore();
  if (!current) return;
  if (update.organizationId !== undefined) current.organizationId = update.organizationId;
  if (update.outletId !== undefined) current.outletId = update.outletId;
  if (update.actorId !== undefined) current.actorId = update.actorId;
  if (update.spanId !== undefined) current.spanId = update.spanId;
  if (update.method !== undefined) current.method = update.method;
  if (update.path !== undefined) current.path = update.path;
  if (update.metadata) current.metadata = { ...current.metadata, ...update.metadata };
}
