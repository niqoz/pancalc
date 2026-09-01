import { test } from "node:test";
import assert from "node:assert/strict";
import {
  panelRise, panelRun, rowSpacing, rowLayout, shadeFreeWindow,
  rowCount, fieldYield, fieldSweep, rowSteps, CRITERIA, MIN_TILT
} from "../docs/layout.js";
import { tiltSweep, sunPosition, dayOfYear } from "../docs/solar.js";

const near = (a, b, tol, msg) =>
  assert.ok(Math.abs(a - b) <= tol, `${msg || ""} : ${a.toFixed(3)} vs ${b} (tol ${tol})`);

test("geometrie du panneau", () => {
  near(panelRise(2, 30), 1, 1e-9, "un panneau de 2 m a 30 deg monte de 1 m");
  near(panelRun(2, 30), 1.7320508, 1e-6, "et occupe 1,73 m au sol");
  near(panelRise(2, 0), 0, 1e-9, "a plat, aucune elevation");
  near(panelRun(2, 90), 0, 1e-9, "a la verticale, aucune emprise");
});

test("ecartement au solstice, cas de reference calcule a la main", () => {
  // lat 45, 21 déc : hauteur du soleil a midi = 90 - 45 - 23.45 = 21,55 deg.
  // rise = 1,7 x sin(30) = 0,85 m ; d = 0,85 / tan(21,55) = 2,15 m.
  const s = rowSpacing(45, 1.7, 30, 0, "solstice_midi");
  near(s.elevation, 21.55, 0.2, "hauteur du soleil");
  near(s.spacing, 2.154, 0.02, "espace libre");
  near(rowLayout(45, 1.7, 30, 0, "solstice_midi").pitch, 3.626, 0.03, "pas entre rangees");
});

test("l'instant dimensionnant d'un champ plein sud est un bord de plage", () => {
  const s = rowSpacing(45, 1.7, 30, 0, "solstice_6h");
  // Plein sud, 9 h et 15 h sont strictement equivalents : le soleil y est au
  // plus bas de la plage. C'est la l'instant dimensionnant, pas midi.
  near(Math.min(Math.abs(s.hour - 9), Math.abs(s.hour - 15)), 0, 0.1, "bord de plage");
  // Sur 9 h - 15 h l'écartement explose : c'est le choix le plus couteux.
  const midi = rowSpacing(45, 1.7, 30, 0, "solstice_midi").spacing;
  assert.ok(s.spacing > midi * 1.5, `${s.spacing.toFixed(2)} m contre ${midi.toFixed(2)} m a midi`);
});

test("monotonies attendues", () => {
  const sp = (lat, tilt) => rowSpacing(lat, 1.7, tilt, 0, "solstice_midi").spacing;
  assert.ok(sp(45, 40) > sp(45, 20), "plus c'est incline, plus il faut espacer");
  assert.ok(sp(50, 30) > sp(43, 30), "plus on monte en latitude, plus il faut espacer");
  assert.ok(sp(45, 30) > rowSpacing(45, 1.7, 30, 0, "equinoxe_6h").spacing,
    "le solstice est plus contraignant que l'equinoxe");
  near(sp(45, 0), 0, 1e-9, "un panneau a plat ne s'ombre jamais");
});

test("champ oriente au sud-est : le pire cas passe le matin", () => {
  const s = rowSpacing(45, 1.7, 30, -30, "solstice_6h");
  assert.ok(s.hour < 12, `pire cas attendu le matin, obtenu ${s.hour.toFixed(1)} h`);
  // Resultat contre-intuitif mais reel : desorienter le champ AGGRAVE
  // l'ombrage entre rangées. Le soleil vient alors se placer dans l'axe des
  // rangées a un moment ou il est plus bas qu'a midi, et l'ombre s'allonge.
  assert.ok(s.spacing > rowSpacing(45, 1.7, 30, 0, "solstice_6h").spacing,
    "un champ desoriente exige plus d'ecartement, pas moins");
});

test("taux de couverture du sol coherent", () => {
  const l = rowLayout(45, 1.7, 30, 0, "solstice_midi");
  near(l.gcr, 1.7 / l.pitch, 1e-9, "gcr = longueur module / pas");
  assert.ok(l.gcr > 0.4 && l.gcr < 0.5, `gcr ${l.gcr.toFixed(2)} plausible pour un champ au sol`);
});

test("fenetre sans ombrage coherente avec le critere retenu", () => {
  // Un pas dimensionne pour midi seul ne protege qu'un court moment.
  const midi = rowLayout(45, 1.7, 30, 0, "solstice_midi").pitch;
  const w1 = shadeFreeWindow(45, 1.7, 30, 0, midi, 12, 21);
  assert.ok(w1.hours < 1.5, `fenetre etroite attendue, obtenue ${w1.hours.toFixed(1)} h`);
  near((w1.start + w1.end) / 2, 12, 0.15, "centree sur le midi solaire");

  // Un pas dimensionne 9 h - 15 h doit tenir les six heures promises.
  const large = rowLayout(45, 1.7, 30, 0, "solstice_6h").pitch;
  const w2 = shadeFreeWindow(45, 1.7, 30, 0, large, 12, 21);
  assert.ok(w2.hours >= 5.9, `six heures attendues, obtenues ${w2.hours.toFixed(1)} h`);

  // En mars le soleil est plus haut : la même geometrie protege plus longtemps.
  assert.ok(shadeFreeWindow(45, 1.7, 30, 0, midi, 3, 21).hours > w1.hours, "moins contraignant en mars");
});

