/* Géométrie des rangées : écartement, emprise au sol, calepinage inverse.

   Toutes les longueurs sont en mètres. Une "rangée" est une file de panneaux
   perpendiculaire a l'azimut du champ ; L est la longueur du panneau dans le
   sens de la pente (1,13 m pour un module portrait couche, 2,28 m debout).

     h = L·sin(beta)          différence de hauteur bas -> haut du panneau
     d = h·cos(dAz)/tan(alt)  espace libre entre le bas d'une rangée et le
                              haut de la précédente, a l'instant considère
     D = L·cos(beta) + d      pas entre rangées (pitch), = emprise unitaire

   Le critère de dimensionnement est une date et une plage horaire solaire :
   on retient le pire instant de la plage. Le 21 décembre a midi seul donne
   des champs compacts ; 9 h - 15 h le même jour peut doubler l'écartement.
   C'est le choix le plus structurant de tout le calcul. */

import { sunPosition, dayOfYear, toRad, sunriseHour, irradiation } from "./solar.js";

/** Critères d'ombrage courants. `span` = demi-plage en heures autour du midi
    solaire ; 0 = midi seul. */
export const CRITERIA = {
  solstice_midi: { label: "21 déc., midi solaire", month: 12, day: 21, span: 0 },
  solstice_4h: { label: "21 déc., 10 h à 14 h", month: 12, day: 21, span: 2 },
  solstice_6h: { label: "21 déc., 9 h à 15 h", month: 12, day: 21, span: 3 },
  equinoxe_6h: { label: "21 mars, 9 h à 15 h", month: 3, day: 21, span: 3 },
  equinoxe_8h: { label: "21 mars, 8 h à 16 h", month: 3, day: 21, span: 4 }
};

/** Hauteur du bord haut du panneau au-dessus de son bord bas. */
export const panelRise = (length, tilt) => length * Math.sin(toRad(tilt));

/** Projection horizontale du panneau. */
export const panelRun = (length, tilt) => length * Math.cos(toRad(tilt));

/** Espace libre exige entre rangées, en mètres.
    Renvoie aussi l'instant dimensionnant, celui qu'il faut pouvoir citer au
    client quand il demande pourquoi les rangées sont si espacées. */
export function rowSpacing(lat, length, tilt, fieldAzimuth, criterion) {
  const c = CRITERIA[criterion] || criterion;
  const n = dayOfYear(c.month, c.day);
  const rise = panelRise(length, tilt);
  let worst = { spacing: 0, hour: 12, elevation: 0, azimuth: 0 };

  // Balayage par pas de 5 min : le maximum tombe rarement pile sur une heure
  // ronde. Indices entiers plutôt qu'accumulation de flottants, pour que le
  // matin et le soir restent exactement symétriques a azimut nul.
  const steps = Math.round(c.span * 12);
  for (let i = -steps; i <= steps; i++) {
    const t = 12 + i / 12;
    const sun = sunPosition(lat, n, t);
    if (sun.elevation <= 0.5) continue; // sous l'horizon ou rasant : hors critère
    const dAz = Math.cos(toRad(sun.azimuth - fieldAzimuth));
    if (dAz <= 0) continue; // soleil derrière le champ, pas d'ombre vers l'arrière
    const spacing = rise * dAz / Math.tan(toRad(sun.elevation));
    if (spacing > worst.spacing) {
      worst = { spacing, hour: t, elevation: sun.elevation, azimuth: sun.azimuth };
    }
  }
  return worst;
}

/** Dimensionnement complet d'un champ de rangées. */
export function rowLayout(lat, length, tilt, fieldAzimuth, criterion) {
  const s = rowSpacing(lat, length, tilt, fieldAzimuth, criterion);
  const run = panelRun(length, tilt);
  const pitch = run + s.spacing;
  return {
    rise: panelRise(length, tilt),
    run,
    spacing: s.spacing,
    pitch,
    gcr: length / pitch, // taux de couverture du sol
    sun: { hour: s.hour, elevation: s.elevation, azimuth: s.azimuth }
  };
}

/** Fenêtre horaire sans ombrage obtenue avec un pas impose, le jour donne.
    Sert a répondre a « et si je resserre a 4 m, je perds quoi ? ».
    @returns {{start:number, end:number, hours:number}|null} heures solaires. */
export function shadeFreeWindow(lat, length, tilt, fieldAzimuth, pitch, month, day) {
  const n = dayOfYear(month, day);
  const rise = panelRise(length, tilt);
  const free = pitch - panelRun(length, tilt);
  const sr = sunriseHour(lat, n);
  if (sr === null) return null;
  let start = null, end = null;
  for (let t = sr; t <= 24 - sr; t += 1 / 60) {
    const sun = sunPosition(lat, n, t);
    let shaded = false;
    if (sun.elevation > 0) {
      const dAz = Math.cos(toRad(sun.azimuth - fieldAzimuth));
      if (dAz > 0) shaded = rise * dAz / Math.tan(toRad(sun.elevation)) > free + 1e-3;
    } else {
      shaded = true;
    }
    if (!shaded && start === null) start = t;
    if (!shaded) end = t;
  }
  if (start === null) return null;
  return { start, end, hours: end - start };
}

