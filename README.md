# SolarDim — Panel Optimizer

Application satellite de SolarDim pour l'inclinaison et la distance entre
rangées sur le chantier photovoltaïque.
Application web installable, **entièrement hors connexion** : aucun appel
réseau n'est fait pendant le calcul.

## Ce que l'application répond

**Inclinaison** — l'inclinaison optimale pour un site et une orientation
donnés, et surtout la perte pour toute inclinaison imposée. Sur un toit
existant on ne choisit pas la pente, on vérifie qu'elle reste acceptable :
c'est la plage à moins de 5 % de perte qui sert, plus que l'optimum lui-même.
L'optimum se calcule sur l'année entière, sur l'hiver ou sur l'été.

**Rangées** — l'écartement entre rangées et le pas correspondant, à partir de
l'orientation du champ, de la longueur du panneau dans la pente, de
l'inclinaison des tables et d'un critère d'ombrage. Le critère est le
paramètre le plus lourd du calcul : « 21 décembre à midi » et « 21 décembre
de 9 h à 15 h » donnent des écartements du simple au double.

L'orientation et l'inclinaison sont communes aux deux onglets : elles
décrivent un seul chantier. On règle l'inclinaison là où elle se lit le
mieux, l'écartement des rangées suit, et la perte annuelle correspondante
reste visible dans l'onglet Inclinaison.

## Modèle de calcul

La géométrie — position du soleil, ombres portées, écartement des rangées —
est exacte. Le modèle d'irradiation, lui, est approché, et volontairement
simple :

1. cinq formes de ciel, décrites par douze indices de clarté mensuels calés
   sur les irradiations PVGIS ;
2. chaque mois décomposé en journées types — claire (modèle de ciel clair de
   Hottel), voilée, couverte — pondérées pour redonner exactement
   l'irradiation horizontale de la zone ;
3. décomposition direct/diffus par la corrélation journalière d'Erbs, puis
   transposition isotrope sur le plan incliné.

**Accord avec PVGIS** (six villes françaises, vérifié par les tests) :
irradiation horizontale à 4 % près, inclinaison optimale à 3° près, gain
apporté par l'inclinaison optimale à 2 % près.

**Couverture.** Quatre-vingt-dix repères dans les douze pays d'Europe de
l'Ouest où SolarDim se distribue. Les cinq formes de ciel calées sur la France
y suffisent : mesuré sur soixante-deux villes contre leurs propres indices
PVGIS, l'écart sur ce que l'application affiche — optimum annuel, d'hiver,
d'été, perte d'orientation, perte de plat — reste sous 3° et 2 points. La zone
porte la **forme** du ciel, la latitude fait le reste ; le niveau absolu, lui,
s'écarte jusqu'à 7 % du site réel, ce qui n'apparaît nulle part puisque aucune
irradiation n'est affichée.

**Limites.** Ce modèle donne des inclinaisons et des pertes relatives, pas un
productible. Il ignore le masque d'horizon, la neige, la température des
modules, les pertes onduleur et l'ombrage résiduel hors du critère retenu. Le
ciel clair est celui d'une atmosphère de plaine : au-dessus de mille mètres —
Alpes, Pyrénées, sierras — il sous-estime le rayonnement direct. Au nord de
55°, le critère d'ombrage du 21 décembre de 9 h à 15 h prend le soleil à un
degré de hauteur et rend des écartements sans usage : c'est exact, mais c'est
le critère qu'il faut alors changer.
Pour un chiffrage de production, repasser par PVGIS.

## Reprise dans SolarDim

Le bouton du pied de page écrit un « transfer v2 », le format d'échange des
clients Android et Windows : le site, l'inclinaison et l'orientation s'y
rouvrent tels quels. Sur téléphone il passe par le partage du système, ailleurs
il enregistre un fichier, qui s'importe depuis l'accueil de SolarDim. La source
de vérité du format est `Transfer.kt` côté SolarDim ; `tests/transfert.test.mjs`
fige ce que l'autre côté attend, faute de quoi un écart ne se verrait qu'à
l'import, sur une étude ouverte sans ses réglages.

## Développement

```sh
npm test                          # 52 tests, sans dépendance
./tests/navigateur/lancer.sh      # essais nécessitant un vrai navigateur
./tests/navigateur/mise-a-jour.sh # une app installée reçoit-elle les mises à jour
node tools/kt-pvgis.mjs villes.json  # refait les indices de clarté depuis PVGIS
python3 -m http.server -d docs    # les modules ES exigent http://, pas file://
```

L'identité — emblème solaire et panneau, palette « Terrasse », Fraunces en
titres, DM Sans en corps — prolonge celle de SolarDim. Les
variables de `:root` dans `style.css` sont celles de `solardim-site`, mode
sombre compris.

`docs/` contient l'application livrée : `solar.js` (position du soleil et
irradiation), `layout.js` (géométrie des rangées), `draw.js` (schémas SVG),
`sites.js` (repères géographiques), `curseur.js` (prise des curseurs au
doigt), `installer.js` (invite d'installation), `app.js` (assemblage). Les tests couvrent la physique, la géométrie
et les calculs de l'interface, pas son rendu.

Une application installée se met à jour d'elle-même : le service worker sert
son cache puis le rafraîchit derrière, et la page réinterroge le serveur au
démarrage et à chaque retour au premier plan. La version suivante s'applique
donc à l'ouverture d'après. Incrémenter `CACHE` dans `docs/sw.js` reste utile
pour évincer d'un coup des fichiers retirés, mais n'est plus nécessaire à la
diffusion.

`outils-icones.py` régénère les deux icônes ; il n'est pas nécessaire au
fonctionnement.

## Licence

Les polices Fraunces et DM Sans (`docs/vendor/fonts/`) sont sous licence SIL
Open Font License 1.1, voir les fichiers `OFL.txt` du même dossier.
