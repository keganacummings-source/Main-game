#!/usr/bin/env python3
"""
Draws the 32x32 New Texture Mode art for the Power blocks and writes:

  public/MapAssets/NewTex/{hellgen,battery,wire,xpgen,duplicator,logburner,solar,capacitor,blockgen,blockbreaker,tesla}.png   (shipped defaults)
  public/MapAssets/NewTex/pipe.png                                      (build-bar icon only; pipes are drawn from their neighbours)
  public/MapAssets/NewTex/power-pack.json                               (importable in the Tile Builder)

The game draws these when you have not painted your own version in Designer Mode.
Re-run after editing:  python3 scripts/sprites/power-textures.py
"""
import base64, io, json, os, time
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "..", "public", "MapAssets", "NewTex"))
N = 32
OUTLINE = "#141214"
BROWN = "#2b1a0e"


def hx(c):
    c = c.lstrip("#")
    return (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16), 255)


class Art:
    def __init__(self):
        self.im = Image.new("RGBA", (N, N), (0, 0, 0, 0))
        self.p = self.im.load()

    def px(self, x, y, c):
        if 0 <= x < N and 0 <= y < N:
            self.p[x, y] = hx(c) if isinstance(c, str) else c

    def rect(self, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.px(x, y, c)

    def box(self, x0, y0, x1, y1, fill, edge):
        self.rect(x0, y0, x1, y1, edge)
        self.rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, fill)

    def disc(self, cx, cy, r, c):
        for y in range(N):
            for x in range(N):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                    self.px(x, y, c)

    def line(self, x0, y0, x1, y1, c):
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx + dy
        while True:
            self.px(x0, y0, c)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy; x0 += sx
            if e2 <= dx:
                err += dx; y0 += sy

    def png_bytes(self):
        b = io.BytesIO()
        self.im.save(b, "PNG")
        return b.getvalue()


def hellgen():
    a = Art()
    # chimney
    a.box(20, 1, 26, 10, "#3d3338", OUTLINE)
    a.rect(21, 2, 21, 9, "#50444a")
    a.rect(20, 1, 26, 2, OUTLINE); a.rect(21, 2, 25, 2, "#6a5861")
    # smoke / embers above chimney
    a.px(23, 0, "#6a5861"); a.px(25, 0, "#ff7a4a")
    # furnace body
    a.box(3, 9, 28, 30, "#2a2226", OUTLINE)
    # brick courses
    for y in (13, 18, 23, 28):
        a.rect(4, y, 27, y, "#3d3338")
    for y, offs in ((10, (9, 18, 24)), (15, (6, 14, 22)), (20, (8, 12, 26)), (25, (7, 20, 25))):
        for x in offs:
            a.rect(x, y, x, y + 2 if y < 28 else y + 1, "#3d3338")
    # highlights
    a.rect(4, 10, 27, 10, "#50444a")
    a.rect(4, 11, 4, 29, "#50444a")
    # hell ore chunks on the left shoulder
    for (x, y) in ((6, 11), (8, 12), (7, 14)):
        a.rect(x, y, x + 1, y + 1, "#c0392b")
        a.px(x, y, "#ff7a4a")
    # fire mouth (arched)
    a.rect(9, 17, 22, 28, OUTLINE)
    a.rect(10, 16, 21, 16, OUTLINE)
    a.rect(11, 15, 20, 15, OUTLINE)
    a.rect(10, 17, 21, 27, "#1b0e0e")
    a.rect(11, 16, 20, 16, "#1b0e0e")
    # flames
    flame = [
        (12, 27, 19, 27, "#a8281a"),
        (12, 26, 19, 26, "#c0392b"),
        (13, 25, 18, 25, "#e25a32"),
        (13, 24, 18, 24, "#e25a32"),
        (14, 23, 17, 23, "#ff8a3a"),
        (14, 22, 17, 22, "#ff8a3a"),
        (15, 21, 16, 21, "#ffc45b"),
        (15, 20, 16, 20, "#ffc45b"),
        (15, 19, 15, 19, "#fff0b0"),
    ]
    for x0, y0, x1, y1, c in flame:
        a.rect(x0, y0, x1, y1, c)
    a.px(12, 23, "#e25a32"); a.px(19, 22, "#e25a32"); a.px(11, 26, "#ff8a3a"); a.px(20, 25, "#ff8a3a")
    a.px(15, 25, "#ffc45b"); a.px(16, 26, "#ffc45b")
    # glow veins around the mouth
    for (x, y) in ((8, 20), (8, 24), (23, 19), (23, 23), (9, 16), (22, 16)):
        a.px(x, y, "#a8281a")
    # feet
    a.rect(3, 30, 8, 31, OUTLINE); a.rect(23, 30, 28, 31, OUTLINE)
    return a


