/* Repères géographiques : de quoi régler l'application en un geste sur le
   chantier, sans avoir a chercher sa latitude. */

/** Villes de référence : nom, latitude, longitude, zone climatique. */
export const CITIES = [
  ["Porto-Vecchio", 41.59, 9.28, "mediterraneen"],
  ["Ajaccio", 41.93, 8.74, "mediterraneen"],
  ["Aléria", 42.11, 9.51, "mediterraneen"],
  ["Corte", 42.31, 9.15, "mediterraneen"],
  ["Cervione", 42.33, 9.49, "mediterraneen"],
  ["Bastia", 42.70, 9.45, "mediterraneen"],
  ["Perpignan", 42.70, 2.90, "mediterraneen"],
  ["Nice", 43.70, 7.27, "mediterraneen"],
  ["Marseille", 43.30, 5.37, "mediterraneen"],
  ["Montpellier", 43.61, 3.88, "mediterraneen"],
  ["Toulouse", 43.60, 1.44, "sudouest"],
  ["Bordeaux", 44.84, -0.58, "sudouest"],
  ["Valence", 44.93, 4.89, "sudouest"],
  ["Clermont-Ferrand", 45.78, 3.08, "continental"],
  ["Lyon", 45.75, 4.85, "sudouest"],
  ["La Rochelle", 46.16, -1.15, "atlantique"],
  ["Limoges", 45.83, 1.26, "atlantique"],
  ["Dijon", 47.32, 5.04, "continental"],
  ["Nantes", 47.22, -1.55, "atlantique"],
  ["Tours", 47.39, 0.69, "atlantique"],
  ["Rennes", 48.11, -1.68, "atlantique"],
  ["Brest", 48.39, -4.49, "atlantique"],
  ["Strasbourg", 48.58, 7.75, "continental"],
  ["Orléans", 47.90, 1.90, "continental"],
  ["Paris", 48.86, 2.35, "continental"],
  ["Rouen", 49.44, 1.10, "oceanique"],
  ["Amiens", 49.89, 2.30, "oceanique"],
  ["Lille", 50.63, 3.06, "oceanique"]
];

/** Repère le plus proche de coordonnées données : son nom, sa distance en
    kilomètres, et sa zone climatique.

    La zone est celle du repère le plus proche, et non le résultat d'un
    découpage géographique séparé : une seule source de vérité, celle du
    tableau ci-dessus, évite de voir les deux diverger. Le relevé place le
    curseur au bon endroit pour démarrer, l'utilisateur reste libre de
    corriger la zone d'un geste. */
export function nearestCity(lat, lon) {
  let best = CITIES[0], bestD = Infinity;
  for (const c of CITIES) {
    const dx = (c[2] - lon) * Math.cos(lat * Math.PI / 180), dy = c[1] - lat;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = c; }
  }
  return { name: best[0], km: Math.round(Math.sqrt(bestD) * 111), zone: best[3] };
}
