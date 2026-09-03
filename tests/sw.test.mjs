import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../docs/sw.js", import.meta.url), "utf8");
const origine = "https://exemple.test";

function travailleur({ enCache, reseau = () => Promise.resolve(new Response("nouveau")), ecrire } = {}) {
  const ecouteurs = {};
  const trace = { installations: [], requetes: [], ecritures: [], active: false };
  const cache = {
    match: async () => enCache,
    addAll: async (requetes) => { trace.installations = Array.from(requetes); },
    put: async (requete, reponse) => {
      if (ecrire) await ecrire();
      trace.ecritures.push(await reponse.text());
    }
  };
  runInNewContext(source, {
    self: {
      location: { href: `${origine}/panopt/sw.js` },
      addEventListener: (nom, fonction) => { ecouteurs[nom] = fonction; },
      skipWaiting: async () => { trace.active = true; }
    },
    location: { origin: origine },
    caches: { open: async () => cache },
    fetch: (requete, options) => {
      trace.requetes.push(new Request(requete, options));
      return reseau();
    },
    URL, Request, Response
  });
  function evenement(nom, requete) {
    const attentes = [];
    let reponse;
    ecouteurs[nom]({
      request: requete,
      waitUntil: (promesse) => attentes.push(promesse),
      respondWith: (promesse) => { reponse = promesse; }
    });
    return { attentes, reponse };
  }
  return { trace, evenement };
}

test("une installation ne reprend pas les anciens fichiers du cache HTTP", async () => {
  const { trace, evenement } = travailleur();
  await Promise.all(evenement("install").attentes);
  assert.ok(trace.installations.length > 0);
  for (const requete of trace.installations) {
    assert.equal(requete.cache, "reload");
    assert.ok(requete.url.startsWith(`${origine}/panopt/`));
  }
  assert.equal(trace.active, true);
});

test("le rafraichissement et son ecriture survivent a la reponse en cache", async () => {
  let recevoir;
  let terminerEcriture;
  const reseau = new Promise((resolve) => { recevoir = resolve; });
  const ecriture = new Promise((resolve) => { terminerEcriture = resolve; });
  const { trace, evenement } = travailleur({
    enCache: new Response("ancien"), reseau: () => reseau, ecrire: () => ecriture
  });
  const appel = evenement("fetch", new Request(`${origine}/panopt/style.css`));
  assert.equal(await (await appel.reponse).text(), "ancien");
  assert.ok(appel.attentes.length > 0, "le worker doit rester actif pour actualiser le cache");
  assert.equal(trace.requetes[0].cache, "no-cache");
  let fini = false;
  const fin = Promise.all(appel.attentes).then(() => { fini = true; });
  recevoir(new Response("nouveau"));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fini, false, "waitUntil doit aussi attendre cache.put");
  terminerEcriture();
  await fin;
  assert.deepEqual(trace.ecritures, ["nouveau"]);
});

test("le cache reste disponible hors connexion", async () => {
  const { evenement } = travailleur({
    enCache: new Response("logo hors ligne"), reseau: async () => { throw new Error("hors ligne"); }
  });
  const appel = evenement("fetch", new Request(`${origine}/panopt/panel-optimizer-logo.svg`));
  assert.equal(await (await appel.reponse).text(), "logo hors ligne");
  await Promise.all(appel.attentes);
});

test("un nouveau fichier est telecharge et conserve", async () => {
  const { trace, evenement } = travailleur();
  const appel = evenement("fetch", new Request(`${origine}/panopt/style.css?v=14`));
  assert.equal(await (await appel.reponse).text(), "nouveau");
  await Promise.all(appel.attentes);
  assert.deepEqual(trace.ecritures, ["nouveau"]);
});

test("une erreur reseau ne remplace pas le fichier en cache", async () => {
  const { trace, evenement } = travailleur({
    enCache: new Response("ancien"), reseau: async () => new Response("absent", { status: 404 })
  });
  const appel = evenement("fetch", new Request(`${origine}/panopt/style.css`));
  assert.equal(await (await appel.reponse).text(), "ancien");
  await Promise.all(appel.attentes);
  assert.deepEqual(trace.ecritures, []);
});

test("sans cache ni reseau, le worker renvoie une erreur explicite", async () => {
  const { evenement } = travailleur({ reseau: async () => { throw new Error("hors ligne"); } });
  const appel = evenement("fetch", new Request(`${origine}/panopt/inconnu.svg`));
  assert.equal((await appel.reponse).status, 504);
  await Promise.all(appel.attentes);
});

test("un stockage plein ne fait pas perdre le fichier telecharge", async () => {
  const { evenement } = travailleur({ ecrire: async () => { throw new Error("quota"); } });
  const appel = evenement("fetch", new Request(`${origine}/panopt/panel-optimizer-logo.svg`));
  assert.equal(await (await appel.reponse).text(), "nouveau");
  await Promise.all(appel.attentes);
});
