const STATIC_CACHE = "zoobalo-static-v2";
const API_CACHE    = "zoobalo-api-v2";
const ALL_CACHES   = [STATIC_CACHE, API_CACHE];

const STATIC_PRECACHE = ["/", "/dashboard", "/manifest.json", "/icons/icon.svg"];

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
    caches.open(STATIC_CACHE).then((c) => c.addAll(STATIC_PRECACHE))
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

  // API routes: stale-while-revalidate (serve cache instantly, update in background)
  if (isCacheableApi(url)) {
    e.respondWith(
      caches.open(API_CACHE).then(async (cache) => {
        const cached = await cache.match(e.request);
        const fetchPromise = fetch(e.request)
          .then((res) => {
            if (res.ok) cache.put(e.request, res.clone());
            return res;
          })
          .catch(() => null);

        // Return cached immediately if available; otherwise wait for network
        return cached ?? fetchPromise ?? new Response(JSON.stringify({ error: "offline" }), {
          headers: { "Content-Type": "application/json" },
        });
      })
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
