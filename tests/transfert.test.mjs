import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { payloadTransfert, nomFichier, slug } from "../docs/transfert.js";

/* Ce fichier-là ne se lit pas ici : il se lit dans SolarDim, par
   `Transfer.parsePayload`. Un écart de format n'échouerait donc nulle part —
   l'installateur verrait seulement son étude s'ouvrir sans ses réglages. Ces
   tests figent ce que l'autre côté attend, et la source de vérité reste
   `core/.../Transfer.kt`, `exportSessionV2`. */

const REGLAGE = { lat: 45.75, lon: 4.85, tilt: 30, azimut: -15, ville: "Lyon" };
const QUAND = new Date("2026-09-02T08:30:00Z");

test("le fichier s'annonce comme un transfer v2 de SolarDim", () => {
  const p = payloadTransfert(REGLAGE, QUAND);
  assert.equal(p.app, "SolarDim");
  assert.equal(p.type, "solardim.transfer");
  assert.equal(p.version, 2);
  assert.equal(p.exportedAt, "2026-09-02T08:30:00Z");
});

/* C'est le manifeste `contents` qui décide de la forme lue, pas le `type` :
   sans lui le fichier passe pour la forme à plat historique, dont les
   paramètres vivent à la racine. L'étude s'ouvrirait alors sans pente ni
   orientation, en silence. */
test("le manifeste contents annonce la session", () => {
  const p = payloadTransfert(REGLAGE, QUAND);
  assert.deepEqual(p.contents, ["session"]);
  assert.ok(p.session, "la session doit être rangée sous sa clé");
});

test("la position porte les deux coordonnées", () => {
  const { location } = payloadTransfert(REGLAGE, QUAND).session;
  assert.equal(location.lat, 45.75);
  assert.equal(location.lon, 4.85);
  for (const v of Object.values(location)) {
    assert.ok(Number.isFinite(v), "une coordonnée non finie invalide la position");
  }
});

/* `aspect` est l'azimut de PVGIS, celui de SolarDim et celui d'ici : 0 au
   sud, négatif vers l'est. Aucune conversion — et surtout aucune inventée. */
test("l'orientation part telle quelle, sans conversion d'azimut", () => {
  for (const azimut of [-90, -45, 0, 45, 90]) {
    const { params } = payloadTransfert({ ...REGLAGE, azimut }, QUAND).session;
    assert.equal(params.aspect, azimut);
  }
  assert.equal(payloadTransfert(REGLAGE, QUAND).session.params.tilt, 30);
});

test("le masque est déclaré vide plutôt qu'omis", () => {
  assert.equal(payloadTransfert(REGLAGE, QUAND).session.mask, null);
});

test("le nom du fichier suit la grammaire des pièces exportées", () => {
  assert.equal(nomFichier("Lyon", QUAND), "solardim-reglage-lyon-2026-09-02.json");
  assert.equal(nomFichier("Clermont-Ferrand", QUAND), "solardim-reglage-clermont-ferrand-2026-09-02.json");
});

test("le slug perd ses accents et sa ponctuation", () => {
  assert.equal(slug("Orléans"), "orleans");
  assert.equal(slug("Près de Ajaccio"), "pres-de-ajaccio");
  assert.equal(slug("  Ma position  "), "ma-position");
  assert.equal(slug("x".repeat(80)).length, 60);
});

/* La longitude n'entre dans aucun calcul de l'application : rien ne
   signalerait sa disparition de l'état, et le fichier partirait avec une
   position invalide, donc muette à l'import. */
test("la longitude est retenue dans les réglages par défaut", () => {
  const app = readFileSync(new URL("../docs/app.js", import.meta.url), "utf8");
  const defauts = app.slice(app.indexOf("const defauts = {"), app.indexOf("const CLE"));
  assert.match(defauts, /\blon:\s*-?\d/, "la longitude a disparu des réglages par défaut");
});
