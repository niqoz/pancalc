/* Assemblage de l'interface. Toute la physique vit dans solar.js et
   layout.js, tout le dessin dans draw.js ; ce fichier ne fait que relier
   les commandes aux schémas. */

import { CLIMATES, SEASONS, tiltAnalysis, tiltSweep } from "./solar.js";
import { CRITERIA, rowLayout, fieldYield, rowSteps, shadeFreeWindow, MIN_TILT } from "./layout.js";
import { CITIES, zoneFromCoords, nearestCity } from "./sites.js";
import { drawTilt, drawRows, drawField, drawLossCurve, m, mc, deg, pct, hm, pl } from "./draw.js";

/** Puissance crêtes des modules courants, par mètre carre de module.
    Sert uniquement a convertir une surface en puissance installable. */
const WC_PAR_M2 = 210;

/** Longueurs de panneau usuelles, mesurées dans le sens de la pente. */
const LONGUEURS = [
  [1.13, "paysage"],
  [1.72, "portrait"],
  [2.28, "grand format"],
  [3.45, "2 en portrait"]
];

const defauts = {
  lat: 45.8, climat: "sudouest", ville: "Lyon",
  tilt: 30, azimut: 0, saison: "annee",
  longueur: 1.72, tiltR: 25, azimutR: 0, critere: "solstice_6h",
  profondeur: 20, tiltT: 20
};

const CLE = "pancalc.reglages";
let etat = { ...defauts };
try { Object.assign(etat, JSON.parse(localStorage.getItem(CLE) || "{}")); } catch { /* premier lancement */ }

const $ = (id) => document.getElementById(id);
const sauver = () => { try { localStorage.setItem(CLE, JSON.stringify(etat)); } catch { /* mode prive */ } };

/** Orientation en toutes lettres : personne ne raisonne en degrés d'azimut
    sur un toit, on dit « plein sud » ou « sud-ouest ». */
function nomAzimut(a) {
  const noms = [[-90, "plein est"], [-67, "est-sud-est"], [-45, "sud-est"], [-22, "sud-sud-est"],
    [0, "plein sud"], [22, "sud-sud-ouest"], [45, "sud-ouest"], [67, "ouest-sud-ouest"], [90, "plein ouest"]];
  return noms.reduce((best, n) => (Math.abs(n[0] - a) < Math.abs(best[0] - a) ? n : best))[1];
}

/* --- Construction des commandes ------------------------------------------- */

function remplirSelect(el, entrees, valeur) {
  el.innerHTML = entrees.map(([v, t]) =>
    `<option value="${v}"${v === valeur ? " selected" : ""}>${t}</option>`).join("");
}

/** Groupe de boutons exclusifs, plus sur au doigt qu'un menu déroulant. */
function groupeChoix(el, entrees, valeur, onChange) {
  el.innerHTML = entrees.map(([v, t, sous]) =>
    `<button type="button" role="radio" data-v="${v}" aria-checked="${v === valeur}">${t}${
      sous ? `<small>${sous}</small>` : ""}</button>`).join("");
  el.onclick = (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    for (const x of el.querySelectorAll("button")) x.setAttribute("aria-checked", x === b);
    onChange(b.dataset.v);
  };
}

/* --- Vue 1 : inclinaison --------------------------------------------------- */

function rendreInclinaison() {
  const mois = SEASONS[etat.saison].months;
  const a = tiltAnalysis(etat.lat, etat.tilt, etat.azimut, etat.climat, 0.2, mois);

  $("plan-inclinaison").innerHTML = drawTilt({ tilt: etat.tilt, optimal: a.optimal });
  $("courbe-perte").innerHTML = drawLossCurve({ sweep: a.sweep, tilt: etat.tilt });

  const proche = Math.abs(a.optimal - etat.tilt) <= 1;
  $("verdict-inclinaison").innerHTML = proche
    ? `<b>${deg(etat.tilt)} ${nomAzimut(etat.azimut)}</b>, c'est l'optimum ici.`
    : `À ${deg(etat.tilt)} ${nomAzimut(etat.azimut)}, tu perds <b>${pct(a.loss)}</b> `
      + `contre l'optimum de <b>${deg(a.optimal)}</b>.`;

  const loss = a.sweep.yield.map((v) => (1 - v / a.sweep.best.value) * 100);
  const dans = loss.map((p, i) => (p <= 5 ? i : -1)).filter((i) => i >= 0);
  $("legende-plage").textContent =
    `Entre ${dans[0]}° et ${dans[dans.length - 1]}°, la perte reste sous 5 %. `
    + `Calculé sur ${SEASONS[etat.saison].hint} en zone ${CLIMATES[etat.climat].label}.`;
}

