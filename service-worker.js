const CACHE_NAME = "studyzone-shell-v9";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./favicon.svg",
  "./favicon.ico",
  "./apple-touch-icon.png",
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
        .filter((key) => key === "studyflow-static-v1"
          || key.startsWith("studyflow-shell-")
          || (key.startsWith("studyzone-shell-") && key !== CACHE_NAME))
        .map((key) => caches.delete(key)),
    )),
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data?.json() || {};
  } catch {
    payload = { body: event.data?.text() || "" };
  }
  const title = typeof payload.title === "string" && payload.title.trim()
    ? payload.title.slice(0, 140)
    : "Study Zone";
  const options = {
    body: typeof payload.body === "string" ? payload.body.slice(0, 500) : "",
    icon: new URL("./icons/icon-192.png", self.registration.scope).href,
    badge: new URL("./icons/icon-192.png", self.registration.scope).href,
    tag: typeof payload.tag === "string" ? payload.tag.slice(0, 120) : "study-zone-reminder",
    data: { url: typeof payload.url === "string" ? payload.url : "./#tasks" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const targetUrl = new URL(event.notification.data?.url || "./#tasks", self.registration.scope);
    if (targetUrl.origin !== self.location.origin) return;
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.startsWith(self.registration.scope) && "focus" in client) {
        await client.navigate(targetUrl.href);
        return client.focus();
      }
    }
    return self.clients.openWindow(targetUrl.href);
  })());
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
