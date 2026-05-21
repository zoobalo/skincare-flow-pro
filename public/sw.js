const STATIC_CACHE = "zoobalo-static-v4";
const API_CACHE    = "zoobalo-api-v4";
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
  if (e.request.method !== "GET") return;

  const url = new URL(e.request.url);

  // API routes: network-first (always fetch fresh data, fall back to cache when offline)
  if (isCacheableApi(url)) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(API_CACHE).then((c) => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() =>
          caches.match(e.request).then(
            (cached) => cached ?? new Response(JSON.stringify({ error: "offline" }), {
              headers: { "Content-Type": "application/json" },
            })
          )
        )
    );
    return;
  }

  // Non-API write operations (POST/mutations already filtered above)
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
