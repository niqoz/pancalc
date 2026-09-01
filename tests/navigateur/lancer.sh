#!/bin/sh
# Exécute les essais de tests/navigateur/ dans Chrome et affiche leur verdict.
# Un navigateur est nécessaire : ces essais portent sur la propagation des
# événements et l'ordre des écouteurs, que node ne reproduit pas.
set -e
racine=$(cd "$(dirname "$0")/../.." && pwd)
port=${PORT:-8942}
python3 -m http.server "$port" --directory "$racine" >/dev/null 2>&1 &
serveur=$!
trap 'kill $serveur 2>/dev/null' EXIT
sleep 1
google-chrome --headless=new --disable-gpu --virtual-time-budget=4000 \
  --dump-dom "http://127.0.0.1:$port/tests/navigateur/curseur.html" 2>/dev/null \
| python3 -c '
import html, re, sys
dom = sys.stdin.read()
m = re.search(r"<pre id=\"resultat\">(.*?)</pre>", dom, re.S)
if not m:
    print("aucun verdict : le script de la page ne s\x27est pas exécuté")
    sys.exit(1)
verdict = html.unescape(m.group(1)).strip()
print(verdict)
sys.exit(1 if ("ECHEC" in verdict or "réussis" not in verdict) else 0)
'