def battery():
    a = Art()
    # terminals
    a.box(10, 1, 13, 6, "#9aa0a6", OUTLINE); a.px(11, 2, "#e8ecef")
    a.box(18, 1, 21, 6, "#9aa0a6", OUTLINE); a.px(19, 2, "#e8ecef")
    a.rect(11, 0, 12, 0, "#4aa0ff"); a.rect(19, 0, 20, 0, "#4aa0ff")  # little arcs
    # body
    a.box(5, 6, 26, 30, "#1a3a6b", OUTLINE)
    a.rect(6, 7, 6, 29, "#2f6fc4")          # left sheen
    a.rect(7, 7, 25, 8, "#3a4a66")          # steel cap
    a.rect(7, 9, 25, 9, OUTLINE)
    a.rect(7, 28, 25, 29, "#10264a")        # base shadow
    # charge window
    a.rect(9, 11, 22, 26, OUTLINE)
    a.rect(10, 12, 21, 25, "#0b1830")
    bars = ["#8fd0ff", "#4aa0ff", "#4aa0ff", "#2f6fc4"]
    for i, c in enumerate(bars):
        y = 13 + i * 3
        a.rect(11, y, 20, y + 1, c)
    a.rect(11, 13, 20, 13, "#d8f0ff")
    # bolt
    for (x, y) in ((16, 15), (15, 16), (14, 17), (15, 17), (16, 17), (16, 18), (15, 19), (14, 20)):
        a.px(x, y, "#fff3a8")
    # rivets
    for (x, y) in ((7, 11), (24, 11), (7, 27), (24, 27)):
        a.px(x, y, "#9aa0a6")
    return a


def wire():
    a = Art()
    # outer insulation (dark), then copper, so neighbouring wires join up edge to edge
    a.rect(0, 12, 31, 19, OUTLINE)
    a.rect(12, 0, 19, 31, OUTLINE)
    a.rect(0, 13, 31, 18, "#4a3216")
    a.rect(13, 0, 18, 31, "#4a3216")
    a.rect(0, 14, 31, 17, "#c4a35a")
    a.rect(14, 0, 17, 31, "#c4a35a")
    a.rect(0, 14, 31, 14, "#e8c878")
    a.rect(14, 0, 14, 31, "#e8c878")
    a.rect(0, 17, 31, 17, "#8a6a2a")
    a.rect(17, 0, 17, 31, "#8a6a2a")
    # twist marks along the copper
    for x in (3, 7, 24, 28):
        a.px(x, 15, "#8a6a2a"); a.px(x, 16, "#8a6a2a")
    for y in (3, 7, 24, 28):
        a.px(15, y, "#8a6a2a"); a.px(16, y, "#8a6a2a")
    # centre junction plate
    a.box(10, 10, 21, 21, "#6a4a22", OUTLINE)
    a.rect(11, 11, 20, 11, "#e8c878")
    a.rect(11, 11, 11, 20, "#c4a35a")
    a.rect(12, 12, 19, 19, "#8a6a2a")
    a.rect(13, 13, 18, 18, "#c4a35a")
    a.rect(14, 14, 17, 17, "#ffe08a")
    a.px(15, 15, "#fffbe0"); a.px(16, 15, "#fff3a8")
    # sparks
    a.px(9, 9, "#fff3a8"); a.px(22, 22, "#fff3a8")
    return a


