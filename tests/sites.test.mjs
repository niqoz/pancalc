import { test } from "node:test";
import assert from "node:assert/strict";
import { CITIES, nearestCity } from "../docs/sites.js";
import { CLIMATES } from "../docs/solar.js";

/* Un relevé de position ne sert à rien s'il rattache le chantier à un repère
   situé à l'autre bout de la région : la latitude serait fausse, et la zone
   climatique avec, puisqu'elle est celle du repère le plus proche. */

test("chaque repère est en France et pointe une zone existante", () => {
  for (const [nom, lat, lon, zone] of CITIES) {
    assert.ok(zone in CLIMATES, `${nom} : zone inconnue « ${zone} »`);
    assert.ok(lat > 41 && lat < 51.5, `${nom} : latitude ${lat} hors de France`);
    assert.ok(lon > -5.5 && lon < 9.8, `${nom} : longitude ${lon} hors de France`);
  }
});

test("un relevé tombe sur la ville quand on y est", () => {
  for (const [nom, lat, lon] of CITIES) {
    const p = nearestCity(lat, lon);
    assert.equal(p.name, nom, `${nom} ne se reconnaît pas`);
    assert.ok(p.km <= 1, `${nom} : ${p.km} km de lui-même`);
    assert.equal(p.zone, CITIES.find((c) => c[0] === nom)[3], `${nom} : zone incohérente`);
  }
});

test("des lieux français hors liste tombent sur une zone plausible", () => {
  const cas = [
    ["Santa-Maria-Poggio", 42.36, 9.52, "mediterraneen"],
    ["Calvi", 42.57, 8.76, "mediterraneen"],
    ["Cannes", 43.55, 7.02, "mediterraneen"],
    ["Avignon", 43.95, 4.81, "mediterraneen"],
    ["Pau", 43.30, -0.37, "sudouest"],
    ["Quimper", 47.99, -4.10, "atlantique"],
    ["Mulhouse", 47.75, 7.34, "continental"],
    ["Dunkerque", 51.03, 2.38, "oceanique"]
  ];
  for (const [nom, lat, lon, attendue] of cas) {
    const p = nearestCity(lat, lon);
    assert.equal(p.zone, attendue, `${nom} rattaché à ${p.name} (${p.km} km)`);
  }
});

test("la côte orientale corse ne renvoie plus vers Ajaccio", () => {
  // Santa-Maria-Poggio, Costa Verde : Ajaccio est à plus de 70 km, de l'autre
  // côté de l'île, et sa latitude est inférieure d'un demi-degré.
  const p = nearestCity(42.36, 9.52);
  assert.notEqual(p.name, "Ajaccio", "repère situé de l'autre côté de l'île");
  assert.ok(p.km < 15, `repère à ${p.km} km, encore trop loin`);
  assert.ok(Math.abs(CITIES.find((c) => c[0] === p.name)[1] - 42.36) < 0.15, "latitude proche");
});

test("la Corse est couverte du nord au sud", () => {
  // Quatre points repartis sur l'île, aucun ne doit traverser la montagne.
  for (const [nom, lat, lon] of [
    ["Cap Corse", 42.95, 9.44], ["Balagne", 42.57, 8.90],
    ["Plaine orientale", 42.15, 9.53], ["Sartène", 41.62, 8.97]
  ]) {
    const p = nearestCity(lat, lon);
    assert.ok(p.km < 60, `${nom} : ${p.km} km de ${p.name}`);
    assert.equal(p.zone, "mediterraneen", `${nom}`);
  }
});
