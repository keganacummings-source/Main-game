"""
Builds the ten caster classes' own sprites on public/sprites/class_warriors.png.

Each caster used to borrow another class's sprite (Embermage drew as the Channeler, and so on). This
recolours that source block into the caster's own element palette and lays it into a free slot on the
sheet: row 5 (y=880) after the Crying Girl, and a new row 6 (y=1056). Skin, outlines and the magenta
chroma key are left alone. Re-run from the original sheet:

    python3 scripts/sprites/recolor-casters.py <original class_warriors.png> public/sprites/class_warriors.png
"""
import colorsys
import sys
from PIL import Image

SRC = {"spellweaver": (256, 0), "ghoulknight": (256, 176), "frostblade": (384, 176), "pyromancer": (512, 176), "tidecaller": (640, 176),
       "stormrider": (0, 352), "briarmage": (128, 352), "lightbringer": (256, 352), "voidwalker": (384, 352), "songweaver": (640, 528)}
# new class: (source sprite, target hue in degrees, saturation x, value x)
PLAN = [("embermage", "pyromancer", 8, 1.25, 0.85), ("tidewitch", "tidecaller", 285, 1.1, 0.95), ("stonecaller", "briarmage", 32, 0.9, 0.85),
        ("stormwitch", "stormrider", 265, 1.2, 1.0), ("frostweaver", "frostblade", 222, 1.6, 0.9), ("radiant", "lightbringer", 48, 1.15, 1.1),
        ("gravemage", "ghoulknight", 278, 1.5, 1.05), ("arcanist", "spellweaver", 305, 1.15, 1.0), ("ruinmage", "voidwalker", 350, 1.3, 0.75),
        ("veilsinger", "songweaver", 320, 0.75, 1.1)]
SLOTS = [(128, 880), (256, 880), (384, 880), (512, 880), (640, 880), (0, 1056), (128, 1056), (256, 1056), (384, 1056), (512, 1056)]
MAGENTA = (255, 0, 255)


def skin(h, s, v):
    return 0.02 <= h <= 0.12 and 0.18 <= s <= 0.62 and v >= 0.55


def main(src_path, out_path):
    im = Image.open(src_path).convert("RGBA")
    w, _ = im.size
    out = Image.new("RGBA", (w, 1232), MAGENTA + (255,))
    out.paste(im.crop((0, 0, w, min(im.size[1], 1056))), (0, 0))
    for (name, source, hue, sm, vm), (dx, dy) in zip(PLAN, SLOTS):
        sx, sy = SRC[source]
        block = im.crop((sx, sy, sx + 128, sy + 176)).copy()
        px = block.load()
        for y in range(176):
            for x in range(128):
                r, g, b, a = px[x, y]
                if (r, g, b) == MAGENTA or a == 0:
                    continue
                h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
                if s < 0.16 or v < 0.12 or skin(h, s, v):
                    continue
                nh = ((hue / 360) + (h - 0.5) * 0.12) % 1.0
                R, G, B = [int(round(c * 255)) for c in colorsys.hsv_to_rgb(nh, min(1, s * sm), min(1, v * vm))]
                if abs(R - 255) < 40 and G < 40 and abs(B - 255) < 40:
                    G = 60  # never land on the chroma key
                px[x, y] = (R, G, B, a)
        out.paste(block, (dx, dy))
    out.save(out_path)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
