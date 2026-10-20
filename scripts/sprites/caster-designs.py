"""
Original designs for the ten caster classes, painted onto the stripped base body
(public/sprites/warrior_base.png) and laid into their slots on public/sprites/class_warriors.png.

Each caster gets its own silhouette, not a recolour of another class: headwear, hair, a held
item, collars or pauldrons, and floating effects, drawn for all four facings (back, right,
front, left = mirrored right) and bobbed with the walk cycle.

    python3 scripts/sprites/caster-designs.py public/sprites/class_warriors.png public/sprites/class_warriors.png
"""
import sys
from PIL import Image

MAGENTA = (255, 0, 255, 255)
OUT = (17, 7, 9, 255)  # the sheet's outline colour
FW, FH = 32, 44
SLOTS = {"embermage": (128, 880), "tidewitch": (256, 880), "stonecaller": (384, 880), "stormwitch": (512, 880), "frostweaver": (640, 880),
         "radiant": (0, 1056), "gravemage": (128, 1056), "arcanist": (256, 1056), "ruinmage": (384, 1056), "veilsinger": (512, 1056)}
# Base palette groups (see the palette map in the commit): hair (cloak-like long hair) and tunic.
HAIR = {(106, 68, 40): 1, (85, 46, 29): 0, (144, 106, 75): 2, (97, 60, 0): 0}
TUNIC = {(138, 106, 74): 1, (110, 76, 55): 0, (176, 149, 119): 2, (152, 89, 65): 1, (83, 46, 36): 0, (122, 78, 46): 1, (98, 53, 33): 0, (255, 218, 176): None}
BACK, RIGHT, FRONT, LEFT = 0, 1, 2, 3


def rgba(h, a=255):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


class Frame:
    """One 32x44 frame being painted. `under` paints only where the body is empty (things behind her)."""

    def __init__(self, base, facing, bob):
        self.px = base
        self.f = facing
        self.bob = bob
        self.body = {(x, y) for y in range(FH) for x in range(FW) if base[y][x][3] > 0}

    def get(self, x, y):
        return self.px[y][x] if 0 <= x < FW and 0 <= y < FH else None

    def put(self, x, y, c, under=False):
        if not (0 <= x < FW and 0 <= y < FH):
            return
        if under and (x, y) in self.body:
            return
        self.px[y][x] = c

    def shape(self, cells, fill, under=False, outline=True):
        """Fill a set of (x, y) cells (colour per cell via dict or one colour), then outline its empty rim."""
        cells = dict(cells) if isinstance(cells, dict) else {p: fill for p in cells}
        for (x, y), c in cells.items():
            self.put(x, y, c if c else fill, under)
        if outline:
            for (x, y) in cells:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    q = (x + dx, y + dy)
                    if q in cells:
                        continue
                    cur = self.get(*q)
                    if cur is not None and cur[3] == 0:
                        self.put(q[0], q[1], OUT)

    def recolor(self, hair=None, tunic=None):
        for y in range(FH):
            for x in range(FW):
                c = self.px[y][x]
                if c[3] == 0:
                    continue
                k = c[:3]
                if hair and k in HAIR:
                    self.px[y][x] = hair[HAIR[k]]
                elif tunic and k in TUNIC and TUNIC[k] is not None:
                    self.px[y][x] = tunic[TUNIC[k]]

    def trim_hair_below(self, y0, fill):
        """Shorten the long hair: hair pixels below y0 become `fill` (a robe or cloak)."""
        for y in range(y0 + self.bob, FH):
            for x in range(FW):
                c = self.px[y][x]
                if c[3] and c[:3] in HAIR:
                    self.px[y][x] = fill[HAIR[c[:3]]]


def rect(x0, y0, x1, y1):
    return {(x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)}


def line(x0, y0, x1, y1):
    pts = set()
    n = max(abs(x1 - x0), abs(y1 - y0), 1)
    for i in range(n + 1):
        pts.add((round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n)))
    return pts


