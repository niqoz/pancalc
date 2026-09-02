/* Reprise de l'étude dans SolarDim.

   Panel Optimizer répond à « quelle pente, quel écartement » ; SolarDim
   reprend là où il s'arrête — production, autoconsommation, rentabilité,
   fiche client. Le passage de l'un à l'autre ne doit pas se faire en
   recopiant trois nombres à la main sur un toit.

   Le fichier produit est un « transfer v2 », le format d'échange que les
   clients Android et Windows se lisent déjà l'un l'autre
   (`core/.../Transfer.kt`, `exportSessionV2` / `parsePayload`) :

     {app, type, version:2, exportedAt, contents:["session"],
      session:{mask, location:{lat,lon}, params:{tilt, aspect}}}

   Trois précautions tiennent tout le reste :

   - `type` et `contents` ne sont pas décoratifs. C'est le manifeste
     `contents` qui décide de la forme lue, pas le `type` : sans lui le
     fichier serait lu « à plat », donc vidé de ses paramètres sans que rien
     ne le signale.
   - `aspect` est l'azimut de SolarDim, celui de PVGIS : 0 au sud, négatif
     vers l'est. C'est exactement la convention de `etat.azimut`, il n'y a
     donc aucune conversion à faire — et surtout aucune à inventer.
   - `location` exige les deux coordonnées. La latitude seule suffisait au
     calcul d'ici ; le fichier, lui, décrit un chantier. */

const TYPE = "solardim.transfer";
const APPLICATION = "SolarDim";

/** Fragment de nom de fichier sûr — même règle que le `slug()` des deux
    clients, pour que les pièces d'un même chantier se rangent ensemble. */
export function slug(s) {
  return String(s).trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

/** Contenu du fichier d'échange, prêt à être sérialisé.
    @param date instant de l'export, injectable pour que le test soit stable. */
export function payloadTransfert({ lat, lon, tilt, azimut }, date = new Date()) {
  return {
    app: APPLICATION,
    type: TYPE,
    version: 2,
    exportedAt: date.toISOString().replace(/\.\d{3}Z$/, "Z"),
    contents: ["session"],
    session: {
      mask: null,
      location: { lat, lon },
      params: { tilt, aspect: azimut }
    }
  };
}

/** Nom du fichier, selon la grammaire commune aux pièces exportées
    (`ExportNaming`) : faute de dossier client, la marque tient la première
    place, puis la désignation, le lieu et la date. */
export function nomFichier(ville, date = new Date()) {
  const jour = date.toISOString().slice(0, 10);
  const lieu = slug(ville);
  return ["solardim", "reglage", lieu, jour].filter(Boolean).join("-") + ".json";
}

/** Bouton de reprise. Sur téléphone il ouvre le partage du système, d'où
    SolarDim se choisit comme n'importe quelle autre application ; ailleurs il
    enregistre le fichier, qui s'importe depuis l'accueil de SolarDim. */
export function initTransfert({ bouton, etatEl, lire }) {
  if (!bouton) return;
  bouton.addEventListener("click", async () => {
    const etat = lire();
    const date = new Date();
    const nom = nomFichier(etat.ville, date);
    const texte = JSON.stringify(payloadTransfert(etat, date), null, 2);

    try {
      const fichier = new File([texte], nom, { type: "application/json" });
      if (navigator.canShare?.({ files: [fichier] })) {
        await navigator.share({ files: [fichier], title: nom });
        etatEl.textContent = "Réglage envoyé.";
        return;
      }
    } catch (e) {
      // Partage refusé ou annulé : on retombe sur l'enregistrement, plutôt
      // que de laisser l'installateur devant un bouton sans effet.
      if (e && e.name === "AbortError") { etatEl.textContent = ""; return; }
    }

    const url = URL.createObjectURL(new Blob([texte], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = nom;
    a.click();
    URL.revokeObjectURL(url);
    etatEl.textContent = `Enregistré sous ${nom}. À importer depuis l'accueil de SolarDim.`;
  });
}