/* --- Vue 2 : rangées ------------------------------------------------------- */

function rendreRangees() {
  const l = rowLayout(etat.lat, etat.longueur, etat.tiltR, etat.azimutR, etat.critere);
  $("plan-rangees").innerHTML = drawRows({ length: etat.longueur, tilt: etat.tiltR, layout: l });

  $("verdict-rangees").innerHTML =
    `Laisse <b>${m(l.spacing)}</b> entre le haut d'une rangée et le pied de la suivante, `
    + `soit <b>${m(l.pitch)}</b> de pas.`;

  const w = shadeFreeWindow(etat.lat, etat.longueur, etat.tiltR, etat.azimutR, l.pitch, 12, 21);
  $("chiffres-rangees").innerHTML = [
    ["Hauteur de rangée", m(l.rise)],
    ["Emprise du panneau", m(l.run)],
    ["Couverture du sol", `${Math.round(l.gcr * 100)} %`],
    ["Soleil dimensionnant", `${deg(l.sun.elevation)} à ${hm(l.sun.hour)}`],
    ["Sans ombre le 21 déc.", w ? `${w.hours.toFixed(1).replace(".", ",")} h` : "jamais"]
  ].map(([t, v]) => `<div><dt>${t}</dt><dd>${v}</dd></div>`).join("");
}

/* --- Vue 3 : terrain ------------------------------------------------------- */

function rendreTerrain() {
  const { lat, profondeur: p, longueur: L, tiltT: t, azimutR: az, critere: c, climat } = etat;
  const f = fieldYield(lat, p, L, t, az, c, climat);
  $("plan-terrain").innerHTML = drawField({ depth: p, length: L, tilt: t, field: f });

  if (f.rows === 0) {
    $("verdict-terrain").innerHTML =
      `Aucune rangée ne tient sur <b>${mc(p)}</b> à ${deg(t)}. Aplatis les tables ou gagne du terrain.`;
    $("paliers").innerHTML = "";
    return;
  }

  const steps = rowSteps(lat, p, L, az, c, climat);
  const meilleur = steps.reduce((a, b) => (b.total > a.total ? b : a));
  const palier = steps.find((s) => t >= s.minTilt && t <= s.maxTilt);
  const mwc = f.rows * L / p * WC_PAR_M2 * 10000 / 1e6;

  const marge = palier && t < palier.maxTilt
    ? ` Tu peux monter à ${deg(palier.maxTilt)} sans perdre de rangée.`
    : palier ? ` Un degré de plus et tu tombes à ${palier.rows - 1} ${pl(palier.rows - 1, "rangée")}.` : "";
  $("verdict-terrain").innerHTML =
    `Sur <b>${mc(p)}</b> de profondeur, ${deg(t)} loge <b>${f.rows} ${pl(f.rows, "rangée")}</b>, `
    + `soit <b>${mwc.toFixed(2).replace(".", ",")} MWc/ha</b>.${marge}`;

  $("paliers").innerHTML = steps.map((s) => `
    <div class="palier" data-actif="${s === palier ? "oui" : "non"}">
      <b>${s.rows}</b><span>${pl(s.rows, "rangée")}</span>
      <span>${s.minTilt === s.maxTilt ? `${s.minTilt}°` : `${s.minTilt}° à ${s.maxTilt}°`}${
        s === meilleur ? " · meilleur" : ""}</span>
      <em>${Math.round(s.total / meilleur.total * 100)} %</em>
    </div>`).join("");
}

/* --- Orchestration --------------------------------------------------------- */

let vue = "inclinaison";
const rendus = { inclinaison: rendreInclinaison, rangees: rendreRangees, terrain: rendreTerrain };

function rendre() {
  $("site-libelle").textContent = etat.ville;
  $("site-detail").textContent =
    `${etat.lat.toFixed(1).replace(".", ",")}° N · ${CLIMATES[etat.climat].label}`;
  rendus[vue]();
  sauver();
}

/** Curseur relie a une clé d'état, avec sa valeur affichée en direct. */
function curseur(id, cle, format, apres) {
  const el = $(id), out = $(`${id}-val`);
  el.value = etat[cle];
  const maj = () => { if (out) out.textContent = format(Number(el.value)); };
  maj();
  el.addEventListener("input", () => {
    etat[cle] = Number(el.value);
    maj();
    if (apres) apres();
    rendre();
  });
}

