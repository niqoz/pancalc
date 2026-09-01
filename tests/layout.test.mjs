import { test } from "node:test";
import assert from "node:assert/strict";
import {
  panelRise, panelRun, rowSpacing, rowLayout, shadeFreeWindow, CRITERIA
} from "../docs/layout.js";

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

test("tous les criteres predefinis sont exploitables", () => {
  for (const key of Object.keys(CRITERIA)) {
    const l = rowLayout(45, 1.7, 30, 0, key);
    assert.ok(l.spacing > 0 && Number.isFinite(l.spacing), `${key} : ecartement exploitable`);
    assert.ok(l.pitch > l.run, `${key} : le pas depasse l'emprise du panneau`);
  }
});