def disc(cx, cy, r):
    return {(x, y) for x in range(int(cx - r - 1), int(cx + r + 2)) for y in range(int(cy - r - 1), int(cy + r + 2)) if (x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.3}


def ring(cx, cy, r, w=1.0):
    return {(x, y) for x in range(int(cx - r - 2), int(cx + r + 3)) for y in range(int(cy - r - 2), int(cy + r + 3)) if (r - w) ** 2 <= (x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.5}


def shade(cells, light, mid, dark, axis="x"):
    """Three-tone fill: light on the left/top third, dark on the right/bottom third."""
    if not cells:
        return {}
    vs = [p[0] if axis == "x" else p[1] for p in cells]
    lo, hi = min(vs), max(vs)
    span = max(1, hi - lo)
    out = {}
    for p in cells:
        t = ((p[0] if axis == "x" else p[1]) - lo) / span
        out[p] = light if t < 0.3 else dark if t > 0.72 else mid
    return out


# Hand anchors per facing (x, y at bob 0): where a held item sits.
HAND = {FRONT: (24, 34), BACK: (7, 34), RIGHT: (21, 34), LEFT: (10, 34)}
HEAD_TOP = 15  # minus bob


def staff(fr, top, color_shaft, x=None, under_back=True):
    """A tall staff in the held hand; `top` paints the head of it at (x, y)."""
    hx, hy = HAND[fr.f]
    if x is not None:
        hx = x
    y_top = 9 - fr.bob
    behind = fr.f == BACK and under_back
    fr.shape(shade(rect(hx, y_top + 4, hx + 1, 42), color_shaft[0], color_shaft[1], color_shaft[2]), None, under=behind)
    top(fr, hx, y_top)


# ---------------------------------------------------------------------------
# The ten designs. Each is f(frame) painting on top of the recoloured base.
# ---------------------------------------------------------------------------

def embermage(fr):
    hair = [rgba("#8a1e10"), rgba("#d8401c"), rgba("#ffb03a")]
    fr.recolor(hair=hair, tunic=[rgba("#2a1a1e"), rgba("#4a2a2a"), rgba("#7a4a3a")])
    fr.trim_hair_below(30, [rgba("#3a1414"), rgba("#5a1c18"), rgba("#7a2a1e")])
    t = HEAD_TOP - fr.bob
    # Flame hair: tongues of fire rising from the crown.
    tongues = [(10, 4), (13, 7), (16, 3), (19, 6), (22, 5)] if fr.f in (FRONT, BACK) else [(9, 5), (12, 3), (15, 6), (18, 4)]
    if fr.f == LEFT:
        tongues = [(31 - x, h) for x, h in tongues]
    cells = {}
    for x, h in tongues:
        for k in range(h):
            for w in range(-1 if k < h - 2 else 0, 2 if k < h - 3 else 1):
                cells[(x + w, t + 1 - k)] = hair[2] if k > h - 3 else hair[1] if k > 1 else hair[0]
    fr.shape(cells, None)
    # Ember-trimmed short cape (shoulders) and a fire orb in the open hand.
    hx, hy = HAND[fr.f]
    oy = hy - 6 - (fr.bob)
    if fr.f != BACK:
        orb = disc(hx + (1 if fr.f != LEFT else 0), oy, 2.3)
        fr.shape({p: (rgba("#fff1a8") if (p[0] - hx) ** 2 + (p[1] - oy) ** 2 < 1.5 else rgba("#ff8a2a") if p[1] < oy + 1 else rgba("#d8401c")) for p in orb}, None)
        for dx, dy in ((-1, -4), (2, -5), (0, -7)):
            fr.put(hx + dx, oy + dy - fr.bob, rgba("#ffb03a"))


def tidewitch(fr):
    fr.recolor(hair=[rgba("#0e4a52"), rgba("#1a8a8a"), rgba("#6ee0d0")], tunic=[rgba("#14304a"), rgba("#1e5070"), rgba("#4a8ab0")])
    t = HEAD_TOP - fr.bob
    # A fin crest running over the crown, and coral beads.
    if fr.f in (FRONT, BACK):
        fin = {(x, y) for x in range(12, 20) for y in range(t - 6, t + 1) if y >= t - 6 + abs(x - 15.5) * 0.9}
        fr.shape(shade(fin, rgba("#9af0e8"), rgba("#3ab8b0"), rgba("#1a7a80")), None)
    else:
        fin = {(x, y) for x in range(9, 20) for y in range(t - 5, t + 1) if y >= t - 5 + (19 - x) * 0.45}
        if fr.f == LEFT:
            fin = {(31 - x, y) for x, y in fin}
        fr.shape(shade(fin, rgba("#9af0e8"), rgba("#3ab8b0"), rgba("#1a7a80")), None)
    # Trident.
    def top(fr, x, y):
        prongs = rect(x - 2, y + 2, x + 3, y + 3) | line(x - 2, y + 2, x - 2, y - 1) | line(x + 3, y + 2, x + 3, y - 1) | line(x, y + 2, x, y - 3) | line(x + 1, y + 2, x + 1, y - 3)
        fr.shape({p: rgba("#e8d08a") if p[1] < y else rgba("#c09040") for p in prongs}, None, under=fr.f == BACK)
    staff(fr, top, [rgba("#5ad0d0"), rgba("#2a8a9a"), rgba("#14505a")])


def stonecaller(fr):
    fr.recolor(hair=[rgba("#2a3a1e"), rgba("#4a6a2e"), rgba("#7a9a4a")], tunic=[rgba("#3a3026"), rgba("#5a4a36"), rgba("#8a7a5a")])
    fr.trim_hair_below(29, [rgba("#3a3026"), rgba("#4e4232"), rgba("#6a5a44")])
    b = fr.bob
    # Heavy stone pauldrons make her the widest caster.
    stone = (rgba("#b0a890"), rgba("#7a7262"), rgba("#4a463c"))
    if fr.f in (FRONT, BACK):
        for x0 in (6, 20):
            fr.shape(shade(rect(x0, 27 - b, x0 + 5, 29 - b) - {(x0, 27 - b), (x0 + 5, 27 - b)}, *stone), None)
    else:
        x0 = 11
        fr.shape(shade(rect(x0, 27 - b, x0 + 6, 29 - b) - {(x0, 27 - b), (x0 + 6, 27 - b)}, *stone), None)
    # Circlet with a green gem.
    t = HEAD_TOP - b
    if fr.f == FRONT:
        fr.shape(rect(9, t + 4, 22, t + 4) | {(15, t + 3), (16, t + 3)}, rgba("#9a8a5a"), outline=False)
        fr.put(15, t + 3, rgba("#5ae07a")); fr.put(16, t + 3, rgba("#2a9a4a"))
    # Two boulders orbiting.
    for i, (ox, oy) in enumerate(((2, 22), (27, 18)) if fr.f != BACK else ((27, 22), (2, 18))):
        oy -= (b + i) % 2
        fr.shape(shade(disc(ox, oy, 1.6), *stone), None)


def stormwitch(fr):
    hair = [rgba("#8a96b0"), rgba("#d0d8f0"), rgba("#ffffff")]
    fr.recolor(hair=hair, tunic=[rgba("#1e2050"), rgba("#30368a"), rgba("#5a68d0")])
    fr.trim_hair_below(27, [rgba("#1e2050"), rgba("#262a6a"), rgba("#30368a")])
    t = HEAD_TOP - fr.bob
    # Hair swept straight up into a storm crest, with a lightning streak.
    crest = {(x, y) for x in range(10, 22) for y in range(t - 5, t + 2) if y >= t - 5 + abs(x - 15.5) * 0.7} if fr.f in (FRONT, BACK) else \
        {(x, y) for x in range(8, 21) for y in range(t - 6, t + 2) if y >= t - 6 + max(0, x - 13) * 0.9 + max(0, 11 - x)}
    if fr.f == LEFT:
        crest = {(31 - x, y) for x, y in crest}
    fr.shape(shade(crest, hair[2], hair[1], hair[0], axis="y"), None)
    bolt = [(15, t - 3), (16, t - 2), (15, t - 1), (16, t)] if fr.f in (FRONT, BACK) else [(13 if fr.f == RIGHT else 18, t - 3), (14 if fr.f == RIGHT else 17, t - 2), (13 if fr.f == RIGHT else 18, t - 1)]
    for p in bolt:
        fr.put(*p, rgba("#ffe24a"))
    # A long scarf streaming behind her.
    sc = rgba("#ffe24a")
    if fr.f == RIGHT:
        fr.shape(line(9, 28 - fr.bob, 3, 31) | line(9, 29 - fr.bob, 2, 33) | line(4, 31, 1, 35), sc, under=True)
    elif fr.f == LEFT:
        fr.shape(line(22, 28 - fr.bob, 28, 31) | line(22, 29 - fr.bob, 29, 33) | line(27, 31, 30, 35), sc, under=True)
    else:
        fr.shape(rect(10, 28 - fr.bob, 21, 28 - fr.bob), sc, outline=False)
        fr.shape(line(20, 29 - fr.bob, 22, 34), sc)
    # Crescent rod.
    def top(fr, x, y):
        cres = ring(x + 0.5, y, 3, 1.2) - rect(x - 1, y - 4, x + 4, y - 1 + 0)
        fr.shape({p: rgba("#ffe24a") for p in ring(x + 0.5, y, 3, 1.3) if p[1] >= y - 1 or p[0] <= x}, None, under=fr.f == BACK)
    staff(fr, top, [rgba("#c0c8e0"), rgba("#8088a8"), rgba("#4a5070")])


def frostweaver(fr):
    fr.recolor(hair=[rgba("#7aa0c8"), rgba("#c0dcf4"), rgba("#f4fbff")], tunic=[rgba("#1a3a6a"), rgba("#2a5a9a"), rgba("#6a9ad8")])
    t = HEAD_TOP - fr.bob
    ice = (rgba("#ffffff"), rgba("#a8e4ff"), rgba("#4a9ad8"))
    # Tiara of ice shards.
    shards = [(11, 3), (15, 6), (16, 6), (20, 3)] if fr.f in (FRONT, BACK) else [(11, 3), (14, 5), (17, 3)]
    if fr.f == LEFT:
        shards = [(31 - x, h) for x, h in shards]
    cells = set()
    for x, h in shards:
        cells |= line(x, t, x, t - h)
    cells |= rect(10 if fr.f in (FRONT, BACK) else 10, t, 21 if fr.f in (FRONT, BACK) else 18, t) if fr.f != LEFT else rect(13, t, 21, t)
    fr.shape(shade(cells, *ice, axis="y"), None)
    # White fur collar.
    b = fr.bob
    fur = rect(8, 27 - b, 23, 29 - b) if fr.f in (FRONT, BACK) else rect(9 if fr.f == RIGHT else 13, 27 - b, 18 if fr.f == RIGHT else 22, 29 - b)
    fr.shape({p: rgba("#ffffff") if (p[0] + p[1]) % 3 else rgba("#d0dcea") for p in fur}, None)
    # A floating ice crystal.
    if fr.f != BACK:
        hx, hy = HAND[fr.f]
        cy = hy - 7 - b
        dia = {(x, y) for x in range(hx - 2, hx + 3) for y in range(cy - 4, cy + 4) if abs(x - hx) * 2 + abs(y - cy) <= 4}
        fr.shape(shade(dia, *ice), None)


def radiant(fr):
    gold = [rgba("#b07a1a"), rgba("#f0c040"), rgba("#fff1a8")]
    fr.recolor(hair=gold, tunic=[rgba("#c8b890"), rgba("#f0e8d0"), rgba("#ffffff")])
    fr.trim_hair_below(31, [rgba("#c8b890"), rgba("#e8dcc0"), rgba("#ffffff")])
    t = HEAD_TOP - fr.bob
    # A great sun disc behind her head, with rays.
    cx, cy = (15.5, t + 4) if fr.f in (FRONT, BACK) else ((13, t + 4) if fr.f == RIGHT else (18, t + 4))
    sun = ring(cx, cy, 9, 1.6)
    for k in range(8):
        import math
        a = k * math.pi / 4
        sun |= line(round(cx + math.cos(a) * 9.5), round(cy + math.sin(a) * 9.5), round(cx + math.cos(a) * 12), round(cy + math.sin(a) * 12))
    fr.shape({p: rgba("#fff1a8") if (p[0] + p[1]) % 2 else rgba("#f0c040") for p in sun}, None, under=True, outline=False)
    # Sun sceptre.
    def top(fr, x, y):
        fr.shape({p: rgba("#fff1a8") if (p[0] - x - 0.5) ** 2 + (p[1] - y) ** 2 < 2 else rgba("#f0c040") for p in disc(x + 0.5, y, 2.5)}, None, under=fr.f == BACK)
    staff(fr, top, gold[::-1])


def gravemage(fr):
    hood = [rgba("#141a14"), rgba("#243024"), rgba("#3a4a36")]
    fr.recolor(hair=hood, tunic=[rgba("#1a221a"), rgba("#2a362a"), rgba("#4a5a44")])
    t = HEAD_TOP - fr.bob
    # A pointed hood over the head.
    if fr.f in (FRONT, BACK):
        peak = {(x, y) for x in range(11, 21) for y in range(t - 5, t + 1) if y >= t - 5 + abs(x - 15.5) * 1.1}
    else:
        peak = {(x, y) for x in range(9, 21) for y in range(t - 4, t + 1) if y >= t - 4 + abs(x - (12 if fr.f == RIGHT else 19)) * 0.6}
        if fr.f == LEFT:
            peak = {(31 - x, y) if False else (x, y) for x, y in peak}
    fr.shape(shade(peak, *hood[::-1]), None)
    # Bone skull mask over the face.
    if fr.f == FRONT:
        mask = rect(11, t + 6, 20, t + 11) - {(11, t + 11), (20, t + 11)}
        cells = {p: rgba("#e8e2cc") for p in mask}
        for p in rect(12, t + 7, 13, t + 8) | rect(18, t + 7, 19, t + 8):
            cells[p] = rgba("#1a0a0a")
        cells[(13, t + 8)] = rgba("#7aff8a"); cells[(18, t + 8)] = rgba("#7aff8a")
        for x in range(13, 19, 2):
            cells[(x, t + 11)] = rgba("#9a9480")
        fr.shape(cells, None, outline=False)
    elif fr.f in (RIGHT, LEFT):
        x0 = 15 if fr.f == RIGHT else 11
        mask = rect(x0, t + 6, x0 + 5, t + 11)
        cells = {p: rgba("#e8e2cc") for p in mask}
        ex = x0 + 3 if fr.f == RIGHT else x0 + 1
        cells[(ex, t + 8)] = rgba("#7aff8a"); cells[(ex, t + 7)] = rgba("#1a0a0a")
        fr.shape(cells, None, outline=False)
    # Scythe.
    def top(fr, x, y):
        side = -1 if fr.f in (LEFT, BACK) else 1
        blade = set()
        for k in range(8):
            yy = y + k // 3
            blade |= {(x - side * (k + 1), yy), (x - side * (k + 1), yy + 1)} if k < 7 else {(x - side * (k + 1), yy + 1)}
        fr.shape({p: rgba("#d8dccc") if p[1] <= y + 1 else rgba("#9aa094") for p in blade}, None, under=fr.f == BACK)
    staff(fr, top, [rgba("#6a5a46"), rgba("#4a3e30"), rgba("#2a221a")])


def arcanist(fr):
    fr.recolor(hair=[rgba("#3a2a10"), rgba("#6a4a1e"), rgba("#9a7034")], tunic=[rgba("#1a2a5a"), rgba("#2a4a9a"), rgba("#e8c040")])
    fr.trim_hair_below(28, [rgba("#14204a"), rgba("#1e3270"), rgba("#2a4a9a")])
    t = HEAD_TOP - fr.bob
    # Square scholar's cap with a gold tassel.
    if fr.f in (FRONT, BACK):
        cap = rect(8, t - 1, 23, t) | rect(11, t + 1, 20, t + 2)
        fr.shape({p: rgba("#2a3a7a") if p[1] >= t + 1 else rgba("#1a2450") for p in cap}, None)
        fr.shape(line(23, t, 24, t + 5), rgba("#e8c040"))
    else:
        cap = rect(7, t - 1, 22, t) | rect(10, t + 1, 19, t + 2)
        if fr.f == LEFT:
            cap = {(31 - x - 2, y) for x, y in cap}
        fr.shape({p: rgba("#2a3a7a") if p[1] >= t + 1 else rgba("#1a2450") for p in cap}, None)
    # Round spectacles.
    if fr.f == FRONT:
        for x in (12, 18):
            for p in ring(x + 0.5, t + 9, 1.6, 0.8):
                fr.put(*p, rgba("#e8c040"))
    # An open tome floating at her side, pages glowing.
    if fr.f != BACK:
        hx, hy = HAND[fr.f]
        bx = hx - 2 if fr.f != LEFT else hx - 3
        by = hy - 8 - fr.bob
        book = rect(bx, by, bx + 5, by + 3)
        cells = {p: rgba("#f4ecd0") for p in book}
        for p in rect(bx, by + 3, bx + 5, by + 3):
            cells[p] = rgba("#7a2a1a")
        cells[(bx + 2, by)] = cells[(bx + 3, by)] = rgba("#c8b890")
        for p in ((bx + 1, by + 1), (bx + 4, by + 1)):
            cells[p] = rgba("#5ad0ff")
        fr.shape(cells, None)
        fr.put(bx + 2, by - 2, rgba("#5ad0ff")); fr.put(bx + 4, by - 3, rgba("#e8c040"))


def ruinmage(fr):
    cowl = [rgba("#0e0614"), rgba("#1e0e2a"), rgba("#3a1a4a")]
    fr.recolor(hair=cowl, tunic=[rgba("#1a0a1e"), rgba("#2e1236"), rgba("#c02a3a")])
    t = HEAD_TOP - fr.bob
    horn = (rgba("#e0d8c8"), rgba("#a89a88"), rgba("#5a4e44"))
    # Two great horns curling up out of the cowl.
    for side in ((-1, 1) if fr.f in (FRONT, BACK) else ((1,) if fr.f == RIGHT else (-1,))):
        base_x = 15.5 + side * 6 if fr.f in (FRONT, BACK) else (12 if fr.f == RIGHT else 19)
        pts = set()
        for k in range(8):
            x = round(base_x + side * (k * 0.55 if k < 5 else 2.8 - (k - 5) * 0.4))
            y = t + 2 - k
            pts |= {(x, y), (x + (1 if side < 0 else -1) * (1 if k < 4 else 0), y)}
        fr.shape(shade(pts, *horn, axis="y"), None)
    # Shadowed face with burning eyes.
    if fr.f == FRONT:
        for p in rect(11, t + 6, 20, t + 10):
            c = fr.get(*p)
            if c and c[3] and c[:3] not in HAIR:
                fr.put(*p, rgba("#2a1430"))
        for x in (13, 18):
            fr.put(x, t + 8, rgba("#ff3a3a")); fr.put(x - 1 if x == 13 else x + 1, t + 8, rgba("#ff9a4a"))
    elif fr.f in (RIGHT, LEFT):
        x0 = 15 if fr.f == RIGHT else 11
        for p in rect(x0, t + 6, x0 + 5, t + 10):
            c = fr.get(*p)
            if c and c[3] and c[:3] not in HAIR:
                fr.put(*p, rgba("#2a1430"))
        fr.put(x0 + 3 if fr.f == RIGHT else x0 + 2, t + 8, rgba("#ff3a3a"))
    # Tattered hem.
    for x in range(8, 24, 3):
        y = 35 - fr.bob
        if fr.get(x, y) and fr.get(x, y)[3] and fr.get(x, y + 1) and fr.get(x, y + 1)[3] == 0:
            fr.put(x, y + 1, cowl[1]); fr.put(x, y + 2, OUT)
    # A void orb ringed with a red halo.
    if fr.f != BACK:
        hx, hy = HAND[fr.f]
        cy = hy - 7 - fr.bob
        fr.shape({p: rgba("#000000") for p in disc(hx, cy, 2)}, None, outline=False)
        for p in ring(hx, cy, 3.4, 0.9):
            if p[1] != cy - 3:
                fr.put(*p, rgba("#ff3a3a"))
        fr.put(hx - 1, cy - 1, rgba("#c09aff"))


def veilsinger(fr):
    hair = [rgba("#6a3a8a"), rgba("#a868c8"), rgba("#e0b8f4")]
    fr.recolor(hair=hair, tunic=[rgba("#4a2a5a"), rgba("#7a4a8a"), rgba("#d8c0e8")])
    t = HEAD_TOP - fr.bob
    veil = rgba("#f4e8ff")
    # A sheer veil from the crown down past the shoulders (every other pixel, so the hair shows through).
    for y in range(t - 1, 33 - fr.bob):
        for x in range(6, 26):
            c = fr.get(x, y)
            if c is None:
                continue
            on_edge = c[3] == 0 and any((fr.get(x + dx, y) or (0, 0, 0, 0))[3] for dx in (-1, 1))
            if c[3] and c[:3] in HAIR and (x + y) % 2 == 0:
                fr.put(x, y, veil)
    # Moon-flower in the hair.
    fx = 21 if fr.f in (FRONT, RIGHT) else 10
    fr.shape({(fx, t + 2): rgba("#ffffff"), (fx + 1, t + 2): rgba("#f0c0ff"), (fx, t + 3): rgba("#f0c0ff"), (fx + 1, t + 3): rgba("#ffe24a"), (fx - 1, t + 2): rgba("#f0c0ff"), (fx, t + 1): rgba("#f0c0ff")}, None)
    # A lyre held at the hip.
    hx, hy = HAND[fr.f]
    if fr.f != BACK:
        x0 = hx - 1 if fr.f != LEFT else hx - 3
        y0 = hy - 6 - fr.bob
        frame = line(x0, y0, x0, y0 + 5) | line(x0 + 4, y0, x0 + 4, y0 + 5) | rect(x0, y0 + 5, x0 + 4, y0 + 6) | {(x0 - 1, y0 - 1), (x0 + 5, y0 - 1)}
        fr.shape({p: rgba("#e8c040") for p in frame}, None)
        for x in range(x0 + 1, x0 + 4):
            for y in range(y0 + 1, y0 + 5):
                fr.put(x, y, rgba("#f4e8ff") if x % 2 else (0, 0, 0, 0))
        # Notes drifting up.
        fr.put(x0 + 6, y0 - 3, rgba("#e0b8f4")); fr.put(x0 + 6, y0 - 4, rgba("#e0b8f4")); fr.put(x0 + 7, y0 - 4, rgba("#e0b8f4"))


DESIGNS = {"embermage": embermage, "tidewitch": tidewitch, "stonecaller": stonecaller, "stormwitch": stormwitch, "frostweaver": frostweaver,
           "radiant": radiant, "gravemage": gravemage, "arcanist": arcanist, "ruinmage": ruinmage, "veilsinger": veilsinger}


def frame_pixels(img, x0, y0):
    px = img.load()
    return [[px[x0 + x, y0 + y] for x in range(FW)] for y in range(FH)]


def main(sheet_in, sheet_out, base_path="public/sprites/warrior_base.png"):
    sheet = Image.open(sheet_in).convert("RGBA")
    base = Image.open(base_path).convert("RGBA")
    for name, (sx, sy) in SLOTS.items():
        block = Image.new("RGBA", (128, 176), MAGENTA)
        for row in range(4):
            for f in range(4):
                src_row = RIGHT if row == LEFT else row
                px = frame_pixels(base, f * FW, src_row * FH)
                if row == LEFT:
                    px = [list(reversed(r)) for r in px]
                    # Paint as RIGHT then mirror, so the left facing is an exact mirror of the right.
                    px = [list(reversed(r)) for r in px]
                bob = 1 if f % 2 else 0
                fr = Frame(px, RIGHT if row == LEFT else row, bob)
                DESIGNS[name](fr)
                out = fr.px if row != LEFT else [list(reversed(r)) for r in fr.px]
                for y in range(FH):
                    for x in range(FW):
                        c = out[y][x]
                        block.putpixel((f * FW + x, row * FH + y), c if c[3] else MAGENTA)
        sheet.paste(block, (sx, sy))
    sheet.save(sheet_out)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
