/* MenuMinute PWA cache policy v1. Public reads only; no mutation replay or background sync. */
const CACHE_PREFIX = "menuminute-pwa-v1-";
const SHELL_CACHE = `${CACHE_PREFIX}shell`;
const PAGE_CACHE = `${CACHE_PREFIX}public-pages`;
const PUBLIC_READ_CACHE = `${CACHE_PREFIX}public-reads`;
const STATIC_CACHE = `${CACHE_PREFIX}static`;

const OFFLINE_URL = "/offline";
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/brand/icons/pwa/icon-192.png",
  "/brand/icons/pwa/icon-512.png",
  "/brand/icons/pwa/icon-maskable-512.png",
  "/brand/icons/pwa/apple-touch-icon-180.png",
];

const PUBLIC_PAGE_PATHS = new Set([
  "/",
  "/demo",
  "/features",
  "/pricing",
  "/privacy",
  "/refund-policy",
  "/terms",
]);

function isPublicMenuPage(pathname) {
  return /^\/m\/[^/]+\/?$/.test(pathname);
}

function isPublicReadApi(pathname) {
  return (
    /^\/api\/public-menu\/[^/]+\/?$/.test(pathname) ||
    /^\/api\/public-media\/[^/]+\/?$/.test(pathname)
  );
}

function isStaticAsset(pathname) {
  return (
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/brand/")
  );
}

function classifyRequest(request) {
  if (request.method !== "GET") return "network-only";
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || request.headers?.has?.("range")) {
    return "network-only";
  }
  if (request.mode === "navigate") {
    return PUBLIC_PAGE_PATHS.has(url.pathname) || isPublicMenuPage(url.pathname)
      ? "public-navigation"
      : "network-only";
  }
  if (isPublicReadApi(url.pathname)) return "public-read";
  if (isStaticAsset(url.pathname)) return "static";
  return "network-only";
}

function responseCanBeCached(response) {
  if (!response || !response.ok || (response.type !== "basic" && response.type !== "default")) {
    return false;
  }
  if (response.headers.has("set-cookie")) return false;
  const vary = response.headers.get("vary")?.toLowerCase() ?? "";
  return !vary.includes("cookie") && !vary.includes("authorization") && vary !== "*";
}

async function trimCache(cacheName, maximumEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  await Promise.all(
    keys.slice(0, Math.max(0, keys.length - maximumEntries)).map((key) => cache.delete(key))
  );
}

async function deleteMatchingPath(cacheName, pathname) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  await Promise.all(
    keys.filter((key) => new URL(key.url).pathname === pathname).map((key) => cache.delete(key))
  );
}

async function networkFirst(request, cacheName, maximumEntries, offlineFallback = null) {
  const url = new URL(request.url);
  try {
    const response = await fetch(request);
    if (response.status === 404 || response.status === 410) {
      await deleteMatchingPath(cacheName, url.pathname);
      return response;
    }
    if (responseCanBeCached(response)) {
      const cache = await caches.open(cacheName);
      await cache.put(request, response.clone());
      await trimCache(cacheName, maximumEntries);
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (offlineFallback) {
      const fallback = await caches.match(offlineFallback);
      if (fallback) return fallback;
    }
    throw error;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (responseCanBeCached(response)) {
    const cache = await caches.open(STATIC_CACHE);
    await cache.put(request, response.clone());
    await trimCache(STATIC_CACHE, 96);
  }
  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(async (cache) => {
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            const response = await fetch(url, { cache: "reload" });
            if (responseCanBeCached(response)) await cache.put(url, response);
          } catch {
            // One optional shell asset must not prevent a future online retry.
          }
        })
      );
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("menuminute-pwa-") && !key.startsWith(CACHE_PREFIX))
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") void self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const policy = classifyRequest(event.request);
  if (policy === "network-only") return;
  if (policy === "public-navigation") {
    event.respondWith(networkFirst(event.request, PAGE_CACHE, 24, OFFLINE_URL));
    return;
  }
  if (policy === "public-read") {
    event.respondWith(networkFirst(event.request, PUBLIC_READ_CACHE, 80));
    return;
  }
  event.respondWith(cacheFirst(event.request));
});

// Exposes pure policy functions for repository tests; it does not grant a client messaging API.
self.__MENUMINUTE_PWA_TEST__ = Object.freeze({
  CACHE_PREFIX,
  PRECACHE_URLS,
  classifyRequest,
  isPublicMenuPage,
  isPublicReadApi,
  responseCanBeCached,
});
