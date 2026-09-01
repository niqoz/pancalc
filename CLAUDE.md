# SolarDim Panel Optimizer — notes pour les sessions suivantes

Application satellite de SolarDim, utilisable hors connexion, pour calculer
l'inclinaison et la distance entre rangées. Deux onglets, Inclinaison et
Rangées. Voir `README.md` pour le modèle et ses limites.

## Conventions

- Pas de dépendance, pas de build. Modules ES chargés directement par le
  navigateur ; les tests tournent sous `node --test` sur les mêmes fichiers.
- Tout ce qui est livré vit dans `docs/` (GitHub Pages sert ce dossier). Les
  tiers sont versionnés dans `docs/vendor/`, jamais récupérés au build.
- Commentaires et libellés en français accentué. Les identifiants de code
  restent sans accents (`etat`, `critere`, `rangees`) : ne pas les « corriger ».
- Un test vérifie que la liste `ASSETS` de `docs/sw.js` couvre bien tous les
  fichiers livrés. Incrémenter `CACHE` n'est plus nécessaire pour diffuser une
  mise à jour, seulement pour évincer des fichiers retirés.

## Habillage

Palette « Terrasse » reprise de SolarDim (`~/Projets/solardim-site/index.html`
pour les variables CSS, `SolairDimDroid/.../ui/theme/Color.kt` pour leur
commentaire d'origine) : beige papier, encre brune, terracotta en accent,
Fraunces en titres et valeurs chiffrées, DM Sans en corps, étiquettes en
petites capitales monospacées. La séparation se fait au trait, jamais à
l'ombre. Le mode sombre est porté à l'identique, avec les trois sélecteurs de
la source : `:root`, le `@media` et `:root[data-theme="dark"]` — ce dernier
sert aussi à vérifier le rendu sombre en capture.

Fraunces est nettement plus large que la condensée employée auparavant :
toute reprise des schémas doit revérifier que les cotes tiennent dans leur
cadre.

Les schémas prennent leurs couleurs des variables CSS, jamais de littéraux :
le mode sombre suit alors sans retouche.

## Pièges déjà rencontrés

- **Corrélation d'Erbs** : la forme horaire et la forme journalière diffèrent
  nettement. Appliquer l'horaire à un indice de clarté journalier surévalue le
  diffus de moitié et rend le modèle aveugle à l'orientation.
- **Ciel voilé** : un modèle binaire clair/couvert suffit à fausser
  l'inclinaison optimale de 4°. Le régime voilé est dominant en France.
- **Attribut `hidden`** : son `display:none` est de faible priorité et se fait
  écraser par toute règle de mise en page. D'où le `[hidden]{display:none
  !important}` de `style.css`.
- **Ancres d'onglet** : elles ne doivent correspondre à aucun `id` de champ,
  sinon le navigateur fait défiler la page à l'ouverture du lien.
- **Zone climatique** : elle est celle du repère le plus proche dans
  `sites.js`, et non un découpage géographique séparé. Une heuristique lat/lon
  avait été écrite en parallèle du tableau : les deux divergeaient sur six
  villes. Une seule source de vérité, le tableau.
- Les paramètres du modèle de ciel (`TUNING` dans `solar.js`) sont dégénérés :
  les optimiser tous les trois ensemble les envoie aux bornes du domaine sans
  gain réel. Les valeurs actuelles sont un compromis assumé.

## Structure d'une vue

Chaque onglet se découpe en trois blocs, enfants directs de la `section` :
`.apercu` (schéma + verdict, précédés du choix de période dans la vue
Inclinaison), `.details` (courbe ou tableau de chiffres) et `.reglages` (les
champs). L'aperçu doit rester enfant direct de la section : sur téléphone il
est `sticky`, et un `sticky` cesse de suivre dès que son parent sort de
l'écran — l'envelopper avec les seuls résultats le décrocherait au moment
précis où l'on atteint les curseurs.

Les curseurs ne répondent qu'à une prise sur leur poignée (`curseur.js`) :
sur un chantier, un appui sur la piste pendant un défilement modifiait un
réglage sans qu'on le voie. **`preventDefault()` sur `pointerdown` ne suffit
pas** — les navigateurs déplacent la poignée dans leur code natif, hors de
portée de l'événement. Le mécanisme laisse donc le déplacement se produire
puis restaure la valeur, via un écouteur `input` posé sur le `document` en
phase de capture, qui passe avant tout écouteur de l'application.

L'orientation et l'inclinaison sont **une seule valeur** partagée par les
deux onglets, pas une copie propagée : elles décrivent le même chantier. Un
même réglage est donc porté par plusieurs curseurs, que `rendre()` recale
tous à chaque rendu ; leurs bornes `min` et `max` doivent rester identiques,
sinon passer d'un onglet à l'autre tronquerait la valeur.

Les champs sont numérotés dans l'ordre de réglage réel sur le terrain :
l'orientation est une contrainte subie, elle vient toujours avant
l'inclinaison, qui est ce que l'on choisit.

## Invite d'installation

`installer.js` propose un bouton là où le navigateur émet
`beforeinstallprompt`, et décrit la manœuvre sur iOS, qui n'a pas d'API :
seul Safari installe vraiment, les autres navigateurs iOS n'ont pas accès au
moteur. Deux pièges de détection, couverts par les tests : iPadOS 13 et
suivants envoient une signature de Mac — seul `maxTouchPoints` les en
distingue — et tous les navigateurs iOS portent « Safari » dans la leur.

Le bloc reste caché tant qu'aucune installation n'est possible : mieux vaut
ne rien afficher que promettre ce que le navigateur ne fera pas.

## Mise à jour d'une application installée

Une application lancée depuis l'écran d'accueil n'est jamais rechargée : elle
est mise en veille puis reprise, et le tirer-pour-rafraîchir n'existe pas en
mode autonome. Un service worker « cache d'abord » sert alors indéfiniment la
version qu'il a mise de côté — c'est le symptôme qui a été signalé.

Deux pièces y répondent : `sw.js` sert le cache puis le rafraîchit derrière,
et `maj.js` appelle `update()` au démarrage, à chaque retour au premier plan
et au retour du réseau, puis recharge la page quand le nouveau service worker
prend la main. Le rechargement est sans risque, les réglages étant enregistrés
à chaque modification. Attention au premier lancement : il n'y a alors aucun
contrôleur, et la prise de contrôle initiale ne doit pas déclencher de
rechargement.

`tests/navigateur/mise-a-jour.sh` rejoue le scénario complet. Il a été vérifié
qu'il échoue bien avec l'ancien service worker.

## Essais en navigateur

`tests/navigateur/lancer.sh` exécute `tests/navigateur/curseur.html` dans
Chrome et lit son verdict via `--dump-dom`. Ces essais portent sur l'ordre
des écouteurs et la propagation des événements, que node ne reproduit pas.
Ils ne sont pas dans `npm test`, qui reste sans dépendance au navigateur.

## Vérification visuelle

L'extension Chrome n'était pas connectée ; les captures se font en headless :

```sh
python3 -m http.server 8931 -d docs &
google-chrome --headless=new --disable-gpu --hide-scrollbars \
  --virtual-time-budget=4000 --window-size=390,1150 \
  --screenshot=/tmp/vue.png "http://127.0.0.1:8931/#rangees"
```

Les ancres `#inclinaison` et `#rangees` ouvrent directement un onglet, ce
qui permet de capturer chaque vue sans clic.

## Ce qui a été retiré

L'onglet « Terrain » — calepinage sur profondeur contrainte : `fieldSweep`,
`rowSteps`, `rowCount`, `fieldYield`, paliers de rangées et estimation en
MWc/ha — a été retiré à la demande de l'utilisateur, avec son moteur, ses
tests et ses styles plutôt que laissé sans emploi. Le tout reste récupérable
au commit `1349813`.
