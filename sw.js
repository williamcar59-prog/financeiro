/* Service Worker — cache para funcionar offline */
/* >>> VERSÃO: precisa ser igual à APP_VERSION no app.js */
const VERSION = "1.6.1";
const CACHE = "financas-" + VERSION;
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png",
  "./store.js",
  "./app.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

/* cache primeiro, atualiza em segundo plano */
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  /* nuvem (Supabase): nunca entra no cache do app */
  try {
    if (new URL(e.request.url).origin !== self.location.origin) return;
  } catch (err) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const network = fetch(e.request)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
