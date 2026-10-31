/* MenuMinute PWA cache policy v2. Anonymous reads only; no mutation replay or background sync. */
const CACHE_PREFIX = "menuminute-pwa-v2-";
const SHELL_CACHE = `${CACHE_PREFIX}shell`;
const PAGE_CACHE = `${CACHE_PREFIX}public-pages`;
const GUEST_PAGE_CACHE = `${CACHE_PREFIX}guest-pages`;
const GUEST_READ_CACHE = `${CACHE_PREFIX}guest-reads`;
const GUEST_MEDIA_CACHE = `${CACHE_PREFIX}guest-media`;
const GUEST_POLICY_CACHE = `${CACHE_PREFIX}guest-policy`;
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

function isPublicMenuApi(pathname) {
  return /^\/api\/public-menu\/[^/]+\/?$/.test(pathname);
}

function isPublicMediaApi(pathname) {
  return /^\/api\/public-media\/[^/]+\/?$/.test(pathname);
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
    if (PUBLIC_PAGE_PATHS.has(url.pathname)) return "public-navigation";
    if (isPublicMenuPage(url.pathname)) return "guest-navigation";
    return "network-only";
  }
  if (isPublicMenuApi(url.pathname)) return "guest-read";
  if (isPublicMediaApi(url.pathname)) return "guest-media";
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

function onlySupportedSearch(url) {
  const keys = [...url.searchParams.keys()];
  if (keys.some((key) => key !== "lang") || keys.filter((key) => key === "lang").length > 1) {
    return false;
  }
  const lang = url.searchParams.get("lang");
  return lang === null || /^[A-Za-z0-9-]{1,35}$/.test(lang);
}

function parseGuestEnrollment(data, clientUrl) {
  if (
    !data ||
    data.type !== "SET_GUEST_OFFLINE" ||
    typeof data.enabled !== "boolean" ||
    typeof data.pagePath !== "string" ||
    typeof data.apiPath !== "string" ||
    data.pagePath.length > 256 ||
    data.apiPath.length > 320
  ) {
    return null;
  }
  try {
    const page = new URL(data.pagePath, self.location.origin);
    const api = new URL(data.apiPath, self.location.origin);
    const client = new URL(clientUrl);
    const pageMatch = /^\/m\/([^/]+)\/?$/.exec(page.pathname);
    const apiMatch = /^\/api\/public-menu\/([^/]+)\/?$/.exec(api.pathname);
    if (
      page.origin !== self.location.origin ||
      api.origin !== self.location.origin ||
      client.origin !== self.location.origin ||
      !pageMatch ||
      !apiMatch ||
      pageMatch[1] !== apiMatch[1] ||
      page.hash ||
      api.hash ||
      !onlySupportedSearch(page) ||
      !onlySupportedSearch(api) ||
      client.pathname !== page.pathname ||
      client.search !== page.search
    ) {
      return null;
    }
    return {
      enabled: data.enabled,
      pageUrl: page.href,
      apiUrl: api.href,
      syncedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function policyKey(pageUrl) {
  return new URL(
    `/.menuminute-pwa-policy?guest=${encodeURIComponent(pageUrl)}`,
    self.location.origin
  ).href;
}

async function listGuestPolicies() {
  const cache = await caches.open(GUEST_POLICY_CACHE);
  const keys = await cache.keys();
  const policies = await Promise.all(
    keys.map(async (key) => {
      try {
        return await (await cache.match(key)).json();
      } catch {
        return null;
      }
    })
  );
  return policies.filter(Boolean);
}

async function putGuestPolicy(policy) {
  const cache = await caches.open(GUEST_POLICY_CACHE);
  await cache.put(
    policyKey(policy.pageUrl),
    new Response(JSON.stringify(policy), { headers: { "content-type": "application/json" } })
  );
}

async function findGuestPolicy(kind, request) {
  const requestUrl = new URL(request.url).href;
  const policies = await listGuestPolicies();
  if (kind === "page") return policies.find((policy) => policy.pageUrl === requestUrl) ?? null;
  if (kind === "api") return policies.find((policy) => policy.apiUrl === requestUrl) ?? null;
  if (kind === "media" && request.referrer) {
    const referrer = new URL(request.referrer).href;
    return policies.find((policy) => policy.pageUrl === referrer) ?? null;
  }
  return null;
}

async function removeGuestPolicy(policy) {
  const policyCache = await caches.open(GUEST_POLICY_CACHE);
  const pageCache = await caches.open(GUEST_PAGE_CACHE);
  const readCache = await caches.open(GUEST_READ_CACHE);
  await Promise.all([
    policyCache.delete(policyKey(policy.pageUrl)),
    pageCache.delete(policy.pageUrl),
    readCache.delete(policy.apiUrl),
  ]);
}

async function removePolicyForRequest(request) {
  const requestUrl = new URL(request.url).href;
  const policies = await listGuestPolicies();
  await Promise.all(
    policies
      .filter((policy) => policy.pageUrl === requestUrl || policy.apiUrl === requestUrl)
      .map(removeGuestPolicy)
  );
}

async function trimCache(cacheName, maximumEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  await Promise.all(
    keys.slice(0, Math.max(0, keys.length - maximumEntries)).map((key) => cache.delete(key))
  );
}

async function networkFirst(request, cacheName, maximumEntries, offlineFallback = null) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.status === 404 || response.status === 410) {
      await cache.delete(request);
      return response;
    }
    if (responseCanBeCached(response)) {
      await cache.put(request, response.clone());
      await trimCache(cacheName, maximumEntries);
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (offlineFallback) {
      const shell = await caches.open(SHELL_CACHE);
      const fallback = await shell.match(offlineFallback);
      if (fallback) return fallback;
    }
    throw error;
  }
}

async function guestNetworkFirst(request, kind, cacheName, maximumEntries) {
  const policy = await findGuestPolicy(kind, request);
  if (!policy) return fetch(request);
  const response = await networkFirst(request, cacheName, maximumEntries);
  if (response.status === 404 || response.status === 410) await removePolicyForRequest(request);
  return response;
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (responseCanBeCached(response)) {
    await cache.put(request, response.clone());
    await trimCache(STATIC_CACHE, 96);
  }
  return response;
}

async function fetchAndCache(url, cacheName) {
  const request = new Request(url, { credentials: "omit", cache: "reload" });
  const response = await fetch(request);
  if (!responseCanBeCached(response)) throw new Error("Guest snapshot was not cacheable");
  const cache = await caches.open(cacheName);
  await cache.put(url, response.clone());
  return response;
}

async function primeGuestMedia(apiResponse) {
  const body = await apiResponse.text();
  const paths = [...new Set(body.match(/\/api\/public-media\/[A-Za-z0-9_-]{1,128}/g) ?? [])].slice(
    0,
    80
  );
  await Promise.allSettled(paths.map((path) => fetchAndCache(path, GUEST_MEDIA_CACHE)));
  await trimCache(GUEST_MEDIA_CACHE, 160);
}

async function setGuestOffline(event) {
  const source = event.source;
  const policy = parseGuestEnrollment(event.data, source?.url ?? "");
  if (!policy || !source?.postMessage) return;
  if (!policy.enabled) {
    await removeGuestPolicy(policy);
    source.postMessage({ type: "GUEST_OFFLINE_REMOVED", pageUrl: policy.pageUrl });
    return;
  }
  try {
    await putGuestPolicy(policy);
    const [, apiResponse] = await Promise.all([
      fetchAndCache(policy.pageUrl, GUEST_PAGE_CACHE),
      fetchAndCache(policy.apiUrl, GUEST_READ_CACHE),
    ]);
    await primeGuestMedia(apiResponse);
    await Promise.all([
      trimCache(GUEST_POLICY_CACHE, 50),
      trimCache(GUEST_PAGE_CACHE, 50),
      trimCache(GUEST_READ_CACHE, 50),
    ]);
    source.postMessage({
      type: "GUEST_OFFLINE_READY",
      pageUrl: policy.pageUrl,
      syncedAt: policy.syncedAt,
    });
  } catch {
    await removeGuestPolicy(policy);
    source.postMessage({ type: "GUEST_OFFLINE_ERROR", pageUrl: policy.pageUrl });
  }
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
  if (event.data?.type === "SET_GUEST_OFFLINE") event.waitUntil(setGuestOffline(event));
});

