const STATIC_CACHE = "zoobalo-static-v5";
const API_CACHE    = "zoobalo-api-v5";
const ALL_CACHES   = [STATIC_CACHE, API_CACHE];

const STATIC_PRECACHE = ["/manifest.json", "/icons/icon.svg"];

// Read-only API routes safe to cache
const CACHEABLE_API = [
  "/api/dashboard/kpis",
  "/api/skus",
  "/api/vendors",
  "/api/manufacturers",
  "/api/purchase-orders",
  "/api/procurement",
  "/api/inventory",
  "/api/tasks",
  "/api/npd",
  "/api/production",
  "/api/directory",
];

function isCacheableApi(url) {
  return CACHEABLE_API.some((p) => url.pathname.startsWith(p));
}

// ── Install: pre-cache static shell ──────────────────────────────────────────
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(STATIC_CACHE).then((c) =>
      Promise.allSettled(STATIC_PRECACHE.map((url) => c.add(url)))
    )
  );
  self.skipWaiting();
});

// ── Activate: delete old caches ───────────────────────────────────────────────
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => !ALL_CACHES.includes(k)).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Mutations: pass through to network AND invalidate related GET cache entries
  if (e.request.method !== "GET") {
    if (isCacheableApi(url)) {
      e.waitUntil(
        caches.open(API_CACHE).then((c) =>
          c.keys().then((keys) => {
            const base = "/" + url.pathname.split("/").slice(1, 3).join("/"); // e.g. /api/tasks
            return Promise.all(
              keys
                .filter((k) => new URL(k.url).pathname.startsWith(base))
                .map((k) => c.delete(k))
            );
          })
        )
      );
    }
    return;
  }

  // API routes: stale-while-revalidate (return cache instantly, update in background)
  if (isCacheableApi(url)) {
    e.respondWith(
      caches.open(API_CACHE).then((c) =>
        c.match(e.request).then((cached) => {
          const networkFetch = fetch(e.request)
            .then((res) => {
              if (res.ok) c.put(e.request, res.clone());
              return res;
            })
            .catch(() =>
              cached ?? new Response(JSON.stringify({ error: "offline" }), {
                headers: { "Content-Type": "application/json" },
              })
            );
          return cached ?? networkFetch;
        })
      )
    );
    return;
  }

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) return;

  // Static assets + pages: network-first, fall back to cache
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(STATIC_CACHE).then((c) => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
