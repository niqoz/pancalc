/* Indices de clarté mensuels d'un site, tirés des irradiations PVGIS.

   Le moteur de `docs/solar.js` ne consomme rien d'autre : douze nombres par
   zone climatique. Ce script les fabrique, plutôt que de les poser au jugé.

   Kt(mois) = GHI(mois) / H0(mois), où H0 est l'irradiation extraterrestre
   horizontale du mois. **H0 doit être calculée exactement comme le fait le
   moteur** — jour représentatif de Klein, pas d'un quart d'heure — sinon
   `skyMix`, qui pondère les ciels pour retomber sur `kt · H0`, ne rendrait
   plus l'irradiation visée.

   Usage : node tools/kt-pvgis.mjs <fichier-de-villes.json> > sortie.json */

import { extraterrestrialHorizontal, KLEIN_DAYS, MONTH_LENGTHS } from "../docs/solar.js";

const API = "https://re.jrc.ec.europa.eu/api/v5_2/MRcalc";
const ANNEES = { debut: 2005, fin: 2020 };
const PAS = 0.25; // même pas d'intégration que le moteur

/** Irradiation extraterrestre du jour sur plan horizontal, en Wh/m².
    Copie assumée de la fonction privée du moteur : la dupliquer ici évite
    d'élargir l'interface publique de `solar.js` pour un outil hors ligne. */
function extraterrestreJour(lat, n) {
  let wh = 0;
  for (let h = 0; h < 24; h += PAS) wh += extraterrestrialHorizontal(lat, n, h + PAS / 2) * PAS;
  return wh;
}

/** Irradiations horizontales mensuelles moyennes d'un site, en kWh/m². */
async function irradiationsMensuelles(lat, lon) {
  const url = `${API}?lat=${lat}&lon=${lon}&horirrad=1`
    + `&startyear=${ANNEES.debut}&endyear=${ANNEES.fin}&outputformat=json`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`PVGIS ${r.status} pour ${lat},${lon}`);
  const d = await r.json();

  const somme = Array(12).fill(0), n = Array(12).fill(0);
  for (const ligne of d.outputs.monthly) {
    somme[ligne.month - 1] += ligne["H(h)_m"];
    n[ligne.month - 1] += 1;
  }
  return {
    ghi: somme.map((s, m) => s / n[m]),
    base: d.inputs.meteo_data.radiation_db,
    altitude: d.inputs.location.elevation
  };
}

/** Les douze indices de clarté d'un site. */
export async function ktDuSite(lat, lon) {
  const { ghi, base, altitude } = await irradiationsMensuelles(lat, lon);
  const kt = ghi.map((kwh, m) => {
    const h0 = extraterrestreJour(lat, KLEIN_DAYS[m]) * MONTH_LENGTHS[m] / 1000; // kWh/m²/mois
    return Math.round((kwh / h0) * 1000) / 1000;
  });
  return { kt, ghiAnnuel: Math.round(ghi.reduce((a, b) => a + b, 0)), base, altitude };
}

if (process.argv[2]) {
  const villes = JSON.parse(await (await import("node:fs/promises")).readFile(process.argv[2], "utf8"));
  const out = [];
  for (const v of villes) {
    const r = await ktDuSite(v.lat, v.lon);
    out.push({ ...v, ...r });
    process.stderr.write(`${v.nom.padEnd(22)} ${r.ghiAnnuel} kWh/m²  ${r.base}  ${r.altitude} m\n`);
    await new Promise((t) => setTimeout(t, 400)); // ne pas marteler le JRC
  }
  console.log(JSON.stringify(out, null, 1));
}