def xpgen():
    a = Art()
    # pedestal
    a.box(5, 23, 26, 30, "#2a1648", "#1b0e2f")
    a.rect(6, 24, 25, 24, "#3a2466")
    a.box(9, 19, 22, 23, "#3a2466", "#1b0e2f")
    a.rect(10, 20, 21, 20, "#5a3a8a")
    # runes on the base
    for x in (8, 11, 14, 17, 20, 23):
        a.px(x, 27, "#c9a6e8")
        a.px(x + 1, 28, "#7a5aa8")
    # cradle prongs
    a.rect(11, 15, 12, 19, "#1b0e2f"); a.rect(19, 15, 20, 19, "#1b0e2f")
    a.px(11, 16, "#5a3a8a"); a.px(19, 16, "#5a3a8a")
    # glow halo
    a.disc(16, 11, 9, (80, 50, 140, 90))
    a.disc(16, 11, 8, (120, 80, 190, 120))
    # orb
    a.disc(16, 11, 6, "#1b0e2f")
    a.disc(16, 11, 5, "#7a4ac8")
    a.disc(16, 11, 4, "#a678e8")
    a.disc(15, 10, 3, "#c9a6e8")
    a.disc(14, 9, 1, "#f1e8ff")
    a.px(18, 13, "#7a4ac8"); a.px(17, 14, "#7a4ac8")
    # sparkles
    for (x, y) in ((6, 5), (26, 7), (4, 12), (28, 14), (8, 1), (24, 2)):
        a.px(x, y, "#e6d0ff")
    for (x, y) in ((6, 4), (6, 6), (5, 5), (7, 5)):
        a.px(x, y, (201, 166, 232, 150))
    return a


def duplicator():
    a = Art()
    a.box(2, 5, 29, 30, "#143028", OUTLINE)
    a.rect(3, 6, 28, 6, "#1f5a46")
    a.rect(3, 7, 3, 29, "#1f5a46")
    # status lights
    for x, c in ((6, "#3dff9a"), (9, "#3dff9a"), (12, "#1f5a46")):
        a.rect(x, 8, x + 1, 9, c)
    a.rect(20, 8, 26, 9, "#0b1c16")
    a.rect(21, 8, 22, 9, "#7dffb3")
    # pods
    for x0, bright in ((5, True), (19, False)):
        a.box(x0, 12, x0 + 8, 25, "#0b1c16", OUTLINE)
        a.rect(x0 + 1, 13, x0 + 7, 13, "#3a7a66")  # glass sheen
        a.rect(x0 + 1, 13, x0 + 1, 24, "#1f5a46")
        # item: a little diamond/gem
        cx, cy = x0 + 4, 19
        main = "#3dff9a" if bright else "#1f8a5a"
        edge = "#7dffb3" if bright else "#2fb878"
        for (dx, dy) in ((0, -3), (-1, -2), (0, -2), (1, -2), (-2, -1), (-1, -1), (0, -1), (1, -1), (2, -1),
                         (-2, 0), (-1, 0), (0, 0), (1, 0), (2, 0), (-1, 1), (0, 1), (1, 1), (0, 2)):
            a.px(cx + dx, cy + dy, main)
        a.px(cx, cy - 3, edge); a.px(cx - 1, cy - 2, edge); a.px(cx - 2, cy - 1, edge)
    # dotted outline on the copy
    for (x, y) in ((19, 12), (27, 12), (19, 25), (27, 25)):
        a.px(x, y, "#3dff9a")
    # arrow between the pods (a right-pointing triangle, so it never reads as another gem)
    for x, y0, y1 in ((14, 16, 20), (15, 17, 19), (16, 18, 18)):
        a.rect(x, y0, x, y1, "#3dff9a")
    a.px(14, 15, "#1f8a5a"); a.px(14, 21, "#1f8a5a")
    # vent
    for x in range(7, 25, 3):
        a.rect(x, 27, x + 1, 28, "#0b1c16")
    return a


