const CACHE_NAME = "biblioteca-ulv-v1-1";
const STATIC_ASSETS = ["/", "/offline", "/icons/icon.svg", "/icons/maskable-icon.svg", "/icons/icon-192.png", "/icons/icon-512.png"];
const BLOCKED_CACHE_PATTERNS = ["/admin", "/horas/qr", "/rest", "/auth", "supabase", "/notificaciones", "/mi-cuenta"];

function shouldAvoidCache(url) {
  const value = `${url.origin}${url.pathname}${url.search}`.toLowerCase();
  return BLOCKED_CACHE_PATTERNS.some((pattern) => value.includes(pattern));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  const url = new URL(request.url);

  try {
    const response = await fetch(request);

    if (response.ok && !shouldAvoidCache(url)) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }

    return response;
  } catch {
    const cached = await caches.match(request);
    return cached ?? caches.match("/offline");
  }
}

async function cacheFirst(request) {
  const url = new URL(request.url);
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);

  if (response.ok && !shouldAvoidCache(url)) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }

  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || shouldAvoidCache(url)) {
    return;
  }

  if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (["script", "style", "image", "font"].includes(request.destination)) {
    event.respondWith(cacheFirst(request));
  }
});
