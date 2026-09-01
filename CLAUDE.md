# pancalc — notes pour les sessions suivantes

Application web hors connexion de calcul d'inclinaison et de calepinage
photovoltaïque. Voir `README.md` pour le modèle et ses limites.

## Conventions

- Pas de dépendance, pas de build. Modules ES chargés directement par le
  navigateur ; les tests tournent sous `node --test` sur les mêmes fichiers.
- Tout ce qui est livré vit dans `docs/` (GitHub Pages sert ce dossier). Les
  tiers sont versionnés dans `docs/vendor/`, jamais récupérés au build.
- Commentaires et libellés en français accentué. Les identifiants de code
  restent sans accents (`etat`, `critere`, `rangees`) : ne pas les « corriger ».
- Après toute modification de `docs/`, incrémenter `CACHE` dans `docs/sw.js`.
  Un test vérifie que la liste `ASSETS` couvre bien tous les fichiers livrés.

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
`.apercu` (schéma + verdict), `.details` (courbe, tableau ou paliers) et
`.reglages` (les champs). L'aperçu doit rester enfant direct de la section :
sur téléphone il est `sticky`, et un `sticky` cesse de suivre dès que son
parent sort de l'écran — l'envelopper avec les seuls résultats le décrocherait
au moment précis où l'on atteint les curseurs.

Les curseurs ne répondent qu'à une prise sur leur poignée, et seulement au
doigt (`curseur.js`) : sur un chantier, un appui sur la piste pendant un
défilement modifiait un réglage sans qu'on le voie. À la souris, le clic sur
la piste reste actif.

## Vérification visuelle

L'extension Chrome n'était pas connectée ; les captures se font en headless :

```sh
python3 -m http.server 8931 -d docs &
google-chrome --headless=new --disable-gpu --hide-scrollbars \
  --virtual-time-budget=4000 --window-size=390,1150 \
  --screenshot=/tmp/vue.png "http://127.0.0.1:8931/#terrain"
```

Les ancres `#inclinaison`, `#rangees` et `#terrain` ouvrent directement un
onglet, ce qui permet de capturer chaque vue sans clic.