self.addEventListener("fetch", (event) => {
  const policy = classifyRequest(event.request);
  if (policy === "network-only") return;
  if (policy === "public-navigation") {
    event.respondWith(networkFirst(event.request, PAGE_CACHE, 24, OFFLINE_URL));
    return;
  }
  if (policy === "guest-navigation") {
    event.respondWith(guestNetworkFirst(event.request, "page", GUEST_PAGE_CACHE, 50));
    return;
  }
  if (policy === "guest-read") {
    event.respondWith(guestNetworkFirst(event.request, "api", GUEST_READ_CACHE, 50));
    return;
  }
  if (policy === "guest-media") {
    event.respondWith(guestNetworkFirst(event.request, "media", GUEST_MEDIA_CACHE, 160));
    return;
  }
  event.respondWith(cacheFirst(event.request));
});

// Pure policy functions are exposed only for repository tests, not as a client messaging API.
self.__MENUMINUTE_PWA_TEST__ = Object.freeze({
  CACHE_PREFIX,
  PRECACHE_URLS,
  classifyRequest,
  isPublicMenuPage,
  isPublicMenuApi,
  parseGuestEnrollment,
  responseCanBeCached,
});

// H: Empty-payload push only. Never trust notification text, URL or tenant identity
// from a server payload; opening Orders always reauthenticates on the network.
self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (windows.some((client) => client.visibilityState === "visible")) return;
      await self.registration.showNotification("MenuMinute • new activity", {
        body: "Open your restaurant workspace to check the latest activity.",
        icon: "/brand/icons/pwa/icon-192.png",
        badge: "/brand/icons/pwa/icon-192.png",
        tag: "menuminute-activity",
        data: { url: "/dashboard/orders" },
      });
    })()
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const target = new URL("/dashboard/orders", self.location.origin).href;
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (existing) {
        await existing.focus();
        await existing.navigate(target);
      } else {
        await self.clients.openWindow(target);
      }
    })()
  );
});
