"""Generate the Elevated Digital Marketing logo set as clean vector SVGs.

Text is converted to outlines (Inter, SIL OFL) so the SVGs render identically
everywhere without needing the font installed.

Usage: python3 scripts/build-logo.py [path/to/Inter-Black.otf] [path/to/Inter-Bold.otf]
Requires: pip install fonttools
"""
import sys
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

FONT_DIR = Path("/usr/share/fonts/opentype/inter")
BLACK = Path(sys.argv[1]) if len(sys.argv) > 1 else FONT_DIR / "Inter-Black.otf"
BOLD = Path(sys.argv[2]) if len(sys.argv) > 2 else FONT_DIR / "Inter-ExtraBold.otf"
OUT = Path(__file__).resolve().parent.parent / "public" / "brand"

GREEN = "#A8D932"
GREEN_DARK = "#86B51F"
GRAY = "#545E6A"
GRAY_DARK = "#3B434D"


def text_path(font_file, text, size, x, y, tracking=0.0):
    """Return (svg path data, advance width) for text set at baseline (x, y)."""
    font = TTFont(font_file)
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    scale = size / font["head"].unitsPerEm
    pen = SVGPathPen(glyphs)
    cursor = 0.0
    for ch in text:
        name = cmap[ord(ch)]
        glyph = glyphs[name]
        tp = TransformPen(pen, (scale, 0, 0, -scale, x + cursor, y))
        glyph.draw(tp)
        cursor += glyph.width * scale + tracking
    return pen.getCommands(), cursor - tracking


# Mark: a circle split into a green crescent (left) and a gray "E" whose
# middle stroke is a right-pointing arrow. 200x200 coordinate space.
MARK = f"""
  <defs>
    <linearGradient id="g-green" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{GREEN}"/><stop offset="1" stop-color="{GREEN_DARK}"/>
    </linearGradient>
    <linearGradient id="g-gray" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{GRAY}"/><stop offset="1" stop-color="{GRAY_DARK}"/>
    </linearGradient>
  </defs>
  <path fill="url(#g-green)" d="M48 26.5A90 90 0 0 0 48 173.5Z"/>
  <path fill="url(#g-gray)" d="M62 22H112V6L190 100A90 90 0 0 1 62 181.6V118H128L141 100L128 84H62Z"/>
"""

MARK_MONO = """
  <path fill="{c}" d="M48 26.5A90 90 0 0 0 48 173.5Z"/>
  <path fill="{c}" d="M62 22H112V6L190 100A90 90 0 0 1 62 181.6V118H128L141 100L128 84H62Z"/>
"""


def svg(width, height, body, title="Elevated Digital Marketing"):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:.0f} {height:.0f}" '
        f'width="{width:.0f}" height="{height:.0f}" role="img" aria-label="{title}">'
        f"<title>{title}</title>{body}</svg>\n"
    )


def main():
    OUT.mkdir(parents=True, exist_ok=True)

    # Horizontal lockup: mark at left, wordmark to the right.
    title_d, title_w = text_path(BLACK, "ELEVATED", 112, 230, 112, tracking=2)
    sub_size = 44
    # Spread the subline so it spans the same width as ELEVATED.
    _, raw_w = text_path(BOLD, "DIGITAL MARKETING", sub_size, 0, 0)
    tracking = (title_w - raw_w) / (len("DIGITAL MARKETING") - 1)
    sub_d, _ = text_path(BOLD, "DIGITAL MARKETING", sub_size, 232, 178, tracking=tracking)
    width = 230 + title_w + 10

    def lockup(word_fill, sub_fill, mark):
        return (
            mark
            + f'<path fill="{word_fill}" d="{title_d}"/>'
            + f'<path fill="{sub_fill}" d="{sub_d}"/>'
        )

    (OUT / "logo.svg").write_text(svg(width, 200, lockup("url(#g-gray)", GRAY, MARK)))
    (OUT / "logo-white.svg").write_text(
        svg(width, 200, lockup("#FFFFFF", "#E6EAEE", MARK.replace("url(#g-gray)", "#FFFFFF")))
    )
    (OUT / "logo-mark.svg").write_text(svg(200, 200, MARK))
    (OUT / "logo-mark-mono.svg").write_text(svg(200, 200, MARK_MONO.format(c="#FFFFFF")))
    print(f"wrote logo set to {OUT} (lockup width {width:.0f})")


if __name__ == "__main__":
    main()
