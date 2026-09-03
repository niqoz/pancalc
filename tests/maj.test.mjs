import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/* Une application installée qui cesse de se mettre a jour ne se plaint pas :
   elle sert indefiniment la version qu'elle a mise de cote. Le seul signal
   etait un 404 avale par le catch du hors-ligne. D'ou ces tests, qui portent
   sur le chemin reellement demande au navigateur. */

/** Faux navigateur, reduit a ce que initMiseAJour touche. Il note le chemin
    passe a register, qui est tout l'objet du test. */
function navigateurFactice() {
  const trace = { demande: null };
  const sw = {
    controller: null,
    addEventListener() {},
    register(chemin) {
      trace.demande = chemin;
      return Promise.resolve({ update: () => Promise.resolve() });
    }
  };
  globalThis.navigator = { serviceWorker: sw };
  globalThis.addEventListener = () => {};
  globalThis.document = { hidden: false };
  return trace;
}

const { initMiseAJour, doitRecharger } = await import("../docs/maj.js");

test("sans argument, le service worker est demande a sw.js", async () => {
  const trace = navigateurFactice();
  initMiseAJour();
  await Promise.resolve();
  assert.equal(trace.demande, "sw.js");
});

test("pose en ecouteur, l'evenement recu ne devient pas le chemin", async () => {
  // addEventListener("load", initMiseAJour) passe l'evenement en premier
  // argument : pris pour un chemin, il envoie register sur « [object Event] ».
  const trace = navigateurFactice();
  initMiseAJour({ type: "load" });
  await Promise.resolve();
  assert.equal(trace.demande, "sw.js");
});

test("un chemin explicite reste respecte", async () => {
  const trace = navigateurFactice();
  initMiseAJour("autre-sw.js");
  await Promise.resolve();
  assert.equal(trace.demande, "autre-sw.js");
});

test("la page ne cable pas la fonction en reference nue", () => {
  // Meme protegee, la reference nue reste un piege a relire : le cablage dit
  // ce qu'il fait quand il appelle la fonction sans argument.
  const app = readFileSync(new URL("../docs/app.js", import.meta.url), "utf8");
  assert.ok(!/addEventListener\("load",\s*initMiseAJour\s*\)/.test(app),
    "app.js passe initMiseAJour en reference nue : l'evenement arriverait comme chemin");
  assert.match(app, /initMiseAJour\(\)/);
});

test("la premiere prise de controle ne recharge pas la page", () => {
  assert.equal(doitRecharger(false, false), false);
  assert.equal(doitRecharger(true, false), true);
  assert.equal(doitRecharger(true, true), false);
});
