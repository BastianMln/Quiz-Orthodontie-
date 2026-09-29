/* Service worker : l'app s'ouvre même sans réseau.
   VERSION change à chaque mise à jour de l'app (pas du contenu, qui passe par GitHub). */
const VERSION = "quiz-odf-2026.09.29-1";
const CORE = ["./", "./index.html", "./style.css", "./schemas.js", "./core.js", "./ui.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== "fonts").map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname === "api.github.com") return; /* synchro : jamais en cache */
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open("fonts").then(c => c.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok || r.type === "opaque") c.put(req, r.clone()); return r; }).catch(() => hit || Response.error()))));
    return;
  }
  if (url.origin !== location.origin) return;
  if (req.mode === "navigate") { e.respondWith(caches.match("./index.html").then(hit => hit || fetch(req))); return; }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req)));
});
