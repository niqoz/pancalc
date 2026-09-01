from PIL import Image, ImageDraw
import math

# Palette « Terrasse », la même que SolarDim (cf. docs/style.css).
ENCRE, PAPIER, TERRACOTTA, ESTOMPE = (28, 20, 16), (250, 246, 239), (192, 88, 56), (138, 122, 101)

def icone(taille, marge_ratio=0.0):
    S = taille * 4  # rendu 4x puis reduction, pour lisser les obliques
    im = Image.new("RGB", (S, S), ENCRE)
    d = ImageDraw.Draw(im)
    u = S / 100.0
    sol_y = 68 * u

    # Le sol, et sous lui la trame du terrain.
    d.line([(14 * u, sol_y), (86 * u, sol_y)], fill=PAPIER, width=int(2.6 * u))
    for x in range(16, 88, 7):
        d.line([(x * u, sol_y + 2 * u), ((x - 6) * u, sol_y + 8 * u)], fill=ESTOMPE, width=int(1.4 * u))

    # Deux rangees inclinees a 35 degres, ecartees de leur juste pas : c'est
    # cet ecartement que l'application calcule.
    a = math.radians(35)
    L, x1, x2 = 30, 14, 52
    run, rise = L * math.cos(a), L * math.sin(a)
    for x0, coul in ((x1, ESTOMPE), (x2, PAPIER)):
        d.line([(x0 * u, sol_y), ((x0 + run) * u, sol_y - rise * u)], fill=coul, width=int(6.5 * u))

    # Le rayon rasant : il effleure le haut d'une rangee et vient mourir au
    # pied de la suivante. Prolonge vers l'amont pour se lire comme un rayon.
    hx, hy = x1 + run, 68 - rise
    dx, dy = x2 - hx, 68 - hy
    k = 0.85
    d.line([((hx - dx * k) * u, (hy - dy * k) * u), (x2 * u, sol_y)],
           fill=TERRACOTTA, width=int(3.2 * u))

    return im.resize((taille, taille), Image.LANCZOS)

for t in (192, 512):
    icone(t).save(f"/home/niqo/Projets/pancalc/docs/icon-{t}.png", optimize=True)
print("icones generees")
