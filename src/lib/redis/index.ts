import { createClient } from "redis";
import { env } from "@/lib/config/env";
const clients = new Map<string, ReturnType<typeof createClient>>();
const connections = new Map<string, Promise<ReturnType<typeof createClient>>>();
export async function redisClient(kind: "queue" | "cache") {
  const pending = connections.get(kind);
  if (pending) return pending;
  const promise = (async () => {
    let client = clients.get(kind);
    if (!client) {
      client = createClient({
        url: kind === "queue" ? env.REDIS_QUEUE_URL : env.REDIS_CACHE_URL,
        disableOfflineQueue: true,
        socket: { connectTimeout: 2000, reconnectStrategy: false },
      });
      client.on("error", () => {});
      clients.set(kind, client);
    }
    if (!client.isOpen) await client.connect();
    return client;
  })();
  connections.set(kind, promise);
  try {
    return await promise;
  } finally {
    connections.delete(kind);
  }
}
export async function closeRedis() {
  await Promise.all(
    [...clients.values()].map(async (c) => {
      if (c.isOpen) c.destroy();
    })
  );
  clients.clear();
}
export async function redisHealth() {
  const result: Record<string, boolean> = {};
  for (const kind of ["queue", "cache"] as const) {
    try {
      const client = await redisClient(kind);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);
      try {
        result[kind] = (await client.withAbortSignal(controller.signal).ping()) === "PONG";
      } finally {
        clearTimeout(timer);
      }
    } catch {
      result[kind] = false;
    }
  }
  return result;
}
