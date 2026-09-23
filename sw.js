// Minimal service worker: caches this single-page app so it keeps working
// with no internet connection, after it has been loaded at least once.
// Keep this in step with APP_VERSION in simple-workout.html: changing it makes the
// service worker drop the previous cache, so a new build cannot be served stale.
const CACHE_NAME = "simple-workout-cache-v1.33.0";
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./favicon-32.png",
  "./apple-touch-icon.png",
  "./icon-192.png",
  "./icon-512.png",
  "./splash-414x896@2x.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Cache-first, falling back to network, and refreshing the cache in the
// background when a connection is available (stale-while-revalidate).
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const isNavigation =
    event.request.mode === "navigate" ||
    (event.request.destination === "" && event.request.headers.get("accept") || "").includes("text/html");

  // For the page itself: network-first, so a new version pushed to GitHub Pages
  // shows up immediately instead of one reload late. Falls back to cache offline.
  // cache:"no-store" matters: a plain fetch() still consults the browser's own HTTP
  // cache, which on GitHub Pages happily returns the previous index.html — that is
  // what made new builds fail to appear even after a reload.
  if (isNavigation) {
    const freshRequest = new Request(event.request.url, {
      cache: "no-store",
      credentials: "same-origin",
      headers: event.request.headers,
      mode: "same-origin",
      redirect: "follow"
    });
    event.respondWith(
      fetch(freshRequest)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((c) => c || caches.match("./index.html")))
    );
    return;
  }

  // Everything else: cache-first with background refresh.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
