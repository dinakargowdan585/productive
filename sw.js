/* Productive OS Offline Caching & PWA Service Worker */

const CACHE_NAME = "productive-os-cache-v22";
const ASSETS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./manifest.json",
  "./js/store.js",
  "./js/dayRollover.js",
  "./js/fx.js",
  "./js/dashboard.js",
  "./js/planner.js",
  "./js/notes.js",
  "./js/vault.js",
  "./js/calendar.js",
  "./js/standby.js",
  "./js/supabase.js",
  "./js/app.js",
  "./storage/database.js",
  "./storage/repositories/baseRepository.js",
  "./storage/sync/syncEngine.js",
  "./assets/icon-192.png",
  "./assets/icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Bypass cache for external APIs (Supabase, CDNs, Auth)
  if (url.origin !== location.origin || url.pathname.includes('/auth/') || url.pathname.includes('/rest/')) {
    return;
  }

  // Network-First for navigation & app code to guarantee freshness on deployment
  if (request.mode === "navigate" || request.destination === "script" || request.destination === "style") {
    e.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Cache-First for static assets (images/icons)
  e.respondWith(
    caches.match(request).then((res) => {
      return res || fetch(request).then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});

