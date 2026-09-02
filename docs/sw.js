/* Service worker — SolarDim Panel Optimizer.

   L'application doit marcher sans réseau sur un chantier, et se mettre à
   jour toute seule dès qu'il y en a. Les deux exigences se concilient par
   une stratégie « servir le cache, rafraîchir derrière » : la réponse part
   immédiatement du cache, et la version du réseau, quand elle arrive, y
   prend sa place pour le lancement suivant.

   Incrémenter CACHE purge tout d'un coup ; ce n'est plus indispensable à la
   diffusion d'une mise à jour, seulement à l'éviction de fichiers retirés. */
const CACHE = "panopt-v11";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./brandmark-panel.svg",
  "./app.js",
  "./draw.js",
  "./solar.js",
  "./layout.js",
  "./sites.js",
  "./curseur.js",
  "./installer.js",
  "./maj.js",
  "./transfert.js",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./vendor/fonts/fraunces.woff2",
  "./vendor/fonts/dm_sans.woff2"
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

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;

  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const enCache = await cache.match(e.request);
    // La requête réseau part dans tous les cas : c'est elle qui apportera la
    // version suivante, même quand la réponse servie vient du cache.
    const surLeReseau = fetch(e.request)
      .then((reponse) => {
        if (reponse && reponse.ok) cache.put(e.request, reponse.clone());
        return reponse;
      })
      .catch(() => null);
    return enCache || surLeReseau.then((r) => r || new Response("", { status: 504 }));
  }));
});
