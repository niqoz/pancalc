import { test } from "node:test";
import assert from "node:assert/strict";
import {
  declination, sunPosition, sunriseHour, dayOfYear, cosIncidence,
  dailyDiffuseFraction, irradiation, tiltSweep, tiltAnalysis, SEASONS,
  solarTime, clockTime, equationOfTime, CLIMATES
} from "../docs/solar.js";

const near = (a, b, tol, msg) =>
  assert.ok(Math.abs(a - b) <= tol, `${msg || ""} : ${a.toFixed(3)} vs ${b} (tol ${tol})`);

test("declinaison aux solstices et equinoxes", () => {
  near(declination(dayOfYear(6, 21)), 23.45, 0.2, "solstice d'ete");
  near(declination(dayOfYear(12, 21)), -23.45, 0.2, "solstice d'hiver");
  near(declination(dayOfYear(3, 21)), 0, 1.5, "equinoxe de printemps");
  // La formule de Cooper est precise a environ 1,5 degré pres aux equinoxes.
  near(declination(dayOfYear(9, 23)), 0, 1.5, "equinoxe d automne");
});

test("hauteur du soleil a midi = 90 - lat + declinaison", () => {
  for (const lat of [43, 45, 48, 51]) {
    for (const [m, d] of [[12, 21], [6, 21], [3, 21]]) {
      const n = dayOfYear(m, d);
      const sun = sunPosition(lat, n, 12);
      near(sun.elevation, 90 - lat + declination(n), 0.05, `lat ${lat} le ${d}/${m}`);
      near(sun.azimuth, 0, 0.01, "azimut plein sud a midi solaire");
    }
  }
});

test("azimut : est le matin, ouest l'apres-midi", () => {
  const n = dayOfYear(6, 21);
  assert.ok(sunPosition(45, n, 8).azimuth < -40, "matin a l'est");
  assert.ok(sunPosition(45, n, 16).azimuth > 40, "apres-midi a l'ouest");
});

test("lever de soleil : 6 h aux equinoxes, plus tard en hiver", () => {
  near(sunriseHour(45, dayOfYear(3, 21)), 6, 0.1, "equinoxe");
  assert.ok(sunriseHour(45, dayOfYear(12, 21)) > 7.5, "lever tardif au solstice d'hiver");
  assert.ok(sunriseHour(45, dayOfYear(6, 21)) < 4.6, "lever tot en juin");
});

test("heure solaire et heure legale sont reciproques", () => {
  const n = dayOfYear(6, 21);
  near(clockTime(solarTime(13.7, 5.4, 2, n), 5.4, 2, n), 13.7, 1e-9, "aller-retour");
  // Marseille (5,4 E) en juin : le midi solaire tombe vers 13 h 35 legales.
  near(clockTime(12, 5.4, 2, n), 13.6, 0.15, "midi solaire a Marseille");
  assert.ok(Math.abs(equationOfTime(dayOfYear(11, 3))) > 14, "maximum de novembre");
});

test("incidence nulle quand le plan suit le soleil", () => {
  const n = dayOfYear(3, 21);
  const sun = sunPosition(45, n, 12);
  near(cosIncidence(45, n, 12, 90 - sun.elevation, 0), 1, 1e-6, "plan perpendiculaire");
  near(cosIncidence(45, n, 12, 0, 0), Math.sin(sun.elevation * Math.PI / 180), 1e-9, "plan horizontal");
});

test("fraction diffuse journaliere : ciel couvert vs ciel clair", () => {
  assert.ok(dailyDiffuseFraction(0.1, 90) > 0.9, "ciel couvert : presque tout est diffus");
  assert.ok(dailyDiffuseFraction(0.7, 90) < 0.30, "ciel clair : peu de diffus");
  assert.ok(dailyDiffuseFraction(0.3, 90) > dailyDiffuseFraction(0.6, 90), "monotonie decroissante");
  // La forme journalière donne bien moins de diffus que la forme horaire :
  // les confondre suffit a fausser l'inclinaison optimale de plusieurs degrés.
  near(dailyDiffuseFraction(0.38, 90), 0.56, 0.03, "ciel voile");
});

/* Non-regression du modèle de ciel contre PVGIS : irradiation horizontale,
   inclinaison optimale, et gain apporte par l'inclinaison optimale. Ces trois
   grandeurs se contraignent mutuellement ; les faire tenir ensemble est ce
   qui a impose le mélange de ciels et la fraction diffuse journalière. */
