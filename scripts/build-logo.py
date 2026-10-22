"""Generate the Elevated Digital Marketing logo set as clean vector SVGs.

Recreates the original artwork: a split circle (green crescent on the left, a
gray right half whose two bars leave a right-pointing arrow in the negative
space) next to a chunky ELEVATED / DIGITAL MARKETING wordmark, all with the
original's raised 3D look (extruded down and to the left).

Text is converted to outlines (Rubik, SIL OFL, in scripts/fonts/) so the SVGs
render identically everywhere without the font installed.

Usage: python3 scripts/build-logo.py      (requires: pip install fonttools)
"""
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

HERE = Path(__file__).resolve().parent
TITLE_FONT = HERE / "fonts" / "rubik-latin-900-normal.woff"
SUB_FONT = HERE / "fonts" / "rubik-latin-800-normal.woff"
OUT = HERE.parent / "public" / "brand"

# Face gradient (top, bottom) and extrusion side color for each part.
GREEN = ("#BCE84A", "#9ACD2C", "#6F9A18")
GRAY = ("#66707C", "#4E5761", "#25292E")
INK = ("#4A5059", "#30353B", "#121417")
WHITE = ("#FFFFFF", "#E9EDF1", "#9AA4AE")

# Extrusion vector (down-left, like the original) and number of layers.
DEPTH = (-5.0, 4.0)
LAYERS = 10

GREEN_D = "M62 32A103 103 0 0 0 62 204Z"
GRAY_D = (
    "M82 47H157L134 22A100 100 0 0 1 143 215L157 173H84V133H177L206 110L177 87H82Z"
)


def text_path(font_file, text, size, x, y, tracking=0.0):
    """Return (svg path data, advance width) for text set at baseline (x, y)."""
    font = TTFont(font_file)
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    scale = size / font["head"].unitsPerEm
    pen = SVGPathPen(glyphs)
    cursor = 0.0
    for ch in text:
        glyph = glyphs[cmap[ord(ch)]]
        glyph.draw(TransformPen(pen, (scale, 0, 0, -scale, x + cursor, y)))
        cursor += glyph.width * scale + tracking
    return pen.getCommands(), cursor - tracking


def gradient(gid, colors):
    top, bottom, _ = colors
    return (
        f'<linearGradient id="{gid}" x1="0" y1="0" x2="0" y2="1">'
        f'<stop offset="0" stop-color="{top}"/><stop offset="1" stop-color="{bottom}"/></linearGradient>'
    )


def raised(d, gid, colors, depth=DEPTH, flat=False):
    """A shape with a solid extruded side and a gradient face."""
    if flat:
        return f'<path fill="{colors[0]}" d="{d}"/>'
    side = "".join(
        f'<use href="#{gid}-s" x="{depth[0] * i / LAYERS:.2f}" y="{depth[1] * i / LAYERS:.2f}"/>'
        for i in range(LAYERS, 0, -1)
    )
    return (
        f'<path id="{gid}-s" fill="{colors[2]}" d="{d}"/>{side}'
        f'<path fill="url(#{gid})" d="{d}"/>'
    )


def svg(width, height, body, defs="", title="Elevated Digital Marketing"):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 0 {width + 8:.0f} {height:.0f}" '
        f'width="{width + 8:.0f}" height="{height:.0f}" role="img" aria-label="{title}">'
        f"<title>{title}</title><defs>{defs}</defs>{body}</svg>\n"
    )


def main():
    OUT.mkdir(parents=True, exist_ok=True)

    title_d, title_w = text_path(TITLE_FONT, "ELEVATED", 78, 250, 140, tracking=3)
    sub_size = 38
    _, raw_w = text_path(SUB_FONT, "DIGITAL MARKETING", sub_size, 0, 0)
    tracking = (title_w - raw_w) / (len("DIGITAL MARKETING") - 1)
    sub_d, _ = text_path(SUB_FONT, "DIGITAL MARKETING", sub_size, 252, 196, tracking=tracking)
    width = 250 + title_w + 12
    height = 240

    def lockup(word, sub, mark_gray, flat=False):
        defs = "".join(
            gradient(gid, c)
            for gid, c in [("g-green", GREEN), ("g-gray", mark_gray), ("g-word", word), ("g-sub", sub)]
        )
        body = (
            raised(GREEN_D, "g-green", GREEN, flat=flat)
            + raised(GRAY_D, "g-gray", mark_gray, flat=flat)
            + raised(title_d, "g-word", word, flat=flat)
            + raised(sub_d, "g-sub", sub, depth=(-3.0, 2.5), flat=flat)
        )
        return defs, body

    defs, body = lockup(GRAY, INK, GRAY)
    (OUT / "logo.svg").write_text(svg(width, height, body, defs))

    defs, body = lockup(WHITE, WHITE, WHITE)
    (OUT / "logo-white.svg").write_text(svg(width, height, body, defs))

    mark_defs = gradient("g-green", GREEN) + gradient("g-gray", GRAY)
    mark = raised(GREEN_D, "g-green", GREEN) + raised(GRAY_D, "g-gray", GRAY)
    (OUT / "logo-mark.svg").write_text(svg(232, 240, mark, mark_defs))

    mono = raised(GREEN_D, "m", WHITE, flat=True) + raised(GRAY_D, "m", WHITE, flat=True)
    (OUT / "logo-mark-mono.svg").write_text(svg(232, 240, mono))
    print(f"wrote logo set to {OUT} (lockup width {width:.0f})")


if __name__ == "__main__":
    main()
