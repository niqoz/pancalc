/* Service worker — pancalc.
   L'application est entièrement hors ligne : aucun appel réseau au calcul.
   Incrémenter CACHE a chaque modification de docs/, sinon les appareils
   déjà équipes gardent l'ancienne version. */
const CACHE = "pancalc-v7";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./draw.js",
  "./curseur.js",
  "./solar.js",
  "./layout.js",
  "./sites.js",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./vendor/barlow/barlow-semicondensed-500.woff2",
  "./vendor/barlow/barlow-semicondensed-700.woff2"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((noms) => Promise.all(noms.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// Cache d'abord : les ressources sont figées, et le chantier n'a pas toujours
// de réseau. La mise a jour passe par le changement de nom du cache.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
