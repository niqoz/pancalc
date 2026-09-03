#!/usr/bin/env python3
"""Génère la bannière vectorielle Panel Optimizer retenue (proposition 06)."""

from pathlib import Path
from xml.sax.saxutils import escape

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont


RACINE = Path(__file__).resolve().parents[1]
SORTIE = RACINE / "docs" / "panel-optimizer-logo.svg"


def police_variable(nom, axes):
    police = TTFont(RACINE / "docs" / "vendor" / "fonts" / nom)
    return instantiateVariableFont(police, axes, inplace=True)


def texte_en_traces(texte, police, taille, x, ligne, couleur, approche=0):
    unites = police["head"].unitsPerEm
    facteur = taille / unites
    caracteres = police.getBestCmap()
    glyphes = police.getGlyphSet()
    metriques = police["hmtx"].metrics
    position = x
    traces = []

    for caractere in texte:
        glyphe_nom = caracteres[ord(caractere)]
        if caractere != " ":
            plume = SVGPathPen(glyphes)
            glyphes[glyphe_nom].draw(plume)
            chemin = plume.getCommands()
            traces.append(
                f'<path d="{escape(chemin)}" '
                f'transform="translate({position:.2f} {ligne:.2f}) '
                f'scale({facteur:.6f} {-facteur:.6f})"/>'
            )
        position += metriques[glyphe_nom][0] * facteur + approche

    groupe = f'<g fill="{couleur}">' + "".join(traces) + "</g>"
    return groupe, position - x - approche


def main():
    fraunces = police_variable(
        "fraunces.woff2",
        {"opsz": 72, "wght": 600, "SOFT": 20, "WONK": 1},
    )
    dm_gras = police_variable("dm_sans.woff2", {"opsz": 40, "wght": 760})
    dm_normal = police_variable("dm_sans.woff2", {"opsz": 24, "wght": 430})
    dm_signature = police_variable("dm_sans.woff2", {"opsz": 24, "wght": 680})

    panel, _ = texte_en_traces("Panel", fraunces, 93, 270, 103, "#17120E", -1.5)
    optimizer, largeur_optimizer = texte_en_traces(
        "Optimizer", dm_gras, 73, 270, 179, "#17120E", -2.1
    )

    by, largeur_by = texte_en_traces("by", dm_normal, 25, 0, 222, "#8A7A65", 0)
    solar_dim, largeur_signature = texte_en_traces(
        "SolarDim", dm_signature, 25, 0, 222, "#8A7A65", -0.3
    )
    largeur_totale = largeur_by + 7 + largeur_signature
    debut_signature = 270 + largeur_optimizer - largeur_totale
    by, _ = texte_en_traces(
        "by", dm_normal, 25, debut_signature, 222, "#8A7A65", 0
    )
    solar_dim, _ = texte_en_traces(
        "SolarDim",
        dm_signature,
        25,
        debut_signature + largeur_by + 7,
        222,
        "#8A7A65",
        -0.3,
    )

    svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 604 245" role="img" aria-labelledby="titre description">
  <title id="titre">Panel Optimizer, par SolarDim</title>
  <desc id="description">Le soleil suit sa course au-dessus d'un panneau photovoltaïque, à gauche du nom Panel Optimizer et de la signature by SolarDim.</desc>
  <defs>
    <mask id="decoupes-panneau" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="46">
      <rect width="64" height="46" fill="white"/>
      <path d="m20.4 38.2 1 6.5m10.4-8 1 6.5m10.4-8 1 6.5" fill="none" stroke="black" stroke-width="1.25"/>
    </mask>
  </defs>

  <g transform="translate(11 27) scale(3.72)">
    <path d="M10 40a22 22 0 0 1 44 0" fill="none" stroke="#A5927B" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M12 40Q32 4 52 40" fill="none" stroke="#C05838" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M8.5 39.7 55.2 33.6 56.2 40.1 9.5 46.2Z" fill="#5A8FB0" mask="url(#decoupes-panneau)"/>
    <circle cx="25.2" cy="24.1" r="4.8" fill="#E9A32C" stroke="#FAF6EF" stroke-width="1.6"/>
  </g>

  {panel}
  {optimizer}
  {by}
  {solar_dim}
</svg>
'''
    SORTIE.write_text(svg, encoding="utf-8")


if __name__ == "__main__":
    main()