test("nombre de rangees sur une profondeur donnee", () => {
  // La dernière rangée n'a besoin que de son emprise propre, pas d'un pas entier.
  near(rowCount(10, 2, 0, 2), 5, 1e-9, "panneaux a plat, jointifs");
  assert.equal(rowCount(1, 1.7, 30, 3.6), 0, "profondeur insuffisante pour une rangee");
  assert.equal(rowCount(1.5, 1.7, 30, 3.6), 1, "une seule rangee tient dans son emprise");
  const pitch = rowLayout(45, 1.7, 30, 0, "solstice_midi").pitch;
  const n = rowCount(20, 1.7, 30, pitch);
  assert.ok((n - 1) * pitch + panelRun(1.7, 30) <= 20 + 1e-9, "le champ tient dans la profondeur");
  assert.ok(n * pitch + panelRun(1.7, 30) > 20, "et une rangee de plus deborderait");
});

test("sur terrain contraint, l'optimum est plus plat que l'optimum d'un panneau seul", () => {
  const libre = tiltSweep(45, 0, "sudouest").best.tilt;
  const contraint = fieldSweep(45, 15, 1.7, 0, "solstice_6h", "sudouest").best.tilt;
  assert.ok(contraint < libre - 5,
    `terrain de 15 m : ${contraint} deg attendu nettement sous l'optimum libre ${libre} deg`);
  assert.ok(contraint >= 1 && contraint <= 25, `inclinaison ${contraint} deg plausible`);
});

test("sur terrain profond, le cout d'incliner tend vers le rapport des pas", () => {
  // La granularite entière des rangées s'efface quand le terrain s'allonge :
  // le rapport des productions tend alors vers celui des pas, corrige du
  // gain unitaire de l'inclinaison.
  const c = fieldSweep(45, 5000, 1.7, 0, "solstice_6h", "sudouest").curve;
  const at = (t) => c.find((p) => p.tilt === t);
  const attendu = (at(10).pitch / at(35).pitch) * (at(35).perModule / at(10).perModule);
  near(at(35).total / at(10).total, attendu, 0.01, "convergence asymptotique");
});

test("les deux optima du champ contraint repondent a deux questions", () => {
  const sw = fieldSweep(45, 15, 1.7, 0, "solstice_6h", "sudouest");
  // Maximiser l'énergie de chaque module redonne l'optimum du panneau seul.
  near(sw.bestPerModule.tilt, tiltSweep(45, 0, "sudouest").best.tilt, 1, "optimum par module");
  // Maximiser l'énergie récoltée sur le terrain donne une toute autre reponse,
  // bien plus plate, car elle privilegie le nombre de rangées.
  assert.ok(sw.best.tilt < sw.bestPerModule.tilt - 15,
    `${sw.best.tilt} deg au sol contre ${sw.bestPerModule.tilt} deg par module`);
  assert.ok(sw.best.rows > sw.bestPerModule.rows, "l'option plate loge plus de rangees");
  assert.ok(sw.best.total > sw.bestPerModule.total, "et recolte plus d'energie au total");
});

test("l'optimum au sol se cale juste sous une marche de rangee", () => {
  // La production chute d'un coup quand une rangée ne rentre plus : l'optimum
  // est donc l'inclinaison la plus forte du palier le mieux garni.
  const depth = 15;
  const sw = fieldSweep(45, depth, 1.7, 0, "solstice_6h", "sudouest");
  const steps = rowSteps(45, depth, 1.7, 0, "solstice_6h", "sudouest");
  assert.ok(steps.length > 1, "plusieurs paliers sur un terrain contraint");
  const meilleur = steps.reduce((a, b) => (b.total > a.total ? b : a));
  assert.equal(sw.best.tilt, meilleur.maxTilt, "optimum au sommet du meilleur palier");
  // Un degré de plus fait perdre une rangée entière.
  const apres = sw.curve.find((p) => p.tilt === sw.best.tilt + 1);
  assert.equal(apres.rows, sw.best.rows - 1, "la marche suivante coute une rangee");
});

test("les paliers de rangees sont ordonnes et couvrants", () => {
  const steps = rowSteps(45, 20, 1.7, 0, "solstice_6h", "sudouest");
  for (let i = 1; i < steps.length; i++) {
    assert.ok(steps[i].rows < steps[i - 1].rows, "le nombre de rangees decroit");
    assert.ok(steps[i].minTilt > steps[i - 1].maxTilt, "les paliers ne se chevauchent pas");
    assert.equal(steps[i].minTilt, steps[i - 1].maxTilt + 1, "et se suivent sans trou");
  }
  assert.equal(steps[0].minTilt, MIN_TILT, "le premier palier part de l'inclinaison minimale");
});

test("bilan de champ coherent", () => {
  const f = fieldYield(45, 30, 1.7, 25, 0, "solstice_6h", "sudouest");
  assert.ok(f.usedDepth <= 30 + 1e-9, "l'emprise reste dans le terrain");
  near(f.total, f.rows * 1.7 * f.perModuleM2, 1e-6, "total = surface de module x productible");
  near(f.perGroundM2, f.total / 30, 1e-9, "ramene au metre carre de terrain");
  assert.ok(f.perGroundM2 < f.perModuleM2, "le sol produit moins au m² que le module");
});

test("tous les criteres predefinis sont exploitables", () => {
  for (const key of Object.keys(CRITERIA)) {
    const l = rowLayout(45, 1.7, 30, 0, key);
    assert.ok(l.spacing > 0 && Number.isFinite(l.spacing), `${key} : ecartement exploitable`);
    assert.ok(l.pitch > l.run, `${key} : le pas depasse l'emprise du panneau`);
  }
});
