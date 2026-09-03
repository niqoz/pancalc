/* La position GPS sert à proposer un changement, jamais à déplacer le
   chantier choisi sans un appui de l'utilisateur. Elle reste en mémoire. */

/** Tolérance de 10 km : la latitude des calculs est arrondie à 0,1°.
    Une mesure GPS moins précise ne doit pas déclencher une fausse alerte. */
export function positionDifferente(site, coords) {
  if (!coords || ![site.lat, site.lon, coords.latitude, coords.longitude].every(Number.isFinite)) return true;
  const rad = Math.PI / 180;
  const dLat = (coords.latitude - site.lat) * rad;
  const dLon = (coords.longitude - site.lon) * rad;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(site.lat * rad) * Math.cos(coords.latitude * rad) * Math.sin(dLon / 2) ** 2;
  const km = 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
  const precision = Number.isFinite(coords.accuracy) ? Math.max(0, coords.accuracy) / 1000 : 0;
  return km > Math.max(10, precision);
}

export function creerLocalisation({ navigateur, lireSite, appliquer, afficher }) {
  let position = null;
  let enCours = false;
  let message = "";
  const disponible = Boolean(navigateur.geolocation);

  function actualiser() {
    afficher({
      visible: disponible && (enCours || !position || positionDifferente(lireSite(), position)),
      enCours, disponible, message
    });
  }

  function relever(appliquerPosition = true) {
    if (enCours) return;
    if (!disponible) {
      message = "Ce navigateur ne donne pas la position.";
      actualiser();
      return;
    }
    enCours = true;
    message = appliquerPosition ? "Relevé en cours…" : "";
    actualiser();
    const echouer = () => {
      enCours = false;
      position = null;
      message = appliquerPosition ? "Position refusée ou indisponible. Choisis une ville ou réessaie." : "";
      actualiser();
    };
    try {
      navigateur.geolocation.getCurrentPosition(({ coords }) => {
        enCours = false;
        if (![coords.latitude, coords.longitude].every(Number.isFinite)
          || coords.latitude < 35 || coords.latitude > 60 || Math.abs(coords.longitude) > 180) {
          position = null;
          message = appliquerPosition ? "Position hors de la zone de latitude couverte (35 à 60° N). Choisis une ville." : "";
        } else {
          position = coords;
          if (appliquerPosition) message = appliquer(coords);
        }
        actualiser();
      }, echouer, { timeout: 10000, maximumAge: 60000 });
    } catch { echouer(); }
  }

  async function verifier() {
    // Ne jamais provoquer une demande de permission à l'ouverture.
    // Sans Permissions API, « Me localiser » reste un raccourci explicite.
    if (!disponible || enCours || !navigateur.permissions?.query) return;
    try {
      const permission = await navigateur.permissions.query({ name: "geolocation" });
      if (permission.state === "granted") relever(false);
      else { position = null; actualiser(); }
    } catch { /* Le relevé manuel reste disponible. */ }
  }

  function effacerMessage() {
    message = "";
    actualiser();
  }

  actualiser();
  return { actualiser, relever, verifier, effacerMessage };
}
