"""
Paints the Engineer into the last free block on public/sprites/class_warriors.png.

The sheet is laid out as blocks of 128x176 (four 32x44 walk frames across, four facing rows down).
Every block was taken except the last one on row 6 (x=640, y=1056), which was still flat magenta —
the chroma key — so a class pointed at it drew as nothing at all.

The Engineer is built the way the casters were (recolor-casters.py): take a body whose silhouette
already fits — the Ironpalm's, bare-armed and planted, which reads as someone who works with their
hands — and push its cloth and metal into cold steel and cyan. Skin, outlines and the chroma
key are left where they are. Idempotent: it always reads the Ironpalm block, never its own output.

    python3 scripts/sprites/engineer-class.py public/sprites/class_warriors.png
"""
import colorsys
import sys

from PIL import Image

SOURCE = (0, 176)       # Ironpalm
TARGET = (640, 1056)    # the one free block
BLOCK = (128, 176)
MAGENTA = (255, 0, 255)
# Cold steel with a cyan cast. The body this is built from is already warm brown and orange, so a
# brass palette came out almost identical to it; swinging to the other side of the wheel is what
# actually makes the Engineer read as her own class at a glance.
HUE = 198 / 360
SAT_MULT = 0.95
VAL_MULT = 1.08


def is_skin(h: float, s: float, v: float) -> bool:
    """The same skin band the caster script protected, so the face stays a face."""
    return 0.02 <= h <= 0.12 and 0.18 <= s <= 0.62 and v >= 0.55


def main(path: str) -> None:
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    need_x, need_y = TARGET[0] + BLOCK[0], TARGET[1] + BLOCK[1]
    if w < need_x or h < need_y:
        raise SystemExit(f"sheet is {w}x{h}; the Engineer block needs at least {need_x}x{need_y}")

    block = im.crop((SOURCE[0], SOURCE[1], SOURCE[0] + BLOCK[0], SOURCE[1] + BLOCK[1])).copy()
    px = block.load()
    for y in range(BLOCK[1]):
        for x in range(BLOCK[0]):
            r, g, b, a = px[x, y]
            if (r, g, b) == MAGENTA or a == 0:
                continue
            hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            # Outlines (near-black) and the whites of the eyes carry the read; leave them alone.
            if ss < 0.16 or vv < 0.12 or is_skin(hh, ss, vv):
                continue
            nh = (HUE + (hh - 0.5) * 0.10) % 1.0
            R, G, B = (int(round(c * 255)) for c in colorsys.hsv_to_rgb(nh, min(1, ss * SAT_MULT), min(1, vv * VAL_MULT)))
            if abs(R - 255) < 40 and G < 40 and abs(B - 255) < 40:
                G = 60  # never land on the chroma key itself
            px[x, y] = (R, G, B, a)

    im.paste(block, TARGET)
    im.save(path)
    print(f"Engineer painted into {TARGET} of {path}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "public/sprites/class_warriors.png")
