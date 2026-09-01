#!/bin/sh
# Vérifie qu'une application déjà installée reçoit bien les mises à jour.
#
# Une application lancée depuis l'écran d'accueil n'est jamais rechargée : sans
# demande explicite, un service worker « cache d'abord » sert indéfiniment la
# version qu'il a mise de côté. Ce scénario reproduit le cas : on installe, on
# publie une modification, puis on rouvre.
#
# Chrome doit tourner pour de vrai : ni --dump-dom ni --screenshot ne laissent
# aux promesses du service worker le temps d'aboutir, ils ferment avant.
set -e
racine=$(cd "$(dirname "$0")/../.." && pwd)
port=${PORT:-8957}
travail=$(mktemp -d)
trap 'kill $serveur 2>/dev/null; rm -rf "$travail"' EXIT

cp -r "$racine/docs" "$travail/site"
sed -i 's|<p>Modèle de ciel|<p>TEMOIN-AVANT Modèle de ciel|' "$travail/site/index.html"
cat > "$travail/site/_etat.html" <<'PAGE'
<!doctype html><meta charset="utf-8"><title>etat</title>
<script type="module">
import { initMiseAJour } from "./maj.js";
initMiseAJour();
(async () => {
  await navigator.serviceWorker.ready;
  const html = await (await fetch("./index.html")).text();
  const vu = (html.match(/TEMOIN-[A-Z]+/) || ["rien"])[0];
  await fetch(`/rapport?vu=${vu}&t=${Date.now()}`);
})();
</script>
PAGE

python3 -m http.server "$port" --directory "$travail/site" > "$travail/journal" 2>&1 &
serveur=$!
sleep 1

lancer() {
  google-chrome --headless=new --disable-gpu --no-first-run \
    --user-data-dir="$travail/profil" "http://127.0.0.1:$port/_etat.html" >/dev/null 2>&1 &
  navigateur=$!
  sleep 6
  kill $navigateur 2>/dev/null || true
  wait $navigateur 2>/dev/null || true
  sleep 1
  grep -o 'vu=TEMOIN-[A-Z]*' "$travail/journal" | tail -1 | cut -d= -f2
}

lancer > /dev/null                 # installation du service worker
installe=$(lancer)                 # il contrôle la page et sert son cache
sed -i 's|TEMOIN-AVANT|TEMOIN-APRES|' "$travail/site/index.html"
lancer > /dev/null                 # première ouverture après publication
recu=$(lancer)                     # la nouvelle version doit être là

printf 'version servie une fois installée : %s\n' "$installe"
printf 'version servie après publication  : %s\n' "$recu"
if [ "$installe" = "TEMOIN-AVANT" ] && [ "$recu" = "TEMOIN-APRES" ]; then
  echo "OK    la mise à jour parvient à l'application installée"
  exit 0
fi
echo "ECHEC la mise à jour ne parvient pas à l'application installée"
exit 1