def logburner():
    a = Art()
    a.box(21, 3, 25, 11, "#4a3a2c", OUTLINE)
    a.rect(22, 4, 22, 10, "#6a5340")
    a.px(23, 1, "#7a6a5c"); a.px(24, 2, "#9a8a7c")
    a.box(3, 10, 28, 30, "#4a2e18", OUTLINE)
    for y in (14, 19, 24):
        a.rect(4, y, 27, y, "#33200f")
    a.rect(4, 11, 27, 11, "#6d4626")
    a.rect(4, 12, 4, 29, "#6d4626")
    a.rect(4, 17, 27, 17, "#5b6470"); a.rect(4, 27, 27, 27, "#5b6470")
    a.rect(8, 18, 23, 26, OUTLINE)
    a.rect(9, 19, 22, 25, "#1b0e0e")
    for x0, y0 in ((9, 23), (13, 23), (17, 23)):
        a.rect(x0, y0, x0 + 3, y0 + 2, "#8a5a2e"); a.rect(x0, y0, x0 + 3, y0, "#b07a40"); a.px(x0 + 1, y0 + 1, "#5a381a")
    for x0 in (11, 15):
        a.rect(x0, 20, x0 + 3, 22, "#8a5a2e"); a.rect(x0, 20, x0 + 3, 20, "#b07a40"); a.px(x0 + 1, 21, "#5a381a")
    for x0, y0, x1, y1, c in ((13, 19, 18, 20, "#e8903a"), (14, 18, 17, 19, "#ffc45b"), (15, 17, 16, 18, "#fff0b0")):
        a.rect(x0, y0, x1, y1, c)
    a.rect(3, 30, 8, 31, OUTLINE); a.rect(23, 30, 28, 31, OUTLINE)
    return a


def solar():
    a = Art()
    a.box(2, 5, 29, 24, "#2b3340", OUTLINE)
    for cy in range(7, 23, 5):
        for cx in range(4, 28, 6):
            a.rect(cx, cy, cx + 4, cy + 3, "#1f4f99")
            a.rect(cx, cy, cx + 4, cy, "#3d86e0")
            a.px(cx + 1, cy + 1, "#8cc4ff")
    a.px(25, 8, "#ffe27a"); a.px(24, 8, "#ffe27a"); a.px(25, 7, "#ffe27a")
    a.box(14, 24, 17, 28, "#6a7482", OUTLINE)
    a.box(8, 28, 23, 31, "#4a5260", OUTLINE)
    a.rect(9, 29, 22, 29, "#6a7482")
    return a


def capacitor():
    a = Art()
    a.box(11, 0, 20, 4, "#9aa0a6", OUTLINE); a.rect(12, 1, 19, 1, "#e8ecef")
    a.px(14, 0, "#7fd0ff"); a.px(17, 0, "#7fd0ff")
    a.box(3, 4, 28, 30, "#143a52", OUTLINE)
    a.rect(4, 5, 4, 29, "#2f7fb0")
    a.rect(5, 5, 27, 6, "#3a4a66"); a.rect(5, 7, 27, 7, OUTLINE)
    for i, y in enumerate(range(9, 28, 6)):
        a.rect(7, y, 24, y + 4, OUTLINE)
        a.rect(8, y + 1, 23, y + 3, "#0c2236")
        w = 22
        a.rect(8, y + 1, w, y + 3, "#38b6ff")
        a.rect(8, y + 1, w, y + 1, "#bdeaff")
    for x, y in ((16, 9), (15, 10), (14, 11), (16, 12), (15, 13)):
        a.px(x, y, "#fff6a8")
    a.rect(5, 29, 26, 30, "#0b2234")
    return a


def blockgen():
    a = Art()
    a.box(3, 3, 28, 28, "#343846", OUTLINE)
    a.rect(4, 4, 27, 4, "#555b70"); a.rect(4, 5, 4, 27, "#555b70")
    a.box(8, 6, 23, 14, "#1c1f2a", OUTLINE)
    a.rect(10, 8, 21, 12, "#2b3a2b")
    a.rect(12, 9, 19, 11, "#6fae5c"); a.rect(12, 9, 19, 9, "#a8e090")
    for x0, x1, y in ((13, 18, 17), (14, 17, 18), (15, 16, 19)):
        a.rect(x0, y, x1, y, "#9bd18a")
    a.rect(14, 15, 17, 16, "#9bd18a")
    for x, y in ((5, 5), (26, 5), (5, 26), (26, 26)):
        a.px(x, y, "#aab0c0")
    a.box(11, 22, 20, 30, "#7a5a36", OUTLINE)
    a.rect(12, 23, 19, 23, "#a98150"); a.px(14, 26, "#5a3f22"); a.px(17, 27, "#5a3f22")
    return a


