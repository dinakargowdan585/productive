/* Productive OS Offline Caching & PWA Service Worker */

const CACHE_NAME = "productive-os-cache-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/store.js",
  "./js/dashboard.js",
  "./js/planner.js",
  "./js/notes.js",
  "./js/vault.js",
  "./js/calendar.js",
  "./js/standby.js",
  "./js/app.js",
  "./manifest.json",
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

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