/* --- Calepinage inverse : terrain contraint --------------------------------
   Sur une profondeur donnée, augmenter l'inclinaison améliore le rendement
   de chaque panneau mais espace les rangées, donc en réduit le nombre. Le
   compromis se joue entre les deux et l'optimum est nettement plus plat que
   l'optimum d'un panneau isole. */

/** Nombre de rangées tenant sur une profondeur donnée. La dernière rangée
    n'a besoin que de son emprise propre, pas d'un pas complet. */
export function rowCount(depth, length, tilt, pitch) {
  const run = panelRun(length, tilt);
  if (depth < run) return 0;
  return Math.floor((depth - run) / pitch) + 1;
}

/** Bilan d'un champ sur terrain contraint, ramené au mètre de largeur. */
export function fieldYield(lat, depth, length, tilt, fieldAzimuth, criterion, climate, albedo = 0.2) {
  const layout = rowLayout(lat, length, tilt, fieldAzimuth, criterion);
  const rows = rowCount(depth, length, tilt, layout.pitch);
  const perM2 = irradiation(lat, tilt, fieldAzimuth, climate, albedo);
  const moduleArea = rows * length; // m² de module par mètre de largeur de terrain
  return {
    ...layout,
    rows,
    moduleArea,
    perModuleM2: perM2,          // kWh/m² de module et par an
    perGroundM2: moduleArea * perM2 / depth, // kWh par m² de terrain et par an
    total: moduleArea * perM2,   // kWh par mètre de largeur et par an
    usedDepth: rows > 0 ? (rows - 1) * layout.pitch + layout.run : 0
  };
}

/** Inclinaison minimale retenue au sol. En dessous, la pluie ne rince plus
    les modules : poussières, pollens et fientes s'accumulent en bas de vitre.
    C'est une borne métier, pas une borne de calcul, mais elle est
    indispensable : maximiser la seule production au mètre carre de terrain
    conduirait sinon toujours a poser les modules a plat, puisque le gain de
    rangées l'emporte sur la perte unitaire. */
export const MIN_TILT = 10;

/** Balayage d'inclinaison sous contrainte de profondeur de terrain.
    Les deux optima répondent a deux questions différentes et ne coïncident
    jamais : `best` maximise l'énergie récoltée sur le terrain disponible
    (l'inclinaison est alors plate, on entasse les rangées), `bestPerModule`
    maximise l'énergie de chaque module (c'est l'optimum du panneau seul, il
    ignore le terrain). L'arbitrage entre les deux est économique : terrain
    cher contre modules chers. L'application montre les deux courbes. */
export function fieldSweep(lat, depth, length, fieldAzimuth, criterion, climate, albedo = 0.2, step = 1) {
  const curve = [];
  let best = null, bestPerModule = null;
  for (let t = MIN_TILT; t <= 60; t += step) {
    const f = fieldYield(lat, depth, length, t, fieldAzimuth, criterion, climate, albedo);
    curve.push({ tilt: t, rows: f.rows, total: f.total, pitch: f.pitch, perModule: f.perModuleM2 });
    if (f.rows > 0 && (!best || f.total > best.total)) best = { tilt: t, ...f };
    if (!bestPerModule || f.perModuleM2 > bestPerModule.perModuleM2) bestPerModule = { tilt: t, ...f };
  }
  return { curve, best, bestPerModule };
}

/** Paliers de rangées : pour chaque nombre de rangées atteignable sur la
    profondeur donnée, l'inclinaison maximale qui le préserve encore.
    C'est l'information directement exploitable sur le terrain : la
    production ne varie pas continûment avec l'inclinaison, elle chute d'un
    coup des qu'une rangée ne rentre plus. Mieux vaut donc se placer juste
    sous une marche que juste au-dessus. */
export function rowSteps(lat, depth, length, fieldAzimuth, criterion, climate, albedo = 0.2) {
  const { curve } = fieldSweep(lat, depth, length, fieldAzimuth, criterion, climate, albedo);
  const steps = [];
  for (const p of curve) {
    if (p.rows === 0) continue;
    const last = steps[steps.length - 1];
    if (last && last.rows === p.rows) {
      last.maxTilt = p.tilt;
      last.total = p.total;
      last.pitch = p.pitch;
    } else {
      steps.push({ rows: p.rows, minTilt: p.tilt, maxTilt: p.tilt, total: p.total, pitch: p.pitch });
    }
  }
  return steps;
}
