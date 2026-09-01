from PIL import Image, ImageDraw

# Palette « Terrasse », la même que SolarDim (cf. docs/style.css).
PAPIER = (250, 246, 239)
TERRACOTTA = (192, 88, 56)
ESTOMPE = (138, 122, 101)
SOLEIL = (233, 163, 44)
ARDOISE = (90, 143, 176)

def quadratique(p0, controle, p1, etapes=80):
    points = []
    for i in range(etapes + 1):
        t = i / etapes
        u = 1 - t
        points.append((
            u * u * p0[0] + 2 * u * t * controle[0] + t * t * p1[0],
            u * u * p0[1] + 2 * u * t * controle[1] + t * t * p1[1],
        ))
    return points

def icone(taille):
    S = taille * 4  # rendu 4x puis réduction, pour lisser les obliques
    im = Image.new("RGB", (S, S), PAPIER)
    d = ImageDraw.Draw(im)
    u = S / 100.0

    def px(points):
        return [(x * u, y * u) for x, y in points]

    # Arc théorique puis course solaire, invariants du logo SolarDim.
    d.arc((16 * u, 24 * u, 84 * u, 92 * u), 180, 360,
          fill=ESTOMPE, width=max(1, int(2.4 * u)))
    course = quadratique((22, 67), (50, 16), (78, 67))
    d.line(px(course), fill=TERRACOTTA, width=max(1, int(5.2 * u)), joint="curve")

    # L'horizon devient un panneau segmenté : le signe distinctif du satellite.
    panneau = [(17, 69), (81, 60), (83, 70), (19, 79)]
    d.polygon(px(panneau), fill=ARDOISE)
    for x in (33, 49, 65):
        d.line(px([(x, 66.8 - (x - 17) * 9 / 64),
                   (x + 1.4, 76.8 - (x - 17) * 9 / 64)]),
               fill=PAPIER, width=max(1, int(1.7 * u)))

    # Soleil matinal sur la courbe, cerné de papier comme l'icône mère.
    t = 0.33
    x = (1 - t) ** 2 * 22 + 2 * (1 - t) * t * 50 + t ** 2 * 78
    y = (1 - t) ** 2 * 67 + 2 * (1 - t) * t * 16 + t ** 2 * 67
    r, bord = 7.2, 1.8
    d.ellipse(((x - r - bord) * u, (y - r - bord) * u,
               (x + r + bord) * u, (y + r + bord) * u), fill=PAPIER)
    d.ellipse(((x - r) * u, (y - r) * u, (x + r) * u, (y + r) * u), fill=SOLEIL)

    return im.resize((taille, taille), Image.LANCZOS)

for t in (192, 512):
    icone(t).save(f"/home/niqo/Projets/pancalc/docs/icon-{t}.png", optimize=True)
print("icones generees")
