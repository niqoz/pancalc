/* Comportement des curseurs au doigt.

   Sur un telephone tenu a bout de bras sur un chantier, un appui sur la piste
   d'un curseur suffit a deplacer la valeur de plusieurs degres sans qu'on
   s'en apercoive : le doigt qui amorce un defilement se pose forcement
   quelque part. On restreint donc la prise a la poignee, et seulement pour
   les pointeurs tactiles : a la souris, cliquer la piste reste un geste
   normal et sans risque. */

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

/** Applique la restriction a un curseur. */
export function limiterALaPoignee(el, { poignee = 32, tolerance = 10 } = {}) {
  el.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "touch") return; // la souris garde le clic sur piste
    const r = el.getBoundingClientRect();
    if (horsPoignee(+el.min, +el.max, +el.value, r.width, e.clientX - r.left, poignee, tolerance)) {
      e.preventDefault(); // le curseur ne bouge pas, le defilement suit son cours
    }
  });
}
