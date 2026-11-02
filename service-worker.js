const CACHE_NAME = "studyflow-shell-v3";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./supabase-config.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-192-maskable.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png",
];
const APP_SHELL_PATHS = new Set(
  APP_SHELL.map((path) => new URL(path, self.registration.scope).pathname),
);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key === "studyflow-static-v1" || (key.startsWith("studyflow-shell-") && key !== CACHE_NAME))
        .map((key) => caches.delete(key)),
    )),
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(new URL("./index.html", self.registration.scope))) || Response.error();
      }),
    );
    return;
  }

  if (!APP_SHELL_PATHS.has(url.pathname)) return;
  const assetUrl = new URL(url.pathname, self.location.origin);
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(assetUrl, response.clone());
        return response;
      } catch {
        return (await cache.match(assetUrl)) || Response.error();
      }
    })(),
  );
});
