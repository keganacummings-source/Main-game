"""
Derives the extra New Texture tiles the bigger world needs.

The chart (src/game/world-chart.ts) has sixteen biomes; the New Texture set was
drawn for six. Several of the new ones can honestly share art — taiga and tundra
are both snow — but a few would otherwise be indistinguishable from a biome they
are meant to contrast with:

    savanna   was borrowing the dirt tile, so it read as bare ground
    jungle    was borrowing the swamp floor, so it read as swamp
    highland  was borrowing the stone floor, so a mountain looked like a dungeon
    tundra    was borrowing plain snow, so it read as glacier

So this makes four ground tiles and three scatter overlays from the tiles that
already exist, the same way the caster sprites and the Engineer were made: shift
the source into a new palette, keep its structure. They are recolours and this
file says so — nobody should mistake them for hand-drawn art — but they make the
biomes tell each other apart, which is what they are for.

Idempotent: every output is derived from an untouched source tile, so it can be
re-run at any time.

    python3 scripts/sprites/world-decor.py public/MapAssets/NewTex
"""
import colorsys
import os
import sys

from PIL import Image

# output -> (source, hue in degrees, saturation x, value x)
GROUND = [
    # Dry yellow grass: savanna should read as grassland gone brown, not as dirt.
    ("grass_dry.png", "grass.png", 44, 0.80, 1.14),
    # Deep saturated green: jungle against the swamp's grey-green.
    ("grass_jungle.png", "grass.png", 128, 1.35, 0.78),
    # Pale warm rock. The first pass only nudged the hue and came out all but
    # identical to the dungeon floor it was made from, which defeated the point.
    ("stone_highland.png", "stone_floor.png", 32, 0.55, 1.75),
    # Frozen ground, not more ice: tundra is lichen and grit showing through the
    # snow. A bluer snow tile was indistinguishable from the snow beside it.
    ("snow_tundra.png", "snow.png", 36, 0.40, 0.84),
]

# output -> (source tile sampled for colour, how many clumps, clump radius)
# Scatter overlays sit on top of a ground tile, so they are sampled from a LIGHT
# source and lifted: taken from the dark stone tile they were invisible against
# the ground they were meant to sit on.
SCATTER = [
    ("decor_rocks.png", "sand.png", 5, 3, 0.72),
    ("decor_bones.png", "snow.png", 4, 2, 1.05),
    ("decor_shrub.png", "grass.png", 6, 3, 0.85),
]

MAGENTA = (255, 0, 255)


def shift(im: Image.Image, hue: float, sat: float, val: float) -> Image.Image:
    """Push a tile into a new palette, leaving its structure and alpha alone."""
    out = im.convert("RGBA").copy()
    px = out.load()
    w, h = out.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0 or (r, g, b) == MAGENTA:
                continue
            hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            # Keep each pixel's offset from its own tile's hue so shading survives.
            nh = ((hue / 360) + (hh - 0.5) * 0.12) % 1.0
            R, G, B = (int(round(c * 255)) for c in colorsys.hsv_to_rgb(nh, min(1, ss * sat), min(1, vv * val)))
            if abs(R - 255) < 40 and G < 40 and abs(B - 255) < 40:
                G = 60  # never land on the chroma key
            px[x, y] = (R, G, B, a)
    return out


def scatter(src: Image.Image, clumps: int, radius: int, seed: int, lift: float = 1.0) -> Image.Image:
    """
    A transparent overlay with a few clumps of colour taken from `src`.

    Deliberately simple: these sit on top of a ground tile at world scale, where
    a tile is 32 pixels and most of what reads is "something is there".
    """
    w, h = src.size
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sp = src.convert("RGBA").load()
    op = out.load()
    state = seed & 0xFFFFFFFF

    def rnd() -> float:
        nonlocal state
        state = (1103515245 * state + 12345) & 0x7FFFFFFF
        return state / 0x7FFFFFFF

    for _ in range(clumps):
        cx = int(rnd() * w)
        cy = int(rnd() * h)
        r = 1 + int(rnd() * radius)
        for y in range(max(0, cy - r), min(h, cy + r + 1)):
            for x in range(max(0, cx - r), min(w, cx + r + 1)):
                if (x - cx) ** 2 + (y - cy) ** 2 > r * r:
                    continue
                sr, sg, sb, sa = sp[x % w, y % h]
                if sa == 0:
                    continue
                # Darken toward the edge so a clump has a little shape to it.
                edge = ((x - cx) ** 2 + (y - cy) ** 2) / max(1, r * r)
                k = (0.62 + 0.38 * (1 - edge)) * lift
                op[x, y] = (min(255, int(sr * k)), min(255, int(sg * k)), min(255, int(sb * k)), 255)
    return out


def main(directory: str) -> None:
    made = []
    for name, source, hue, sat, val in GROUND:
        src_path = os.path.join(directory, source)
        if not os.path.exists(src_path):
            raise SystemExit(f"missing source tile: {src_path}")
        shift(Image.open(src_path), hue, sat, val).save(os.path.join(directory, name))
        made.append(name)

    for i, (name, source, clumps, radius, lift) in enumerate(SCATTER):
        src_path = os.path.join(directory, source)
        if not os.path.exists(src_path):
            raise SystemExit(f"missing source tile: {src_path}")
        scatter(Image.open(src_path), clumps, radius, 0x5EED + i * 977, lift).save(os.path.join(directory, name))
        made.append(name)

    print(f"wrote {len(made)} tiles into {directory}:")
    for n in made:
        print(f"  {n}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "public/MapAssets/NewTex")
