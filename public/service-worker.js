const CACHE_NAME = "webline-v3";
const APP_SHELL = ["./manifest.webmanifest", "./webline-icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(APP_SHELL);
      const page = await fetch("./");
      const html = await page.clone().text();
      await cache.put("./", page);
      const assets = Array.from(
        html.matchAll(/(?:src|href)="(\.\/assets\/[^"]+)"/g),
        (match) => match[1],
      );
      await cache.addAll(assets);
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then(async (cached) => {
          const fallback =
            cached ||
            (event.request.mode === "navigate" ? await caches.match("./") : undefined);
          return fallback || Response.error();
        }),
      ),
  );
});