def blockbreaker():
    a = Art()
    a.box(3, 3, 28, 28, "#3c2f30", OUTLINE)
    a.rect(4, 4, 27, 4, "#6b5252"); a.rect(4, 5, 4, 27, "#6b5252")
    a.box(8, 7, 23, 15, "#1c1416", OUTLINE)
    for x in range(9, 23, 2):
        a.px(x, 14, "#d8dde4"); a.px(x + 1, 13, "#aab0b8")
    a.rect(9, 9, 22, 12, "#8a949e"); a.rect(9, 9, 22, 9, "#d8dde4")
    a.box(11, 19, 20, 29, "#6a6a72", OUTLINE)
    a.rect(12, 20, 19, 20, "#9a9aa4")
    for x, y in ((15, 21), (16, 22), (15, 23), (16, 24), (17, 25), (14, 26)):
        a.px(x, y, "#2a2a30")
    for x, y in ((9, 18), (22, 20), (10, 28)):
        a.px(x, y, "#e07a6a")
    for x, y in ((5, 5), (26, 5), (5, 26), (26, 26)):
        a.px(x, y, "#b09a9a")
    return a


def tesla():
    a = Art()
    a.box(6, 24, 25, 31, "#2b3340", OUTLINE)
    a.rect(7, 25, 24, 25, "#556070")
    a.box(11, 11, 20, 24, "#6a4a2a", OUTLINE)
    for y in range(13, 24, 2):
        a.rect(12, y, 19, y, "#c98a4a")
    a.rect(12, 12, 12, 23, "#e0a866")
    a.disc(15, 7, 5, OUTLINE)
    a.disc(15, 7, 4, "#9fe8ff")
    a.px(13, 5, "#ffffff"); a.px(14, 5, "#ffffff"); a.px(13, 6, "#ffffff")
    for x, y in ((6, 3), (7, 4), (8, 4), (24, 3), (23, 4), (22, 4), (5, 10), (26, 11)):
        a.px(x, y, "#e8fbff")
    a.px(7, 5, "#6fd8ff"); a.px(23, 5, "#6fd8ff")
    return a


def pipe_icon():
    a = Art()
    body, light, dark = "#8794a6", "#c5d1df", "#566171"
    def seg(x0, y0, x1, y1):
        a.rect(x0 - 1, y0 - 1, x1 + 1, y1 + 1, OUTLINE)
    seg(0, 11, 21, 21); seg(11, 11, 21, 31)
    a.rect(0, 12, 20, 20, body); a.rect(12, 12, 20, 31, body)
    a.rect(0, 13, 11, 14, light); a.rect(13, 12, 14, 31, light)
    a.rect(0, 18, 11, 19, dark); a.rect(18, 20, 19, 31, dark)
    seg(21, 13, 31, 19); a.rect(21, 14, 31, 18, body); a.rect(21, 14, 31, 15, light); a.rect(21, 17, 31, 18, dark)
    a.rect(28, 12, 31, 20, OUTLINE); a.rect(28, 13, 30, 19, "#a9b6c7")
    a.rect(4, 15, 6, 17, "#9fe8ff"); a.rect(14, 24, 16, 26, "#9fe8ff")
    return a


