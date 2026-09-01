# pancalc

Inclinaison et distance entre rangées, pour le chantier photovoltaïque.
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

1. cinq zones climatiques françaises, décrites par douze indices de clarté
   mensuels calés sur les irradiations PVGIS ;
2. chaque mois décomposé en journées types — claire (modèle de ciel clair de
   Hottel), voilée, couverte — pondérées pour redonner exactement
   l'irradiation horizontale de la zone ;
3. décomposition direct/diffus par la corrélation journalière d'Erbs, puis
   transposition isotrope sur le plan incliné.

**Accord avec PVGIS** (six villes, vérifié par les tests) : irradiation
horizontale à 4 % près, inclinaison optimale à 3° près, gain apporté par
l'inclinaison optimale à 2 % près.

**Limites.** Ce modèle donne des inclinaisons et des pertes relatives, pas un
productible. Il ignore le masque d'horizon, la neige, la température des
modules, les pertes onduleur et l'ombrage résiduel hors du critère retenu.
Pour un chiffrage de production, repasser par PVGIS.

## Développement

```sh
npm test                          # 38 tests, sans dépendance
./tests/navigateur/lancer.sh      # essais nécessitant un vrai navigateur
python3 -m http.server -d docs    # les modules ES exigent http://, pas file://
```

L'habillage — palette « Terrasse », Fraunces en titres, DM Sans en corps —
est repris de SolarDim, pour que les deux applications se reconnaissent. Les
variables de `:root` dans `style.css` sont celles de `solardim-site`, mode
sombre compris.

`docs/` contient l'application livrée : `solar.js` (position du soleil et
irradiation), `layout.js` (géométrie des rangées), `draw.js` (schémas SVG),
`sites.js` (repères géographiques), `curseur.js` (prise des curseurs au
doigt), `app.js` (assemblage). Les tests couvrent la physique, la géométrie
et les calculs de l'interface, pas son rendu.

Après toute modification de `docs/`, incrémenter `CACHE` dans `docs/sw.js`,
sinon les appareils déjà équipés gardent l'ancienne version.

`outils-icones.py` régénère les deux icônes ; il n'est pas nécessaire au
fonctionnement.

## Licence

Les polices Fraunces et DM Sans (`docs/vendor/fonts/`) sont sous licence SIL
Open Font License 1.1, voir les fichiers `OFL.txt` du même dossier.
