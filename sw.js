/* Service Worker — cache para funcionar offline */
/* >>> VERSÃO: precisa ser igual à APP_VERSION no app.js */
const VERSION = "1.7.0";
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
  /* baixa TUDO com cache: "no-cache" — sem isso o navegador pode entregar o
     arquivo velho do cache HTTP do GitHub Pages (max-age=600) e o app ficaria
     com versão trocada (service worker novo, script antigo). */
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) =>
        Promise.all(
          ASSETS.map((url) =>
            fetch(new Request(url, { cache: "no-cache" })).then((res) => {
              if (!res || res.status !== 200)
                throw new Error("Falha ao baixar " + url);
              return c.put(url, res);
            })
          )
        )
      )
      .then(() => self.skipWaiting())
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
      /* revalida no servidor (304 = resposta mínima): evita que o cache HTTP
         devolva um arquivo antigo e contamine o cache do app */
      const network = fetch(new Request(e.request, { cache: "no-cache" }))
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