def ghostmerger():
    a = Art()
    # cauldron base
    a.box(4, 16, 27, 30, "#241a2e", OUTLINE)
    a.rect(5, 17, 26, 17, "#3a2a4a")
    a.rect(5, 18, 5, 29, "#3a2a4a")
    # rim
    a.box(3, 13, 28, 17, "#3a2a4a", OUTLINE)
    a.rect(4, 14, 27, 14, "#5a4472")
    # inner glow mouth
    a.rect(6, 18, 25, 24, "#120a1c")
    a.disc(16, 22, 6, (120, 80, 190, 120))
    a.disc(16, 22, 4, (160, 110, 220, 150))
    # ghost rising out
    a.disc(16, 11, 5, OUTLINE)
    a.disc(16, 11, 4, "#d8c4ff")
    a.disc(15, 10, 2, "#ffffff")
    a.px(14, 11, "#3a2a4a"); a.px(18, 11, "#3a2a4a")  # eyes
    # wispy tail
    a.px(13, 15, "#b9a8e8"); a.px(16, 16, "#b9a8e8"); a.px(19, 15, "#b9a8e8")
    a.px(14, 14, "#c9bcf0"); a.px(18, 14, "#c9bcf0")
    # sparkles
    for (x, y) in ((6, 8), (26, 9), (9, 4), (24, 5)):
        a.px(x, y, "#e6d0ff")
    # feet
    a.rect(4, 30, 9, 31, OUTLINE); a.rect(22, 30, 27, 31, OUTLINE)
    return a


def gearforge():
    a = Art()
    # stone base
    a.box(3, 24, 28, 31, "#3a3338", OUTLINE)
    a.rect(4, 25, 27, 25, "#55505a")
    # forge glow under the anvil
    a.rect(8, 23, 23, 23, "#e2541f")
    for x in (10, 14, 18, 21):
        a.px(x, 24, "#ffb04a")
    # anvil: top face, waist, body
    a.rect(5, 15, 26, 18, "#3a3a44")
    a.rect(6, 16, 25, 16, "#5a5a66")
    a.rect(24, 13, 27, 16, "#3a3a44")          # horn
    a.rect(25, 14, 27, 14, "#5a5a66")
    a.box(10, 18, 21, 23, "#2a2a30", OUTLINE)  # body
    a.rect(11, 19, 11, 22, "#4a4a54")
    # gear emblem on the face
    a.disc(14, 9, 5, OUTLINE)
    a.disc(14, 9, 4, "#c9a25a")
    a.disc(14, 9, 2, "#2a2a30")
    for (dx, dy) in ((0, -6), (0, 6), (-6, 0), (6, 0), (-4, -4), (4, 4), (-4, 4), (4, -4)):
        a.px(14 + dx, 9 + dy, "#e8c878")
    # hammer sparks
    for (x, y) in ((9, 6), (20, 5), (23, 8)):
        a.px(x, y, "#ffd37a")
    return a


SLOTS = [
    ("hellgen", "HellStone Power Generator", hellgen),
    ("battery", "Battery", battery),
    ("wire", "Wire", wire),
    ("xpgen", "XP Producer", xpgen),
    ("duplicator", "Duplicator", duplicator),
    ("logburner", "LogBurning Generator", logburner),
    ("solar", "Solar Panel", solar),
    ("capacitor", "Capacitor", capacitor),
    ("blockgen", "BlockGenerator", blockgen),
    ("blockbreaker", "BlockBreaker", blockbreaker),
    # Rock Miner is the renamed BlockBreaker; it draws in-world from the "rockminer" slot, so
    # ship that file too (same art) or it falls back to a blank square.
    ("rockminer", "Rock Miner", blockbreaker),
    ("tesla", "Tesla Coil", tesla),
    ("ghostmerger", "Ghost Merger", ghostmerger),
    ("gearforge", "GearSet Forge", gearforge),
]


def main():
    os.makedirs(OUT, exist_ok=True)
    pack = []
    now = int(time.time() * 1000)
    for i, (slot, label, fn) in enumerate(SLOTS):
        art = fn()
        data = art.png_bytes()
        with open(os.path.join(OUT, f"{slot}.png"), "wb") as f:
            f.write(data)
        pack.append({
            "id": f"builtin-{slot}",
            "name": label,
            "group": "power",
            "category": slot,
            "pixels": "data:image/png;base64," + base64.b64encode(data).decode(),
            "size": 32,
            "created": now + i,
            "live": True,
        })
        print("wrote", slot + ".png")
    with open(os.path.join(OUT, "pipe.png"), "wb") as f:
        f.write(pipe_icon().png_bytes())
    print("wrote pipe.png")
    with open(os.path.join(OUT, "power-pack.json"), "w") as f:
        json.dump(pack, f, indent=2)
    print("wrote power-pack.json")


if __name__ == "__main__":
    main()
