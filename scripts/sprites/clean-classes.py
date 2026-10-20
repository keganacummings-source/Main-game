"""
Clean-up pass over every class sprite block on public/sprites/class_warriors.png (all 40 classes).

  1. Light areas get a crisp rim: a light pixel on the silhouette's edge is darkened in place
     where the light area is 3px+ thick (halos, sparkles and thin trims are left alone). Pale
     classes (Spirit Caller, Absolver, Seraph, Moonhopper, Nightlord's hair...) had no dark edge
     and blurred into light ground; now every silhouette reads, at the same size.
  2. Dim stray pixels with no neighbour are removed.
  3. Blocks without the soft contact shadow under the feet (the ten casters) get the same one the
     original 30 have: alpha 96 black on the bottom row, under each foot.

Run after caster-designs.py:
    python3 scripts/sprites/clean-classes.py public/sprites/class_warriors.png public/sprites/class_warriors.png
"""
import sys
from PIL import Image

FW, FH = 32, 44
MAGENTA = (255, 0, 255)
SHADOW = (0, 0, 0, 96)
# Every class block (x, y). Row 4 (y=704) has Oathkeeper..Crying Girl at x 0..640; rows 5-6 the casters.
BLOCKS = [(x, y) for y in (0, 176, 352, 528) for x in range(0, 768, 128) if (x, y) != (0, 0)] + \
         [(x, 704) for x in range(0, 768, 128)] + [(x, 880) for x in range(0, 768, 128)] + [(x, 1056) for x in range(0, 640, 128)]


def empty(c):
    return c[3] == 0 or c[:3] == MAGENTA


def lum(c):
    return 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]


def clean_frame(px, x0, y0):
    get = lambda x, y: px[x0 + x, y0 + y]
    body = lambda c: not empty(c) and c != SHADOW
    # 1. Crisp rims on light areas: a light pixel on the silhouette's edge is darkened in place
    #    (the silhouette keeps its size), but only where the light area is at least 3px thick behind
    #    it, so halos, sparkles and thin trims are left exactly as drawn.
    changes = {}
    for y in range(FH - 1):
        for x in range(FW):
            c = get(x, y)
            if not body(c) or lum(c) <= 70:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                xx, yy = x + dx, y + dy
                out_empty = not (0 <= xx < FW and 0 <= yy < FH) or empty(get(xx, yy))
                if not out_empty:
                    continue
                inner = [(x - dx * k, y - dy * k) for k in (1, 2)]
                # The soft grey rim the pale classes were drawn with (lighter colour behind it) is deepened
                # into a real outline; thin details fail this test and stay as drawn.
                if all(0 <= a < FW and 0 <= b < FH - 1 and body(get(a, b)) and lum(get(a, b)) > 100 for a, b in inner) and lum(get(*inner[0])) >= lum(c) - 4:
                    changes[(x, y)] = (int(c[0] * 0.42), int(c[1] * 0.38), int(c[2] * 0.48), 255)
                    break
    for (x, y), c in changes.items():
        px[x0 + x, y0 + y] = c
    # 2. dim strays.
    for y in range(FH - 1):
        for x in range(FW):
            c = get(x, y)
            if not body(c) or lum(c) >= 60:
                continue
            if not any(0 <= x + dx < FW and 0 <= y + dy < FH and body(get(x + dx, y + dy)) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1))):
                px[x0 + x, y0 + y] = (255, 0, 255, 255) if get(0, 0)[:3] == MAGENTA else (0, 0, 0, 0)
    # 3. contact shadow under the feet, if the frame has none.
    if not any(get(x, FH - 1)[3] == 96 for x in range(FW)):
        feet = [x for x in range(FW) if body(get(x, FH - 2))]
        for x in feet:
            for xx in (x - 1, x, x + 1):
                if 0 <= xx < FW and empty(get(xx, FH - 1)):
                    px[x0 + xx, y0 + FH - 1] = SHADOW


def main(src, out):
    im = Image.open(src).convert("RGBA")
    px = im.load()
    for bx, by in BLOCKS:
        if by + 176 > im.size[1]:
            continue
        for row in range(4):
            for f in range(4):
                clean_frame(px, bx + f * FW, by + row * FH)
    im.save(out)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