const SITES = [
  // ville, lat, climat, GHI, inclinaison optimale, rapport optimal / horizontal
  ["Marseille", 43.3, "mediterraneen", 1660, 35, 1.180],
  ["Toulouse", 43.6, "sudouest", 1390, 35, 1.175],
  ["Lyon", 45.75, "sudouest", 1330, 35, 1.173],
  ["Nantes", 47.2, "atlantique", 1259, 36, 1.160],
  ["Strasbourg", 48.6, "continental", 1170, 36, 1.165],
  ["Lille", 50.6, "oceanique", 1060, 36, 1.155]
];

test("irradiations horizontales annuelles conformes aux references", () => {
  for (const [ville, lat, clim, ref] of SITES) {
    const ghi = irradiation(lat, 0, 0, clim);
    near(ghi, ref, ref * 0.04, `${ville} (${ghi.toFixed(0)} calcule)`);
  }
});

test("inclinaison optimale a 3 degres pres des valeurs PVGIS", () => {
  for (const [ville, lat, clim, , ref] of SITES) {
    const opt = tiltSweep(lat, 0, clim).best.tilt;
    near(opt, ref, 3, `${ville}`);
  }
});

test("gain apporte par l'inclinaison optimale, a 2 % pres", () => {
  for (const [ville, lat, clim, , , ref] of SITES) {
    const sw = tiltSweep(lat, 0, clim);
    const gain = sw.best.value / irradiation(lat, 0, 0, clim);
    near(gain, ref, ref * 0.02, `${ville}`);
  }
});

test("penalite d'une toiture plein ouest conforme aux references", () => {
  // PVGIS donne environ 20 % de perte pour un plan a 30 degrés plein ouest.
  for (const [ville, lat, clim] of SITES) {
    const r = irradiation(lat, 30, 90, clim) / irradiation(lat, 30, 0, clim);
    near(r, 0.80, 0.04, `${ville}`);
  }
});

test("optimum hiver plus raide que l'annuel, ete plus plat", () => {
  const an = tiltSweep(45, 0, "sudouest", 0.2, SEASONS.annee.months).best.tilt;
  const hiv = tiltSweep(45, 0, "sudouest", 0.2, SEASONS.hiver.months).best.tilt;
  const ete = tiltSweep(45, 0, "sudouest", 0.2, SEASONS.ete.months).best.tilt;
  assert.ok(hiv > an, `hiver ${hiv} doit depasser l'annuel ${an}`);
  assert.ok(ete < an, `ete ${ete} doit etre sous l'annuel ${an}`);
  assert.ok(hiv > 50, `optimum hivernal attendu au-dela de 50 deg, obtenu ${hiv}`);
});

test("courbe de perte : plate au sommet, penalisante aux extremes", () => {
  const a = tiltAnalysis(45, 35, 0, "sudouest");
  near(a.loss, 0, 0.6, "au voisinage de l'optimum");
  assert.ok(tiltAnalysis(45, 0, 0, "sudouest").loss > 8, "plan horizontal : perte notable");
  assert.ok(tiltAnalysis(45, 90, 0, "sudouest").loss > 25, "plan vertical : forte perte");
  // Tolerance métier : +/- 15 deg autour de l'optimum coute peu.
  assert.ok(tiltAnalysis(45, 20, 0, "sudouest").loss < 5, "20 deg reste acceptable");
  assert.ok(tiltAnalysis(45, 50, 0, "sudouest").loss < 5, "50 deg reste acceptable");
});

test("est et ouest sont symetriques", () => {
  // Le modèle ignore les dissymetries meteo reelles (brume matinale,
  // orages d'après-midi) : est et ouest doivent donc etre equivalents.
  const est = tiltAnalysis(45, 30, -45, "sudouest").actualYield;
  const ouest = tiltAnalysis(45, 30, 45, "sudouest").actualYield;
  near(est, ouest, est * 0.01, "est et ouest equivalents");
});

test("tous les climats sont exploitables et ordonnes", () => {
  const ghi = Object.keys(CLIMATES).map((c) => irradiation(45, 30, 0, c));
  for (const v of ghi) assert.ok(Number.isFinite(v) && v > 500, `irradiation exploitable : ${v}`);
  assert.ok(ghi[0] === Math.max(...ghi), "le climat mediterraneen est le plus genereux");
});

test("l'optimum s'aplatit quand l'azimut s'ecarte du sud", () => {
  const sud = tiltSweep(45, 0, "sudouest").best.tilt;
  const est60 = tiltSweep(45, -60, "sudouest").best.tilt;
  assert.ok(est60 < sud, `azimut -60 : optimum ${est60} doit etre sous ${sud}`);
});
