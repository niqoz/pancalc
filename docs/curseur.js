/* Comportement des curseurs.

   Sur un chantier, un appui sur la piste d'un curseur suffit a deplacer la
   valeur de plusieurs degres sans qu'on s'en apercoive : le doigt qui amorce
   un defilement se pose forcement quelque part. Seule une prise sur la
   poignee est donc acceptee.

   Annuler le geste par preventDefault sur pointerdown ne suffit pas : les
   navigateurs deplacent la poignee dans leur code natif, hors de portee de
   l'evenement. On laisse donc le deplacement se produire puis on remet la
   valeur en place, ce qui ne depend d'aucun comportement annulable. */

/** Abscisse du centre de la poignee, en pixels depuis le bord gauche du
    curseur. Le centre ne parcourt pas toute la largeur : il reste a une
    demi-poignee de chaque extremite, sinon la poignee deborderait. */
export function positionPoignee(min, max, valeur, largeur, poignee) {
  const r = poignee / 2;
  const t = max === min ? 0 : (valeur - min) / (max - min);
  return r + (largeur - poignee) * Math.min(1, Math.max(0, t));
}

/** Vrai si une prise a cette abscisse doit etre refusee. */
export function horsPoignee(min, max, valeur, largeur, x, poignee, tolerance) {
  const centre = positionPoignee(min, max, valeur, largeur, poignee);
  return Math.abs(x - centre) > poignee / 2 + tolerance;
}

/* Valeur a restaurer, par curseur, tant que la prise en cours est refusee. */
const refus = new WeakMap();
let gardeInstallee = false;

/* Le garde ecoute sur le document en phase de capture : il passe ainsi avant
   tout ecouteur pose sur le curseur lui-meme, quel que soit l'ordre dans
   lequel ils ont ete ajoutes. L'application ne voit jamais la valeur refusee. */
function installerGarde() {
  if (gardeInstallee) return;
  gardeInstallee = true;
  document.addEventListener("input", (e) => {
    const v = refus.get(e.target);
    if (v === undefined) return;
    e.target.value = v;
    e.stopImmediatePropagation();
  }, true);
}

/** Restreint un curseur a sa poignee.
    @param poignee largeur de la poignee en pixels, doit suivre le CSS.
    @param tolerance marge acceptee de part et d'autre. */
export function limiterALaPoignee(el, { poignee = 32, tolerance = 10 } = {}) {
  installerGarde();

  el.addEventListener("pointerdown", (e) => {
    const r = el.getBoundingClientRect();
    if (horsPoignee(+el.min, +el.max, +el.value, r.width, e.clientX - r.left, poignee, tolerance)) {
      refus.set(el, el.value);
      e.preventDefault(); // suffit sur certains navigateurs, le garde fait le reste
    } else {
      refus.delete(el);
    }
  });

  const relacher = () => refus.delete(el);
  for (const ev of ["pointerup", "pointercancel", "lostpointercapture", "blur"]) {
    el.addEventListener(ev, relacher);
  }
}