function initOnglets() {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const activer = (tab, ancre = true) => {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute("aria-selected", on);
      t.tabIndex = on ? 0 : -1;
      $(t.getAttribute("aria-controls")).hidden = !on;
    }
    vue = tab.id.replace("tab-", "");
    if (ancre && location.hash.slice(1) !== vue) history.replaceState(null, "", `#${vue}`);
    rendre();
  };
  const parAncre = () => {
    const t = tabs.find((x) => x.id === `tab-${location.hash.slice(1)}`);
    if (t) activer(t, false);
  };
  addEventListener("hashchange", parAncre);
  parAncre();
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => activer(t));
    t.addEventListener("keydown", (e) => {
      const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      const suivant = tabs[(i + d + tabs.length) % tabs.length];
      suivant.focus();
      activer(suivant);
    });
  });
}

function initSite() {
  const bouton = $("ouvrir-site"), panneau = $("site");
  bouton.addEventListener("click", () => {
    const ouvert = panneau.hidden;
    panneau.hidden = !ouvert;
    bouton.setAttribute("aria-expanded", ouvert);
  });

  remplirSelect($("ville"), CITIES.map((c) => [c[0], c[0]]), etat.ville);
  $("ville").addEventListener("change", (e) => {
    const c = CITIES.find((x) => x[0] === e.target.value);
    etat.ville = c[0]; etat.lat = c[1]; etat.climat = c[3];
    $("latitude").value = etat.lat;
    $("latitude-val").textContent = `${etat.lat.toFixed(1).replace(".", ",")}°`;
    $("climat").value = etat.climat;
    majAideClimat();
    rendre();
  });

  remplirSelect($("climat"), Object.entries(CLIMATES).map(([k, v]) => [k, v.label]), etat.climat);
  $("climat").addEventListener("change", (e) => { etat.climat = e.target.value; majAideClimat(); rendre(); });

  curseur("latitude", "lat", (v) => `${v.toFixed(1).replace(".", ",")}°`);

  $("geoloc").addEventListener("click", () => {
    const etatEl = $("geoloc-etat");
    if (!navigator.geolocation) { etatEl.textContent = "Ce navigateur ne donne pas la position."; return; }
    etatEl.textContent = "Relevé en cours…";
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        etat.lat = Math.round(coords.latitude * 10) / 10;
        etat.climat = zoneFromCoords(coords.latitude, coords.longitude);
        const proche = nearestCity(coords.latitude, coords.longitude);
        etat.ville = proche.km < 12 ? proche.name : `Près de ${proche.name}`;
        $("latitude").value = etat.lat;
        $("latitude-val").textContent = `${etat.lat.toFixed(1).replace(".", ",")}°`;
        $("climat").value = etat.climat;
        $("ville").value = CITIES.some((c) => c[0] === etat.ville) ? etat.ville : CITIES[0][0];
        majAideClimat();
        etatEl.textContent = `Position relevée, à ${proche.km} km de ${proche.name}. Vérifie la zone climatique.`;
        rendre();
      },
      () => { etatEl.textContent = "Position refusée ou indisponible. Choisis une ville."; },
      { timeout: 10000, maximumAge: 300000 }
    );
  });
}

const majAideClimat = () => { $("climat-aide").textContent = CLIMATES[etat.climat].hint; };

function initCommandes() {
  curseur("inclinaison-p", "tilt", deg);
  curseur("azimut-p", "azimut", (v) => `${deg(Math.abs(v))} ${nomAzimut(v)}`);
  groupeChoix($("saison"), Object.entries(SEASONS).map(([k, v]) => [k, v.label, v.hint]), etat.saison,
    (v) => { etat.saison = v; rendre(); });

  const saisie = $("longueur");
  saisie.value = etat.longueur;
  const majLongueur = (v) => {
    etat.longueur = Math.min(8, Math.max(0.5, v));
    saisie.value = etat.longueur;
    rendre();
  };
  groupeChoix($("longueur-choix"), LONGUEURS.map(([v, t]) => [v, `${v.toFixed(2).replace(".", ",")} m`, t]),
    etat.longueur, (v) => majLongueur(Number(v)));
  saisie.addEventListener("change", () => majLongueur(Number(saisie.value)));

  curseur("inclinaison-r", "tiltR", deg);
  curseur("azimut-r", "azimutR", (v) => `${deg(Math.abs(v))} ${nomAzimut(v)}`);
  remplirSelect($("critere"), Object.entries(CRITERIA).map(([k, v]) => [k, v.label]), etat.critere);
  $("critere").addEventListener("change", (e) => { etat.critere = e.target.value; rendre(); });

  curseur("profondeur", "profondeur", mc);
  curseur("inclinaison-t", "tiltT", deg);
  $("inclinaison-t").min = MIN_TILT;
}

initOnglets();
initSite();
initCommandes();
majAideClimat();
rendre();

if ("serviceWorker" in navigator) {
  addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => { /* hors ligne */ }));
}
