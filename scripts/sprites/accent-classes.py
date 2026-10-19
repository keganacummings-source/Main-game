"""
Colour-accent touch-up for class sprites that read too alike on public/sprites/class_warriors.png.
Only one colour band per class is shifted; layout, outlines, skin and the magenta chroma key stay as they are.
Applied once to the sheet; to redo, run it on the pre-accent sheet from git history:

    python3 scripts/sprites/accent-classes.py <sheet before accents> public/sprites/class_warriors.png
"""
import colorsys
import sys
from PIL import Image

MAGENTA = (255, 0, 255)
# class: (block x, y, band, action)
#   band "white" = low-saturation light cloth; otherwise (hue_lo, hue_hi) in degrees.
#   action: (target hue degrees, saturation set/mult, value mult)
PLAN = {
    "absolver":   ((512, 352), "white",      ("tint", 160, 0.10, 1.0)),   # healer mint on the white robes
    "oathkeeper": ((0, 704),   (30, 62),     ("shift", 212, 0.38, 1.02)), # gold plate -> paladin steel and silver
    "cryinggirl": ((0, 880), (215, 262), ("shift", 196, 1.2, 1.25)),  # navy -> tear teal
}


def skin(h, s, v):
    return 0.02 <= h <= 0.12 and 0.18 <= s <= 0.62 and v >= 0.55


def main(src, out):
    im = Image.open(src).convert("RGBA")
    px = im.load()
    for name, ((bx, by), band, (mode, hue, sat, val)) in PLAN.items():
        for y in range(by, by + 176):
            for x in range(bx, bx + 128):
                r, g, b, a = px[x, y]
                if a == 0 or (r, g, b) == MAGENTA:
                    continue
                h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
                if band == "white":
                    if not (s < 0.2 and v > 0.72):
                        continue
                    nh, ns, nv = hue / 360, max(s, sat), v * val
                else:
                    deg = h * 360
                    if not (band[0] <= deg <= band[1]) or s < 0.18 or v < 0.12 or skin(h, s, v):
                        continue
                    nh, ns, nv = ((hue + (deg - (band[0] + band[1]) / 2) * 0.5) % 360) / 360, min(1, s * sat), min(1, v * val)
                R, G, B = [int(round(c * 255)) for c in colorsys.hsv_to_rgb(nh, ns, nv)]
                if abs(R - 255) < 40 and G < 40 and abs(B - 255) < 40:
                    G = 60  # never land on the chroma key
                px[x, y] = (R, G, B, a)
    im.save(out)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
