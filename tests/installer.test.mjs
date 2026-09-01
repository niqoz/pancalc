import { test } from "node:test";
import assert from "node:assert/strict";
import { estIOS, estSafari, messageIOS } from "../docs/installer.js";

/* Détecter la plateforme par l'agent utilisateur est fragile : on s'appuie
   sur des chaînes réelles, et surtout sur les deux cas qui piègent — iPadOS
   qui se fait passer pour un Mac, et les navigateurs iOS qui portent tous
   « Safari » dans leur signature. */

const UA = {
  iphoneSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  iphoneChrome: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1",
  iphoneFirefox: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15",
  ipadOS: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  macSafari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  androidChrome: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
  androidFirefox: "Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0",
  linuxChrome: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
};

test("les appareils iOS sont reconnus, y compris l'iPad déguisé en Mac", () => {
  assert.ok(estIOS(UA.iphoneSafari, 5), "iPhone sous Safari");
  assert.ok(estIOS(UA.iphoneChrome, 5), "iPhone sous Chrome");
  assert.ok(estIOS(UA.iphoneFirefox, 5), "iPhone sous Firefox");
  // iPadOS 13+ envoie une signature de Mac : seul le tactile les sépare.
  assert.ok(estIOS(UA.ipadOS, 5), "iPad, signature de Mac mais tactile");
  assert.ok(!estIOS(UA.macSafari, 0), "vrai Mac, sans tactile");
});

test("les autres plateformes ne sont pas prises pour iOS", () => {
  for (const nom of ["androidChrome", "androidFirefox", "linuxChrome"]) {
    assert.ok(!estIOS(UA[nom], 5), nom);
    assert.ok(!estIOS(UA[nom], 0), nom);
  }
});

test("Safari se distingue des navigateurs qui portent son nom", () => {
  assert.ok(estSafari(UA.iphoneSafari), "Safari iOS");
  assert.ok(estSafari(UA.macSafari), "Safari macOS");
  // Tous ces navigateurs terminent leur signature par « Safari ».
  assert.ok(!estSafari(UA.iphoneChrome), "Chrome iOS");
  assert.ok(!estSafari(UA.iphoneFirefox), "Firefox iOS");
  assert.ok(!estSafari(UA.androidChrome), "Chrome Android");
  assert.ok(!estSafari(UA.linuxChrome), "Chrome bureau");
});

test("le message iOS dit quoi faire, et où", () => {
  const dansSafari = messageIOS(UA.iphoneSafari);
  assert.ok(dansSafari.includes("Partager"), "nomme le geste");
  assert.ok(dansSafari.includes("écran d’accueil"), "nomme la destination");
  assert.ok(!dansSafari.includes("ouvre cette page"), "inutile d'y renvoyer, on y est");

  const ailleurs = messageIOS(UA.iphoneChrome);
  assert.ok(ailleurs.includes("Safari"), "renvoie vers Safari, seul à savoir installer");
  assert.ok(ailleurs.includes("Partager"), "et donne quand même le geste");
  // Une phrase lue sur un chantier ne doit pas trébucher sur ses charnières.
  for (const msg of [dansSafari, ailleurs]) {
    assert.ok(!/\bpuis\b.*\bpuis\b/.test(msg), `« puis » répété : ${msg}`);
  }
});
