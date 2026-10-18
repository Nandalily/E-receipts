
const CACHE_NAME = "musdaa-shell-v3";

const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.json"
];

// Install the service worker.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );

  self.skipWaiting();
});

// Remove old caches and activate the new worker.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("musdaa-shell-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

// Cache only local GET requests.
// Let external resources use the normal network.
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Never intercept external requests, POST requests,
  // or other non-GET requests.
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin
  ) {
    return;
  }

  // Handle same-origin navigation and local assets.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, copy);
          });
        }

        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);

        if (cached) {
          return cached;
        }

        if (request.mode === "navigate") {
          const fallback = await caches.match("/index.html");

          if (fallback) {
            return fallback;
          }
        }

        return new Response("Resource unavailable offline", {
          status: 503,
          headers: { "Content-Type": "text/plain" }
        });
      })
  );
});
