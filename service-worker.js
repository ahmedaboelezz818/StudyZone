const CACHE_NAME = "studyzone-shell-v22";

const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./themes.css",
  "./mobile.css",
  "./design-tokens.css",
  "./themes-presets.css",
  "./ui-controls.css",
  "./ui-controls.js",
  "./app.js",
  "./offline-sync.js",
  "./sync-ui.js",
  "./native-shell.js",
  "./locales.js",
  "./locales/ar.json",
  "./locales/en.json",
  "./vendor/supabase.js",
  "./fonts/fonts.css",
  "./fonts/font-01.woff2",
  "./fonts/font-02.woff2",
  "./fonts/font-03.woff2",
  "./fonts/font-04.woff2",
  "./fonts/font-05.woff2",
  "./fonts/font-06.woff2",
  "./fonts/font-07.woff2",
  "./fonts/font-08.woff2",
  "./fonts/font-09.woff2",
  "./fonts/font-10.woff2",
  "./fonts/font-11.woff2",
  "./fonts/font-12.woff2",
  "./fonts/font-13.woff2",
  "./fonts/font-14.woff2",
  "./fonts/font-15.woff2",
  "./fonts/font-16.woff2",
  "./fonts/font-17.woff2",
  "./fonts/font-18.woff2",
  "./supabase-config.js",
  "./manifest.json",
  "./icon.svg",
  "./favicon.svg",
  "./favicon.ico",
  "./apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-192-maskable.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png",
];

const APP_SHELL_URLS = APP_SHELL.map(
  (path) => new URL(path, self.registration.scope).href,
);

const APP_SHELL_PATHS = new Set(
  APP_SHELL_URLS.map((url) => new URL(url).pathname),
);

// تثبيت التطبيق وتخزين الملفات الأساسية.
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // لا نفشل تثبيت التطبيق بسبب ملف اختياري غير موجود.
      await Promise.all(
        APP_SHELL_URLS.map(async (url) => {
          try {
            const response = await fetch(url, {
              cache: "reload",
              credentials: "same-origin",
            });

            if (response.ok && response.type === "basic") {
              await cache.put(url, response);
            } else {
              console.warn("Study Zone: Could not cache:", url);
            }
          } catch (error) {
            console.warn("Study Zone: Asset unavailable:", url, error);
          }
        }),
      );

      // لا نفعّل النسخة الجديدة تلقائيًا أثناء استخدام التطبيق.
      // يمكن طلب التفعيل من الواجهة برسالة SKIP_WAITING.
    })(),
  );
});

// تنظيف النسخ القديمة وتفعيل النسخة الجديدة.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys
          .filter(
            (key) => key.startsWith("studyzone-shell-") && key !== CACHE_NAME,
          )
          .map((key) => caches.delete(key)),
      );

      await self.clients.claim();
    })(),
  );
});

// استقبال رسائل التحكم من التطبيق.
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// إشعارات Push.
self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data?.json() || {};
  } catch {
    payload = {
      body: event.data?.text() || "",
    };
  }

  const title =
    typeof payload.title === "string" && payload.title.trim()
      ? payload.title.slice(0, 140)
      : "Study Zone";

  const options = {
    body: typeof payload.body === "string" ? payload.body.slice(0, 500) : "",
    icon: new URL("./icons/icon-192.png", self.registration.scope).href,
    badge: new URL("./icons/icon-192.png", self.registration.scope).href,
    tag:
      typeof payload.tag === "string"
        ? payload.tag.slice(0, 120)
        : "study-zone-reminder",
    renotify: true,
    data: {
      url: typeof payload.url === "string" ? payload.url : "./#tasks",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// التعامل مع الضغط على الإشعار.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    (async () => {
      let targetUrl;

      try {
        targetUrl = new URL(
          event.notification.data?.url || "./#tasks",
          self.registration.scope,
        );
      } catch {
        targetUrl = new URL("./#tasks", self.registration.scope);
      }

      // لا نسمح بفتح روابط خارج نطاق التطبيق.
      if (
        targetUrl.origin !== self.location.origin ||
        !targetUrl.pathname.startsWith(
          new URL(self.registration.scope).pathname,
        )
      ) {
        return;
      }

      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of windows) {
        if (
          client.url.startsWith(self.registration.scope) &&
          "focus" in client
        ) {
          await client.navigate(targetUrl.href);
          return client.focus();
        }
      }

      return self.clients.openWindow(targetUrl.href);
    })(),
  );
});

// استراتيجية التخزين الآمن.
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // لا نتعامل مع أي طلب غير GET.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // لا نتعامل مع أي دومين خارجي، بما فيه Supabase.
  if (url.origin !== self.location.origin) return;

  // لا نخزّن طلبات API أو المسارات الديناميكية.
  if (
    url.pathname.includes("/rest/v1/") ||
    url.pathname.includes("/auth/v1/") ||
    url.pathname.includes("/storage/v1/") ||
    url.pathname.includes("/functions/v1/") ||
    url.pathname.includes("/realtime/v1/") ||
    url.pathname.includes("/api/")
  ) {
    return;
  }

  // صفحات التنقل: الشبكة أولًا ثم نسخة Offline.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cache = await caches.open(CACHE_NAME);

          const cachedPage = await cache.match(
            new URL("./index.html", self.registration.scope).href,
          );

          return cachedPage || Response.error();
        }
      })(),
    );

    return;
  }

  // نخزّن فقط الملفات الموجودة في قائمة App Shell.
  if (!APP_SHELL_PATHS.has(url.pathname)) return;

  // لا نخزّن طلبات تحمل بيانات اعتماد أو رؤوس تفويض.
  if (
    request.credentials === "include" ||
    request.headers.has("authorization")
  ) {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);

      try {
        const response = await fetch(request);

        if (
          response.ok &&
          response.type === "basic" &&
          !response.headers.has("set-cookie")
        ) {
          await cache.put(request, response.clone());
        }

        return response;
      } catch {
        return cached || Response.error();
      }
    })(),
  );
});
