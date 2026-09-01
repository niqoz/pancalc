/* Mise à jour de l'application installée.

   Une application lancée depuis l'écran d'accueil n'est jamais « rechargée »
   au sens du navigateur : elle est mise en veille puis reprise. Sans
   demande explicite, rien ne va donc chercher une nouvelle version, et le
   tirer-pour-rafraîchir n'existe pas en mode autonome. On interroge le
   serveur au démarrage et à chaque retour au premier plan.

   Les réglages étant enregistrés à chaque modification, un rechargement ne
   fait rien perdre : la nouvelle version peut s'appliquer sans rien
   demander. */

/** Faut-il recharger la page quand le service worker change la main ?
    Au tout premier enregistrement il n'y avait aucun contrôleur : la prise
    de contrôle est normale et ne signale aucune nouvelle version. */
export function doitRecharger(avaitUnControleur, dejaEnCours) {
  return avaitUnControleur && !dejaEnCours;
}

export function initMiseAJour(chemin = "sw.js") {
  if (!("serviceWorker" in navigator)) return;

  const avaitUnControleur = Boolean(navigator.serviceWorker.controller);
  let rechargeEnCours = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!doitRecharger(avaitUnControleur, rechargeEnCours)) return;
    rechargeEnCours = true;
    location.reload();
  });

  navigator.serviceWorker.register(chemin).then((inscription) => {
    const verifier = () => inscription.update().catch(() => { /* hors ligne */ });
    verifier();
    // Reprise après veille : c'est le seul moment où une application
    // installée peut apprendre qu'une version l'attend.
    addEventListener("visibilitychange", () => { if (!document.hidden) verifier(); });
    addEventListener("online", verifier);
  }).catch(() => { /* premier lancement hors ligne, on réessaiera */ });
}
