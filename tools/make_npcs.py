"""Builds the shop NPC models + textures.

Run from the repo root:  python3 tools/make_npcs.py [--preview-dir DIR]
Writes, for each NPC <id>:
  SkyClans_RP/models/entity/npc_<id>.geo.json
  SkyClans_RP/textures/entity/npc_<id>.png

Every NPC is a player-shaped body (head, body, arms, legs - same proportions as a
Minecraft player) with a painted skin, plus extra parts (hats, capes, backpacks,
held items) made of cubes. Textures are painted at 2x detail: the model works in
64 x 128 texture units, the image is 128 x 256 pixels.
  units 0-64 (rows 0-64)   : the skin, laid out like a normal player skin
  units 64-128 (rows)      : 8x8-unit tiles for the extra parts (64 of them)
"""
import json
import math
import random
import sys
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
GEO_DIR = ROOT / "SkyClans_RP" / "models" / "entity"
TEX_DIR = ROOT / "SkyClans_RP" / "textures" / "entity"

U = 2  # pixels per texture unit
TW, TH = 64, 128  # texture size in units
TILE = 8  # tile size in units
rng = random.Random(11)


# ---------------------------------------------------------------- colour helpers
def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def shade(c, f):
    return tuple(max(0, min(255, int(v * f))) for v in c)


def mix(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


# ---------------------------------------------------------------- box faces (units)
def faces(u, v, w, h, d):
    """Rectangles (x, y, w, h) in units for each face of a box-UV cube at (u, v)."""
    return {
        "up": (u + d, v, w, d),
        "down": (u + d + w, v, w, d),
        "east": (u, v + d, d, h),
        "north": (u + d, v + d, w, h),
        "west": (u + d + w, v + d, d, h),
        "south": (u + 2 * d + w, v + d, w, h),
    }


class Canvas:
    def __init__(self):
        self.img = Image.new("RGBA", (TW * U, TH * U), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.img)

    def rect(self, x, y, w, h, col):
        """x, y, w, h in PIXELS (2 per unit)."""
        if w <= 0 or h <= 0:
            return
        self.d.rectangle([x, y, x + w - 1, y + h - 1], fill=tuple(col) + (255,))

    def px(self, x, y, col):
        self.img.putpixel((int(x), int(y)), tuple(col) + (255,))

    def noise(self, x, y, w, h, col, amt=0.12, dark=0.85, light=1.12):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                r = rng.random()
                c = shade(col, dark) if r < amt else shade(col, light) if r < amt * 1.8 else col
                self.px(xx, yy, c)

    def face(self, rect, col, amt=0.1):
        x, y, w, h = rect
        self.noise(x * U, y * U, w * U, h * U, col, amt)


# ---------------------------------------------------------------- the player body
# standard skin box positions (units)
BODY_PARTS = {
    "head": ((0, 0), (8, 8, 8)),
    "body": ((16, 16), (8, 12, 4)),
    "rightArm": ((40, 16), (4, 12, 4)),
    "leftArm": ((32, 48), (4, 12, 4)),
    "rightLeg": ((0, 16), (4, 12, 4)),
    "leftLeg": ((16, 48), (4, 12, 4)),
}


def part_faces(name):
    (u, v), (w, h, d) = BODY_PARTS[name]
    return faces(u, v, w, h, d)


def P(rect):
    """face rect (units) -> (x, y, w, h) in pixels"""
    x, y, w, h = rect
    return x * U, y * U, w * U, h * U


# ---------------------------------------------------------------- painting a person
def paint_head(cv, c):
    """c: skin, hair, (beard), eyes, (glow), (hood), (mouth: grin|smile|line), (brows)"""
    f = part_faces("head")
    hair = rgb(c["hair"])
    skin = rgb(c["skin"])
    hood = rgb(c["hood"]) if c.get("hood") else None
    top = hood or hair
    for k in ("up", "south", "east", "west"):
        cv.face(f[k], top, 0.18)
    # sides: lower half skin (or beard) unless hooded
    for k in ("east", "west"):
        x, y, w, h = P(f[k])
        if not hood:
            cv.noise(x, y + 6, w, 10, skin, 0.05)
            cv.rect(x, y + 6, 4, 4, hair)  # sideburn
            if c.get("beard"):
                cv.noise(x, y + 11, w, 5, rgb(c["beard"]), 0.15)
    cv.face(f["down"], skin, 0.05)

    # face (16 x 16 px)
    x, y, w, h = P(f["north"])
    cv.noise(x, y, w, h, skin, 0.06, 0.95, 1.04)
    if hood:
        cv.noise(x, y, w, 4, hood, 0.2)
        cv.noise(x, y, 2, h, hood, 0.2)
        cv.noise(x + 14, y, 2, h, hood, 0.2)
    else:
        cv.noise(x, y, w, 4, hair, 0.18)
        cv.rect(x, y + 4, 2, 3, hair)
        cv.rect(x + 14, y + 4, 2, 3, hair)
    brow = rgb(c.get("brows", c.get("beard", c["hair"])))
    cv.rect(x + 3, y + 5, 4, 1, brow)
    cv.rect(x + 9, y + 5, 4, 1, brow)
    # eyes
    eye = rgb(c["eyes"])
    if c.get("glow"):
        g = rgb(c["glow"])
        for ex in (3, 9):
            cv.rect(x + ex, y + 7, 4, 2, g)
            cv.rect(x + ex + 1, y + 7, 2, 2, eye)
    else:
        for ex in (4, 9):
            cv.rect(x + ex, y + 7, 3, 2, (245, 245, 245))
        cv.rect(x + 5, y + 7, 2, 2, eye)
        cv.rect(x + 9, y + 7, 2, 2, eye)
    # nose
    cv.rect(x + 7, y + 8, 2, 3, shade(skin, 0.85))
    # beard
    if c.get("beard"):
        b = rgb(c["beard"])
        cv.noise(x + 2, y + 11, 12, 5, b, 0.15)
        cv.noise(x + 3, y + 10, 3, 1, b, 0.1)
        cv.noise(x + 10, y + 10, 3, 1, b, 0.1)
        if c.get("long_beard"):
            cv.noise(x, y + 9, 2, 7, b, 0.15)
            cv.noise(x + 14, y + 9, 2, 7, b, 0.15)
    mouth = c.get("mouth", "grin")
    if mouth == "grin":
        cv.rect(x + 5, y + 12, 6, 2, (240, 240, 240))
        cv.rect(x + 5, y + 13, 6, 1, (200, 200, 205))
    elif mouth == "smile":
        cv.rect(x + 4, y + 12, 8, 2, (120, 30, 30))
        cv.rect(x + 5, y + 12, 6, 1, (245, 245, 245))
        cv.rect(x + 6, y + 13, 4, 1, (210, 80, 80))
    else:
        cv.rect(x + 5, y + 12, 6, 1, shade(skin, 0.6))


def paint_part(cv, name, base, amt=0.12):
    for k, r in part_faces(name).items():
        cv.face(r, rgb(base), amt)


def paint_hands(cv, arm, skin, cuff=None, bare_from=None):
    """Skin on the last 2 units of the arm (hands); bare_from = units from the top where skin starts."""
    f = part_faces(arm)
    start = (bare_from if bare_from is not None else 10) * U
    for k in ("north", "south", "east", "west"):
        x, y, w, h = P(f[k])
        cv.noise(x, y + start, w, h - start, rgb(skin), 0.05)
        if cuff:
            cv.rect(x, y + start - 2, w, 2, rgb(cuff))
    cv.face(f["down"], rgb(skin), 0.05)


def paint_boots(cv, leg, col, units=3):
    f = part_faces(leg)
    for k in ("north", "south", "east", "west"):
        x, y, w, h = P(f[k])
        cv.noise(x, y + h - units * U, w, units * U, rgb(col), 0.12)
        cv.rect(x, y + h - 2, w, 2, shade(rgb(col), 0.7))
    cv.face(f["down"], shade(rgb(col), 0.7), 0.05)


def front(name):
    return P(part_faces(name)["north"])


# ---------------------------------------------------------------- tiles for extra parts
class Tiles:
    """8x8-unit painted tiles in rows 64-128 of the texture."""

    def __init__(self, cv):
        self.cv = cv
        self.n = 0
        self.at = {}

    def add(self, key, painter):
        col, row = self.n % 8, self.n // 8
        self.n += 1
        u, v = col * TILE, 64 + row * TILE
        painter(self.cv, u * U, v * U, TILE * U)
        self.at[key] = (u, v)
        return key


def t_noise(col, amt=0.14):
    return lambda cv, x, y, s: cv.noise(x, y, s, s, rgb(col), amt)


def t_border(col, edge, inner=None):
    def p(cv, x, y, s):
        cv.noise(x, y, s, s, rgb(col), 0.1)
        e = rgb(edge)
        cv.rect(x, y, s, 2, e)
        cv.rect(x, y + s - 2, s, 2, e)
        cv.rect(x, y, 2, s, e)
        cv.rect(x + s - 2, y, 2, s, e)
        if inner:
            cv.rect(x + 6, y + 6, 4, 4, rgb(inner))
    return p


def t_glow(core, outer):
    def p(cv, x, y, s):
        for yy in range(s):
            for xx in range(s):
                d = max(abs(xx - 7.5), abs(yy - 7.5)) / 8
                cv.px(x + xx, y + yy, mix(rgb(core), rgb(outer), d))
    return p


def t_ore(stone, ore):
    def p(cv, x, y, s):
        cv.noise(x, y, s, s, rgb(stone), 0.25)
        for _ in range(5):
            ox, oy = rng.randrange(1, s - 3), rng.randrange(1, s - 3)
            cv.rect(x + ox, y + oy, 2, 2, rgb(ore))
            cv.px(x + ox + 1, y + oy, shade(rgb(ore), 1.25))
    return p


def t_bricks(brick, mortar):
    def p(cv, x, y, s):
        cv.rect(x, y, s, s, rgb(mortar))
        for row in range(4):
            off = 0 if row % 2 == 0 else 4
            for bx in range(-4, s, 8):
                xx = bx + off
                x0, x1 = max(0, xx), min(s, xx + 7)
                if x1 > x0:
                    cv.noise(x + x0, y + row * 4, x1 - x0, 3, rgb(brick), 0.15)
    return p


def t_planks(col):
    def p(cv, x, y, s):
        for row in range(4):
            cv.noise(x, y + row * 4, s, 4, shade(rgb(col), 1 - 0.06 * (row % 2)), 0.12)
            cv.rect(x, y + row * 4 + 3, s, 1, shade(rgb(col), 0.7))
    return p


def t_stonebrick(col):
    def p(cv, x, y, s):
        cv.noise(x, y, s, s, rgb(col), 0.2)
        d = shade(rgb(col), 0.65)
        cv.rect(x, y + 7, s, 1, d)
        cv.rect(x, y + 15, s, 1, d)
        cv.rect(x + 7, y, 1, 8, d)
        cv.rect(x + 3, y + 8, 1, 8, d)
        cv.rect(x + 12, y + 8, 1, 8, d)
    return p


def t_spawner(cv, x, y, s):
    cv.noise(x, y, s, s, rgb("#3a3742"), 0.15)
    cv.rect(x, y, s, 2, rgb("#5a5866"))
    cv.rect(x, y, 2, s, rgb("#5a5866"))
    cv.rect(x + 2, y + 2, s - 4, s - 4, rgb("#1a1620"))
    for ex, ey in ((4, 5), (10, 5)):
        cv.rect(x + ex, y + ey, 2, 2, rgb("#ffc23a"))
    cv.rect(x + 5, y + 10, 6, 1, rgb("#b45ae8"))
    cv.rect(x + 4, y + 11, 2, 1, rgb("#b45ae8"))
    cv.rect(x + 10, y + 11, 2, 1, rgb("#b45ae8"))


def t_text(bg, fg, text, border=None):
    FONT = {
        "K": ["1001", "1010", "1100", "1010", "1001"],
        "i": ["1", "0", "1", "1", "1"],
        "t": ["010", "111", "010", "010", "011"],
    }
    def p(cv, x, y, s):
        cv.noise(x, y, s, s, rgb(bg), 0.05)
        if border:
            b = rgb(border)
            cv.rect(x, y + 3, s, 1, b)
            cv.rect(x, y + 12, s, 1, b)
        cx = x + 2
        for ch in text:
            g = FONT[ch]
            for gy, row in enumerate(g):
                for gx, bit in enumerate(row):
                    if bit == "1":
                        cv.px(cx + gx, y + 5 + gy, rgb(fg))
            cx += len(g[0]) + 1
    return p


def t_circuit(base, line):
    def p(cv, x, y, s):
        cv.noise(x, y, s, s, rgb(base), 0.12)
        l = rgb(line)
        cv.rect(x + 2, y + 3, 6, 1, l)
        cv.rect(x + 7, y + 3, 1, 6, l)
        cv.rect(x + 7, y + 9, 6, 1, l)
        cv.rect(x + 3, y + 12, 1, 3, l)
    return p


def t_steak(cv, x, y, s):
    cv.noise(x, y, s, s, rgb("#9c2a22"), 0.15)
    m = rgb("#f0c8b8")
    for i in range(3, 13):
        cv.px(x + i, y + 4 + (i % 3), m)
        cv.px(x + 3 + (i % 4), y + i, m)
    cv.rect(x, y, s, 1, rgb("#6a1a16"))


def t_basket(cv, x, y, s):
    for yy in range(s):
        for xx in range(s):
            c = rgb("#d8a050") if ((xx // 2) + (yy // 2)) % 2 == 0 else rgb("#b07830")
            cv.px(x + xx, y + yy, c)


def t_chef(cv, x, y, s):
    cv.noise(x, y, s, s, rgb("#f4f1ea"), 0.12, 0.9, 1.0)
    for i in range(0, s, 4):
        cv.rect(x + i, y, 1, s, rgb("#dcd8cf"))


# ---------------------------------------------------------------- geometry helpers
def r2(v):
    return round(v, 3)


class Model:
    def __init__(self, tiles):
        self.tiles = tiles
        self.bones = {}
        self.order = []

    def bone(self, name, pivot, parent=None, rotation=None):
        b = {"name": name, "pivot": pivot, "cubes": []}
        if parent:
            b["parent"] = parent
        if rotation:
            b["rotation"] = rotation
        self.bones[name] = b
        self.order.append(name)
        return b

    def skin_cube(self, bone, part, origin, inflate=0):
        (u, v), (w, h, d) = BODY_PARTS[part]
        f = faces(u, v, w, h, d)
        cube = {"origin": origin, "size": [w, h, d], "uv": {k: {"uv": [r[0], r[1]], "uv_size": [r[2], r[3]]} for k, r in f.items()}}
        if inflate:
            cube["inflate"] = inflate
        self.bones[bone]["cubes"].append(cube)

    def cube(self, bone, origin, size, tile, rotation=None, pivot=None, inflate=0, face_tiles=None):
        """face_tiles: {"north": "kit"} puts a different tile on some faces."""
        w, h, d = size
        fit = lambda a, b: [r2(max(0.5, min(TILE, a))), r2(max(0.5, min(TILE, b)))]
        dims = {"north": (w, h), "south": (w, h), "east": (d, h), "west": (d, h), "up": (w, d), "down": (w, d)}
        uv = {}
        for k, v in dims.items():
            tu, tv = self.tiles.at[(face_tiles or {}).get(k, tile)]
            uv[k] = {"uv": [tu, tv], "uv_size": fit(*v)}
        cube = {"origin": [r2(n) for n in origin], "size": [r2(n) for n in size], "uv": uv}
        if rotation:
            cube["rotation"] = rotation
            cube["pivot"] = pivot or [origin[i] + size[i] / 2 for i in range(3)]
        if inflate:
            cube["inflate"] = inflate
        self.bones[bone]["cubes"].append(cube)

    def json(self, ident):
        bones = []
        for n in self.order:
            b = dict(self.bones[n])
            if not b["cubes"]:
                del b["cubes"]
            bones.append(b)
        return {
            "format_version": "1.16.0",
            "minecraft:geometry": [
                {
                    "description": {
                        "identifier": ident,
                        "texture_width": TW,
                        "texture_height": TH,
                        "visible_bounds_width": 4,
                        "visible_bounds_height": 3.5,
                        "visible_bounds_offset": [0, 1.25, 0],
                    },
                    "bones": bones,
                }
            ],
        }


def hand(m, name, arm, arm_rot, extra=None):
    """Bone at the hand that undoes the arm's forward tilt, so held items stand upright."""
    x = -5.9 if arm == "rightArm" else 5.9
    rx = -(arm_rot or [0, 0, 0])[0] + (extra or [0, 0, 0])[0]
    ry, rz = (extra or [0, 0, 0])[1], (extra or [0, 0, 0])[2]
    return m.bone(name, [x, 12, 0], arm, [rx, ry, rz])


def humanoid(m, right_arm=None, left_arm=None):
    """Standard player body. Arm rotations hold items up (negative x = forward)."""
    m.bone("root", [0, 0, 0])
    m.bone("body", [0, 24, 0], "root")
    m.skin_cube("body", "body", [-4, 12, -2])
    m.bone("head", [0, 24, 0], "body")
    m.skin_cube("head", "head", [-4, 24, -4])
    m.bone("rightArm", [-5, 22, 0], "body", right_arm)
    m.skin_cube("rightArm", "rightArm", [-8, 12, -2])
    m.bone("leftArm", [5, 22, 0], "body", left_arm)
    m.skin_cube("leftArm", "leftArm", [4, 12, -2])
    m.bone("rightLeg", [-1.9, 12, 0], "root")
    m.skin_cube("rightLeg", "rightLeg", [-3.9, 0, -2])
    m.bone("leftLeg", [1.9, 12, 0], "root")
    m.skin_cube("leftLeg", "leftLeg", [-0.1, 0, -2])


# ============================================================================ NPCs
# ============================================================================ v2 helpers (clean pixel art)
class Sheet:
    """Packs painted pieces into the free part of the texture (rows 64-128):
    8x8 tiles (sheet.tile) and whole painted boxes for big parts (sheet.box)."""

    def __init__(self, cv):
        self.cv = cv
        self.x, self.y, self.row_h = 0, 64, 0
        self.at = {}  # tile key -> (u, v)
        self.boxes = {}  # box key -> ((u, v), (w, h, d))
        self.n = 0

    def _alloc(self, w, h):
        if self.x + w > TW:
            self.x, self.y, self.row_h = 0, self.y + self.row_h, 0
        u, v = self.x, self.y
        self.x += w
        self.row_h = max(self.row_h, h)
        assert self.y + h <= TH, "texture sheet is full"
        return u, v

    def tile(self, key, painter):
        u, v = self._alloc(TILE, TILE)
        painter(self.cv, u * U, v * U, TILE * U)
        self.at[key] = (u, v)
        self.n += 1

    def box(self, key, size, painter):
        """painter(cv, faces_px) where faces_px[face] = (x, y, w, h) in pixels."""
        w, h, d = size
        u, v = self._alloc(2 * w + 2 * d, d + h)
        f = faces(u, v, w, h, d)
        painter(self.cv, {k: P(r) for k, r in f.items()})
        self.boxes[key] = ((u, v), size)


def flat(cv, rect, col, hi=None, lo=None, edge=None):
    """Flat colour with a light top / left edge and a darker bottom / right edge (pixels)."""
    x, y, w, h = rect
    cv.rect(x, y, w, h, col)
    if hi:
        cv.rect(x, y, w, 1, hi)
        cv.rect(x, y, 1, h, hi)
    if lo:
        cv.rect(x, y + h - 1, w, 1, lo)
        cv.rect(x + w - 1, y, 1, h, lo)
    if edge:
        cv.rect(x, y, w, 1, edge)
        cv.rect(x, y + h - 1, w, 1, edge)
        cv.rect(x, y, 1, h, edge)
        cv.rect(x + w - 1, y, 1, h, edge)


def speck(cv, rect, cols, n):
    """A few deliberate darker / lighter pixels (cloth texture) - not noise."""
    x, y, w, h = rect
    for _ in range(n):
        cv.px(x + rng.randrange(w), y + rng.randrange(h), rng.choice(cols))


def tile_flat(col, hi=None, lo=None, edge=None):
    return lambda cv, x, y, s: flat(cv, (x, y, s, s), rgb(col), hi and rgb(hi), lo and rgb(lo), edge and rgb(edge))


def tile_glow(core, mid, outer):
    def p(cv, x, y, s):
        for yy in range(s):
            for xx in range(s):
                d = max(abs(xx - 7.5), abs(yy - 7.5)) / 8
                c = mix(rgb(core), rgb(mid), min(1, d * 1.6)) if d < 0.6 else mix(rgb(mid), rgb(outer), (d - 0.6) / 0.4)
                cv.px(x + xx, y + yy, c)
    return p


def _box_cube(m, bone, origin, key, rotation=None, pivot=None, inflate=0):
    (u, v), (w, h, d) = m.tiles.boxes[key]
    f = faces(u, v, w, h, d)
    cube = {"origin": [r2(n) for n in origin], "size": [w, h, d],
            "uv": {k: {"uv": [r[0], r[1]], "uv_size": [r[2], r[3]]} for k, r in f.items()}}
    if rotation:
        cube["rotation"] = rotation
        cube["pivot"] = pivot or [origin[i] + (w, h, d)[i] / 2 for i in range(3)]
    if inflate:
        cube["inflate"] = inflate
    m.bones[bone]["cubes"].append(cube)


Model.box = _box_cube


def disc(m, bone, cx, cy, z, radius, depth, tile):
    """A round flat disc facing forward, made of 1-unit rows (pixel-art circle)."""
    for row in range(-radius, radius):
        yc = row + 0.5
        half = math.floor(math.sqrt(max(0, radius * radius - yc * yc)) + 0.35)
        if half <= 0:
            continue
        m.cube(bone, [cx - half, cy + row, z], [2 * half, 1, depth], tile)


def plus(m, bone, x, y, z, s, tile):
    """A plus-shaped sparkle."""
    m.cube(bone, [x - s * 1.5, y - s / 2, z], [s * 3, s, s], tile)
    m.cube(bone, [x - s / 2, y - s * 1.5, z], [s, s * 3, s], tile)


def chain(m, bone, pts, tile_a, tile_b):
    """Chain links along a list of points (alternating link directions)."""
    for i in range(len(pts) - 1):
        (x0, y0, z0), (x1, y1, z1) = pts[i], pts[i + 1]
        n = max(1, int(math.dist((x0, y0, z0), (x1, y1, z1)) / 1.0))
        for k in range(n):
            t = (k + 0.5) / n
            x, y, z = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z0 + (z1 - z0) * t
            yaw = math.degrees(math.atan2(x1 - x0, z1 - z0))
            pitch = math.degrees(math.atan2(y1 - y0, math.hypot(x1 - x0, z1 - z0)))
            m.cube(bone, [x - 0.25, y - 0.6, z - 0.25], [0.5, 1.2, 0.5], tile_a if k % 2 else tile_b,
                   rotation=[0, yaw, 90 - pitch if k % 2 else -pitch], pivot=[x, y, z])


# ============================================================================ Spawner Shop
def npc_spawner():
    """Spawner Shop: hooded purple wizard, glowing eyes, black beard, holds a spawner + lantern, portal orb behind."""
    cv = Canvas()
    paint_head(cv, {"skin": "#c8946a", "hair": "#1e1a24", "hood": "#221d2b", "beard": "#18141c", "eyes": "#5a2ae0", "glow": "#ffc23a", "brows": "#141018", "long_beard": True})
    robe, robe_d, robe_l, black = "#5a2a8a", "#3d1a63", "#8a4ac0", "#1c1822"
    paint_part(cv, "body", robe)
    x, y, w, h = front("body")
    cv.noise(x + 5, y, 6, h, rgb(black), 0.1)
    cv.rect(x + 4, y, 1, h, rgb(robe_l))
    cv.rect(x + 11, y, 1, h, rgb(robe_l))
    for i in range(6):  # chain necklace V
        cv.rect(x + 2 + i, y + i, 2, 1, rgb("#8a8a96"))
        cv.rect(x + 12 - i, y + i, 2, 1, rgb("#8a8a96"))
    cv.rect(x, y + 17, w, 2, rgb("#2a2630"))  # belt
    for arm in ("rightArm", "leftArm"):
        paint_part(cv, arm, robe)
        fx, fy, fw, fh = front(arm)
        cv.rect(fx, fy, fw, 3, rgb(robe_d))
        paint_hands(cv, arm, "#a8744e", cuff="#1c1822")
    for leg in ("rightLeg", "leftLeg"):
        paint_part(cv, leg, robe_d)
        fx, fy, fw, fh = front(leg)
        cv.noise(fx, fy, fw, 14, rgb(robe), 0.12)
        cv.rect(fx + (fw - 2 if leg == "rightLeg" else 0), fy, 2, 14, rgb(robe_l))
        paint_boots(cv, leg, "#2a2830", 3)

    t = Tiles(cv)
    t.add("pad", t_noise("#2a2633", 0.2))
    t.add("hood", t_noise("#221d2b", 0.22))
    t.add("spawner", t_spawner)
    t.add("chain", t_noise("#8a8a96", 0.3))
    t.add("lanternframe", t_noise("#2a2630", 0.15))
    t.add("lanternglow", t_glow("#fff2a0", "#f08a1a"))
    t.add("portal", t_glow("#c78aff", "#6a2ad0"))
    t.add("portalcore", t_glow("#fff6b0", "#ffb02a"))
    t.add("spark", t_glow("#e8d0ff", "#9a5af0"))

    m = Model(t)
    humanoid(m, right_arm=[-55, 0, 0], left_arm=[-20, 0, -5])
    m.bone("hood", [0, 24, 0], "head")
    m.cube("hood", [-4.5, 31, -4.5], [9, 1.5, 9], "hood")
    m.cube("hood", [-4.5, 24, 3.6], [9, 8, 1.5], "hood")
    m.cube("rightArm", [-8.8, 21, -2.8], [5.4, 3.5, 5.6], "pad")
    m.cube("leftArm", [3.4, 21, -2.8], [5.4, 3.5, 5.6], "pad")
    hand(m, "held", "rightArm", [-55, 0, 0], [0, 25, 0])
    m.cube("held", [-8.9, 11.5, -3], [6, 6, 6], "spawner")
    m.cube("held", [-6.3, 4, -0.4], [0.8, 8, 0.8], "chain")
    m.bone("lantern", [-5.9, 4, 0], "held")
    m.cube("lantern", [-7.4, 3, -1.5], [3, 1, 3], "lanternframe")
    m.cube("lantern", [-6.9, -1, -1], [2, 4, 2], "lanternglow")
    m.cube("lantern", [-7.4, -2, -1.5], [3, 1, 3], "lanternframe")
    m.bone("orb", [8, 28, 4], "body")
    m.bone("sparks", [0, 20, 0], "root")
    return cv, m


def npc_kits():
    """Kits Shop: blue-robed king, gold crown with blue gem, gold trims, cape, holds a Kit box + sword."""
    cv = Canvas()
    paint_head(cv, {"skin": "#e0a878", "hair": "#6a3e1e", "beard": "#6a3e1e", "eyes": "#2a3a9a", "brows": "#5a3418"})
    blue, blue_l, navy, gold = "#2f55a8", "#4a7ad0", "#262a4a", "#e0b040"
    paint_part(cv, "body", blue)
    x, y, w, h = front("body")
    cv.noise(x + 5, y + 2, 6, h - 2, rgb(blue_l), 0.08)
    cv.rect(x + 4, y, 1, h, rgb(gold))
    cv.rect(x + 11, y, 1, h, rgb(gold))
    for i in range(5):
        cv.rect(x + 3 + i, y + i, 2, 1, rgb(gold))
        cv.rect(x + 11 - i, y + i, 2, 1, rgb(gold))
    cv.rect(x + 7, y + 5, 2, 2, rgb("#5ad0ff"))
    cv.rect(x, y + 17, w, 3, rgb("#7a4a26"))
    cv.rect(x + 6, y + 17, 4, 3, rgb(gold))
    cv.rect(x + 7, y + 18, 2, 1, rgb("#3a6ad0"))
    for arm in ("rightArm", "leftArm"):
        paint_part(cv, arm, navy)
        fx, fy, fw, fh = front(arm)
        cv.noise(fx, fy, fw, 8, rgb(blue), 0.1)
        paint_hands(cv, arm, "#e0a878", cuff=gold)
    for leg in ("rightLeg", "leftLeg"):
        paint_part(cv, leg, navy)
        fx, fy, fw, fh = front(leg)
        cv.noise(fx, fy, fw, 16, rgb(blue_l), 0.08)
        cv.rect(fx + (fw - 1 if leg == "rightLeg" else 0), fy, 1, 16, rgb(gold))
        cv.rect(fx, fy + 15, fw, 1, rgb(gold))
        paint_boots(cv, leg, "#3a3a40", 3)

    t = Tiles(cv)
    t.add("gold", t_noise(gold, 0.15))
    t.add("blue", t_noise(blue, 0.12))
    t.add("cape", t_border(blue, gold))
    t.add("gem", t_glow("#c0f4ff", "#2a8ae0"))
    t.add("kit", t_text("#2f55a8", "#ffffff", "Kit", border=gold))
    t.add("leather", t_noise("#7a4a26", 0.15))
    t.add("blade", t_noise("#b8bcd0", 0.1))
    t.add("potion_c", t_glow("#d0fbff", "#30c8e8"))
    t.add("potion_m", t_glow("#ffd0f8", "#d040c0"))
    t.add("potion_g", t_glow("#e0ffd0", "#40c040"))

    m = Model(t)
    humanoid(m, right_arm=[-60, 0, 0], left_arm=[-10, 0, -4])
    m.bone("crown", [0, 32, 0], "head")
    m.cube("crown", [-4.25, 31.5, -4.25], [8.5, 2.5, 8.5], "blue")
    m.cube("crown", [-4.6, 30.6, -4.6], [9.2, 2, 9.2], "gold")
    for cx in (-4.6, -1, 2.6):
        m.cube("crown", [cx, 32.6, -4.7], [2, 2.2, 1], "gold")
    m.cube("crown", [-1, 31, -4.9], [2, 2, 0.5], "gem")
    # collar + epaulettes
    m.cube("body", [-5, 22.5, -2.6], [10, 1.5, 5.2], "gold")
    m.cube("rightArm", [-9, 21.5, -3], [6, 2, 6], "gold")
    m.cube("leftArm", [3, 21.5, -3], [6, 2, 6], "gold")
    # cape
    m.bone("cape", [0, 24, 2], "body", [6, 0, 0])
    m.cube("cape", [-6, 1, 2.2], [12, 22.5, 1], "cape")
    # belt pouches
    m.cube("body", [-3.5, 9.5, -3.2], [3, 3, 1.4], "leather")
    m.cube("body", [0.8, 9.5, -3.2], [3, 3, 1.4], "leather")
    m.cube("body", [-2.9, 12.5, -3.1], [1, 1.5, 1], "potion_g")
    m.cube("body", [1.6, 12.5, -3.1], [1, 1.5, 1], "potion_m")
    # Kit box + sword in the right hand
    hand(m, "held", "rightArm", [-60, 0, 0], [0, 20, 0])
    m.cube("held", [-9.9, 12, -3], [8, 5, 6], "blue", face_tiles={"north": "kit"})
    m.cube("held", [-9, 17, -1.5], [1.5, 2.5, 1.5], "potion_c")
    m.cube("held", [-6.5, 17, -0.5], [1.5, 2, 1.5], "potion_m")
    m.cube("held", [-4.5, 17, -2], [1.5, 2, 1.5], "potion_g")
    # sword hanging from the hand, pointing down and out
    m.bone("sword", [-5.9, 11, 0], "held", [0, 0, -35])
    m.cube("sword", [-7.4, 9.5, -1.5], [3, 1, 1], "gold")
    m.cube("sword", [-6.4, 10.5, -1.5], [1, 2, 1], "leather")
    m.cube("sword", [-6.4, 0, -1.5], [1, 9.5, 1], "blade")
    return cv, m


def npc_ores():
    """Ores Shop: miner with grey hard hat + goggles, brown beard, orange straps, diamond pickaxe, ore backpack + lantern."""
    cv = Canvas()
    paint_head(cv, {"skin": "#e0a070", "hair": "#6a3e1e", "beard": "#6a3e1e", "eyes": "#202028", "mouth": "line"})
    grey, orange = "#8a8f96", "#d87a2a"
    paint_part(cv, "body", grey)
    x, y, w, h = front("body")
    cv.noise(x, y, w, 3, rgb("#e0a070"), 0.05)
    for sx in (3, 11):
        cv.rect(x + sx, y, 2, 18, rgb(orange))
    cv.rect(x, y + 18, w, 2, rgb("#6a3e1e"))
    cv.rect(x + 6, y + 18, 4, 2, rgb("#b0b4b8"))
    for arm in ("rightArm", "leftArm"):
        paint_part(cv, arm, "#e0a070", 0.04)
        paint_hands(cv, arm, "#e0a070", bare_from=0)
        fx, fy, fw, fh = front(arm)
        cv.rect(fx, fy + 14, fw, 4, rgb(grey))
        cv.rect(fx, fy + 15, fw, 1, rgb(orange))
    for leg in ("rightLeg", "leftLeg"):
        paint_part(cv, leg, "#4a3226")
        paint_boots(cv, leg, "#5a5c62", 3)

    t = Tiles(cv)
    t.add("hat", t_noise("#9aa0a6", 0.15))
    t.add("orange", t_noise(orange, 0.12))
    t.add("lens", t_glow("#fff6b0", "#e8b020"))
    t.add("grey", t_noise(grey, 0.12))
    t.add("pack", t_planks("#c89a3a"))
    t.add("coal", t_ore("#3a3a3e", "#141416"))
    t.add("iron", t_ore("#8a8a8e", "#d8b898"))
    t.add("diamond", t_noise("#6ee0f0", 0.25))
    t.add("goldb", t_noise("#f0c030", 0.2))
    t.add("handle", t_noise("#7a4a26", 0.15))
    t.add("pick", t_noise("#4ad0d8", 0.12))
    t.add("lanternframe", t_noise("#2a2630", 0.15))
    t.add("lanternglow", t_glow("#fff2a0", "#f08a1a"))

    m = Model(t)
    humanoid(m, right_arm=[-50, 0, 0], left_arm=[10, 0, -6])
    m.bone("hat", [0, 32, 0], "head")
    m.cube("hat", [-4.5, 30.5, -4.5], [9, 3.5, 9], "hat")
    m.cube("hat", [-5.5, 30, -5.5], [11, 0.8, 11], "hat")
    m.cube("hat", [-4.6, 30.8, -4.8], [9.2, 1.4, 0.6], "orange")
    m.cube("hat", [-3.6, 30.6, -5.3], [2.6, 2, 0.8], "lens")
    m.cube("hat", [1, 30.6, -5.3], [2.6, 2, 0.8], "lens")
    m.cube("rightArm", [-8.6, 20.5, -2.6], [5.2, 3.5, 5.2], "orange")
    m.cube("leftArm", [3.4, 20.5, -2.6], [5.2, 3.5, 5.2], "orange")
    m.cube("rightLeg", [-4.1, 5, -2.6], [4.4, 3, 1], "orange")
    m.cube("leftLeg", [-0.3, 5, -2.6], [4.4, 3, 1], "orange")
    # diamond pickaxe
    hand(m, "held", "rightArm", [-50, 0, 0], [0, 0, 15])
    m.cube("held", [-6.4, 6, -0.5], [1, 17, 1], "handle")
    m.cube("held", [-10.9, 22, -1], [10, 2, 2], "pick")
    m.cube("held", [-11.9, 20, -1], [2, 2, 2], "pick")
    m.cube("held", [-1.9, 20, -1], [2, 2, 2], "pick")
    # backpack with ores + lantern
    m.bone("pack", [0, 22, 4], "body")
    m.cube("pack", [-5, 9, 2], [10, 13, 6], "pack")
    m.cube("pack", [-5.3, 20, 1.8], [10.6, 1, 6.4], "grey")
    m.cube("pack", [-4.5, 22, 2.5], [4, 4, 4], "coal")
    m.cube("pack", [0, 22, 3], [4, 3.5, 4], "iron")
    m.cube("pack", [-3, 24.5, 4], [3.5, 3.5, 3.5], "diamond")
    m.cube("pack", [1.5, 25, 3.5], [3.5, 3.5, 3.5], "goldb")
    m.cube("pack", [5, 14, 4.5], [1, 1, 1], "grey")
    m.bone("lantern", [5.5, 14, 5], "pack")
    m.cube("lantern", [4.5, 11.5, 4], [2.5, 1, 2.5], "lanternframe")
    m.cube("lantern", [5, 8, 4.5], [1.5, 3.5, 1.5], "lanternglow")
    m.cube("lantern", [4.5, 7, 4], [2.5, 1, 2.5], "lanternframe")
    return cv, m


def npc_blocks():
    """Blocks Shop: builder in orange overalls, striped shirt, holds a pallet of stone bricks, brick backpack + ruler."""
    cv = Canvas()
    paint_head(cv, {"skin": "#e8b088", "hair": "#7a4422", "beard": "#6a3a1c", "eyes": "#2a2420", "mouth": "line"})
    shirt, stripe, overall = "#e0e0e0", "#a8a8a8", "#c8641e"
    paint_part(cv, "body", shirt)
    x, y, w, h = front("body")
    for sy in range(0, h, 4):
        cv.rect(x, y + sy, w, 2, rgb(stripe))
    cv.noise(x + 2, y + 4, 12, h - 4, rgb(overall), 0.08)
    cv.rect(x + 2, y, 2, 4, rgb(overall))
    cv.rect(x + 12, y, 2, 4, rgb(overall))
    cv.rect(x + 3, y + 5, 2, 2, rgb("#9a9a9a"))
    cv.rect(x + 11, y + 5, 2, 2, rgb("#9a9a9a"))
    cv.rect(x + 5, y + 10, 6, 2, rgb("#e0a040"))
    for arm in ("rightArm", "leftArm"):
        paint_part(cv, arm, "#e8b088", 0.04)
        fx, fy, fw, fh = front(arm)
        for k in ("north", "south", "east", "west"):
            ax, ay, aw, ah = P(part_faces(arm)[k])
            cv.noise(ax, ay, aw, 9, rgb("#e8cc90"), 0.1)
        paint_hands(cv, arm, "#e8b088", bare_from=5)
    for leg in ("rightLeg", "leftLeg"):
        paint_part(cv, leg, "#4a2e28")
        fx, fy, fw, fh = front(leg)
        cv.noise(fx, fy, fw, 10, rgb(overall), 0.08)
        paint_boots(cv, leg, "#5a5c62", 3)

    t = Tiles(cv)
    t.add("stonebrick", t_stonebrick("#9a9a9e"))
    t.add("planks", t_planks("#e0c070"))
    t.add("bricks", t_bricks("#b4502a", "#c8c0b0"))
    t.add("metal", t_noise("#7a7c82", 0.12))
    t.add("ruler", t_text("#f0d020", "#202020", "Kit") if False else t_noise("#f0d020", 0.08))
    t.add("overall", t_noise(overall, 0.1))

    m = Model(t)
    humanoid(m, right_arm=[-70, 15, 0], left_arm=[-70, -15, 0])
    # pallet of stone bricks held in front
    m.bone("held", [0, 12, -6], "body")
    m.cube("held", [-7, 11, -14], [14, 1.5, 9], "planks")
    m.cube("held", [-6, 10, -13], [2, 1, 7], "planks")
    m.cube("held", [-1, 10, -13], [2, 1, 7], "planks")
    m.cube("held", [4, 10, -13], [2, 1, 7], "planks")
    for row in range(2):
        for col in range(3):
            m.cube("held", [-6.5 + col * 4.4, 12.5 + row * 3, -13 + (row % 2)], [4.2, 2.8, 7], "stonebrick")
    m.cube("held", [-4, 18.5, -12], [4.2, 2.8, 6], "stonebrick")
    m.cube("held", [0.5, 18.5, -12], [4.2, 2.8, 6], "stonebrick")
    # brick backpack + frame + ruler
    m.bone("pack", [0, 22, 4], "body")
    m.cube("pack", [-5, 8, 2], [10, 14, 6], "bricks")
    m.cube("pack", [5, 4, 4], [1, 20, 1], "metal")
    m.cube("pack", [-5.5, 18, 1.6], [11, 1, 7], "metal")
    m.cube("pack", [-5.5, 11, 1.6], [11, 1, 7], "metal")
    m.cube("pack", [-3, 22, 3], [3, 3, 3], "metal")
    m.cube("pack", [1.5, 20, 5], [1.2, 9, 0.6], "ruler", rotation=[0, 0, -15])
    return cv, m


def npc_redstone():
    """Redstone Shop: engineer with goggles (red lenses), dark coat with glowing red circuits, redstone torch, shoulder device."""
    cv = Canvas()
    paint_head(cv, {"skin": "#d8a078", "hair": "#6a3a20", "eyes": "#e03a2a", "mouth": "grin", "brows": "#5a3018"})
    coat, red = "#3a3a3e", "#ff3a2a"
    paint_part(cv, "body", coat)
    x, y, w, h = front("body")
    cv.noise(x + 5, y, 6, 18, rgb("#c8c8cc"), 0.12)
    cv.rect(x + 4, y, 1, 18, rgb("#5a3a2a"))
    cv.rect(x + 11, y, 1, 18, rgb("#5a3a2a"))
    for (lx, ly, lw, lh) in ((1, 3, 1, 6), (1, 9, 3, 1), (13, 2, 2, 1), (14, 2, 1, 8), (2, 20, 1, 4), (12, 19, 3, 1)):
        cv.rect(x + lx, y + ly, lw, lh, rgb(red))
    cv.rect(x, y + 18, w, 2, rgb("#5a5c62"))
    for arm in ("rightArm", "leftArm"):
        paint_part(cv, arm, coat)
        fx, fy, fw, fh = front(arm)
        cv.rect(fx + 2, fy + 3, 1, 8, rgb(red))
        cv.rect(fx + 2, fy + 11, 4, 1, rgb(red))
        paint_hands(cv, arm, "#d8a078")
    for leg in ("rightLeg", "leftLeg"):
        paint_part(cv, leg, "#2a2a2e")
        fx, fy, fw, fh = front(leg)
        cv.rect(fx + 2, fy + 2, 1, 6, rgb(red))
        paint_boots(cv, leg, "#1c1c20", 3)

    t = Tiles(cv)
    t.add("frame", t_noise("#5a5c62", 0.12))
    t.add("lens", t_glow("#ffd0a0", "#e03a1a"))
    t.add("device", t_border("#6a6c72", "#4a4c52", inner="#ff3a2a"))
    t.add("coat", t_circuit("#3a3a3e", "#ff3a2a"))
    t.add("stick", t_noise("#5a3a20", 0.15))
    t.add("torch", t_glow("#ffe060", "#e02010"))
    t.add("led", t_glow("#fff0a0", "#ff8a1a"))
    t.add("cable", t_noise("#4a4c52", 0.2))

    m = Model(t)
    humanoid(m, right_arm=[-60, 0, 0], left_arm=[-5, 0, -4])
    m.bone("goggles", [0, 28, 0], "head")
    m.cube("goggles", [-3.8, 26.5, -4.9], [3.2, 2.6, 1], "frame")
    m.cube("goggles", [0.6, 26.5, -4.9], [3.2, 2.6, 1], "frame")
    m.cube("goggles", [-3.3, 27, -5.1], [2.2, 1.6, 0.5], "lens")
    m.cube("goggles", [1.1, 27, -5.1], [2.2, 1.6, 0.5], "lens")
    m.cube("goggles", [-0.6, 27.8, -5], [1.2, 0.6, 0.8], "frame")
    m.cube("goggles", [3.8, 26.8, -4.2], [1, 2, 3], "frame")
    m.cube("goggles", [-4.8, 26.8, -4.2], [1, 2, 3], "frame")
    # shoulder device + cable
    m.cube("leftArm", [3.2, 19.5, -3], [5.6, 5, 6], "device")
    m.cube("leftArm", [5, 24.5, -0.5], [1, 3, 1], "cable")
    m.cube("rightArm", [-8.6, 20.5, -2.6], [5.2, 3.5, 5.2], "coat")
    # gadgets on the belt
    m.cube("body", [2, 9.5, -3.4], [3, 3.5, 1.6], "device")
    m.cube("body", [-5.5, 8, -3.2], [3, 4, 1.6], "frame")
    m.cube("body", [-5.2, 9, -3.4], [2.4, 0.8, 0.4], "led")
    # redstone torch
    hand(m, "held", "rightArm", [-60, 0, 0], [0, 0, 10])
    m.cube("held", [-6.5, 8, -0.6], [1.2, 10, 1.2], "stick")
    m.cube("held", [-6.9, 18, -1], [2, 2, 2], "torch")
    m.bone("flame", [-5.9, 21, 0], "held")
    m.cube("flame", [-6.4, 20.5, -0.5], [1, 1, 1], "torch", rotation=[45, 0, 45])
    return cv, m


def npc_food():
    """Food Shop: chef with a puffy white hat, big smile, white apron with red trim, steak on a fork, basket of food."""
    cv = Canvas()
    paint_head(cv, {"skin": "#e8b088", "hair": "#7a4422", "eyes": "#2a2420", "mouth": "smile", "brows": "#6a3a1c"})
    cream, apron, red = "#f0e6c8", "#f6f1e4", "#c8302a"
    paint_part(cv, "body", cream)
    x, y, w, h = front("body")
    cv.noise(x + 2, y + 4, 12, h - 4, rgb(apron), 0.05)
    cv.rect(x + 2, y + 4, 12, 1, rgb(red))
    cv.rect(x + 2, y + 4, 1, h - 4, rgb(red))
    cv.rect(x + 13, y + 4, 1, h - 4, rgb(red))
    cv.rect(x + 3, y, 1, 4, rgb(red))
    cv.rect(x + 12, y, 1, 4, rgb(red))
    cv.rect(x + 9, y + 8, 3, 3, rgb("#e8d0a0"))
    cv.rect(x, y + 18, w, 2, rgb("#7a4a26"))
    for arm in ("rightArm", "leftArm"):
        paint_part(cv, arm, "#e8b088", 0.04)
        for k in ("north", "south", "east", "west"):
            ax, ay, aw, ah = P(part_faces(arm)[k])
            cv.noise(ax, ay, aw, 8, rgb(cream), 0.08)
            cv.rect(ax, ay + 8, aw, 1, rgb(red))
        paint_hands(cv, arm, "#e8b088", bare_from=5)
    for leg in ("rightLeg", "leftLeg"):
        paint_part(cv, leg, red)
        fx, fy, fw, fh = front(leg)
        cv.noise(fx, fy, fw, 12, rgb(apron), 0.05)
        cv.rect(fx, fy + 11, fw, 1, rgb(red))
        paint_boots(cv, leg, "#5a4434", 3)

    t = Tiles(cv)
    t.add("chef", t_chef)
    t.add("fork", t_noise("#a8acb4", 0.1))
    t.add("steak", t_steak)
    t.add("basket", t_basket)
    t.add("carrot", t_noise("#f08a2a", 0.15))
    t.add("leaf", t_noise("#5ac83a", 0.15))
    t.add("bread", t_noise("#e0a050", 0.15))
    t.add("apple", t_noise("#d82a2a", 0.12))
    t.add("potato", t_noise("#e8d08a", 0.15))

    m = Model(t)
    humanoid(m, right_arm=[-55, 0, 0], left_arm=[-40, 0, 0])
    m.bone("hat", [0, 32, 0], "head")
    m.cube("hat", [-4.4, 31, -4.4], [8.8, 3, 8.8], "chef")
    m.cube("hat", [-5, 34, -5], [10, 3, 10], "chef")
    m.cube("hat", [-4.5, 37, -4.5], [4.5, 2, 4.5], "chef")
    m.cube("hat", [0.3, 37, -4], [4.5, 2.5, 4.5], "chef")
    m.cube("hat", [-3, 37, 0.5], [5, 2.2, 4], "chef")
    # steak on a fork
    hand(m, "held", "rightArm", [-55, 0, 0], [0, 0, 10])
    m.cube("held", [-6.4, 8, -0.5], [1, 9, 1], "fork")
    m.cube("held", [-9.9, 17, -1], [8, 7, 2], "steak")
    m.cube("held", [-8.9, 16, -0.8], [6, 9, 1.6], "steak")
    # basket of food in the left hand
    hand(m, "basket", "leftArm", [-40, 0, 0])
    m.cube("basket", [2, 8, -4], [10, 4.5, 7], "basket")
    for i, (fx, fz, tile, s) in enumerate(((3, -3, "carrot", 2.4), (5.5, -2, "bread", 3), (8.5, -3, "apple", 2.4), (4, 0, "potato", 2.4), (7.5, 0.2, "bread", 3))):
        m.cube("basket", [fx, 12.5, fz], [s, s * 0.8, s], tile)
    m.cube("basket", [3.5, 14.5, -2.6], [1, 1.2, 1], "leaf")
    m.cube("basket", [9, 14.5, -2.6], [1, 1, 1], "leaf")
    return cv, m


def t_sunflower(cv, x, y, s):
    cv.noise(x, y, s, s, rgb("#f0c020"), 0.15)
    for i in range(0, s, 4):
        cv.rect(x + i, y, 1, s, rgb("#d8a010"))
    cv.rect(x + 5, y + 5, 6, 6, rgb("#7a4a1a"))
    cv.rect(x + 6, y + 6, 4, 4, rgb("#5a3412"))


def t_straw(cv, x, y, s):
    cv.noise(x, y, s, s, rgb("#e8c870"), 0.18)
    for i in range(0, s, 2):
        cv.rect(x + i, y + s - 3 - (i % 4 == 0), 1, 3, rgb("#c8a040"))


def t_sack(cv, x, y, s):
    for yy in range(s):
        for xx in range(s):
            c = rgb("#c8a060") if (xx + yy) % 2 == 0 else rgb("#b8904e")
            cv.px(x + xx, y + yy, shade(c, 0.95 + rng.random() * 0.1))


def t_wheat(cv, x, y, s):
    cv.noise(x, y, s, s, rgb("#e8b830"), 0.2)
    for i in range(0, s, 3):
        cv.rect(x + i, y, 1, s, rgb("#c89020"))


def npc_farming():
    """Farming Shop: farmer with a sunflower crown, green overalls, straw shirt, gold hoe on a staff, sack of wheat + rake."""
    cv = Canvas()
    paint_head(cv, {"skin": "#e8b088", "hair": "#7a4422", "beard": "#6a3a1c", "eyes": "#2a2420", "mouth": "grin", "brows": "#5a3018"})
    straw, green, green_l = "#e8c870", "#6aa03a", "#8ac05a"
    paint_part(cv, "body", straw, 0.18)
    x, y, w, h = front("body")
    cv.noise(x + 2, y + 6, 12, h - 6, rgb(green), 0.1)
    cv.rect(x + 2, y, 2, 6, rgb(green))
    cv.rect(x + 12, y, 2, 6, rgb(green))
    cv.rect(x + 3, y + 6, 2, 2, rgb("#f08a2a"))
    cv.rect(x + 11, y + 6, 2, 2, rgb("#f08a2a"))
    cv.noise(x + 5, y + 9, 6, 4, rgb(green_l), 0.08)
    cv.rect(x + 5, y + 9, 6, 1, rgb("#d8e8c0"))
    cv.rect(x, y + 18, w, 2, rgb("#7a4a26"))
    for arm in ("rightArm", "leftArm"):
        paint_part(cv, arm, "#e8b088", 0.04)
        for k in ("north", "south", "east", "west"):
            ax, ay, aw, ah = P(part_faces(arm)[k])
            cv.noise(ax, ay, aw, 7, rgb(straw), 0.18)
        paint_hands(cv, arm, "#e8b088", bare_from=4)
    for leg in ("rightLeg", "leftLeg"):
        paint_part(cv, leg, green)
        for k in ("north", "south", "east", "west"):
            lx, ly, lw, lh = P(part_faces(leg)[k])
            for i in range(0, lw, 2):
                cv.rect(lx + i, ly + 15, 1, 2 + (i % 4 == 0), rgb(straw))
        paint_boots(cv, leg, "#5a3a22", 4)

    t = Tiles(cv)
    t.add("sunflower", t_sunflower)
    t.add("leaf", t_noise("#5ac83a", 0.15))
    t.add("straw", t_straw)
    t.add("staff", t_noise("#9a6030", 0.12))
    t.add("goldblade", t_noise("#e8b020", 0.15))
    t.add("metal", t_noise("#a0a4ac", 0.1))
    t.add("sack", t_sack)
    t.add("wheat", t_wheat)
    t.add("carrot", t_noise("#f08a2a", 0.15))

    m = Model(t)
    humanoid(m, right_arm=[-25, 0, 0], left_arm=[0, 0, -6])
    # sunflower crown
    m.bone("crown", [0, 32, 0], "head")
    m.cube("crown", [-4.6, 31, -4.6], [9.2, 1, 9.2], "leaf")
    for i, (cx, cz) in enumerate(((-4.8, -4.9), (-1.6, -5), (1.6, -4.9), (4.0, -2), (4.0, 1.6), (-5.6, -1.8), (-5.6, 1.6), (-1.6, 3.9))):
        m.cube("crown", [cx, 31.4, cz], [2.6, 2.6, 1], "sunflower", rotation=[0, 0 if abs(cz) > 3.5 else 90, 0])
    # straw fringes on the shoulders + belt
    m.cube("rightArm", [-8.8, 19, -2.8], [5.6, 4.5, 5.6], "straw")
    m.cube("leftArm", [3.2, 19, -2.8], [5.6, 4.5, 5.6], "straw")
    m.cube("body", [3, 6, -2.6], [1.5, 4, 1], "straw")
    m.cube("body", [-1.2, 9.5, -3.2], [2.4, 2.4, 1.2], "carrot")
    m.cube("body", [-0.6, 11.9, -2.9], [1.2, 1, 0.6], "leaf")
    m.cube("body", [-4.2, 9.8, -2.8], [2, 2, 0.8], "sunflower")
    # gold hoe on a long staff (right hand, resting on the ground)
    hand(m, "held", "rightArm", [-25, 0, 0])
    m.cube("held", [-6.5, -11.5, -0.6], [1.2, 37, 1.2], "staff")
    m.cube("held", [-6.9, 22.5, -1], [2, 2, 2], "goldblade")
    m.cube("held", [-12.9, 24.5, -1], [8, 2.2, 2], "goldblade")
    m.cube("held", [-12.9, 21.5, -1], [2, 3, 2], "metal")
    m.cube("held", [-10.4, 22, -1], [1.5, 2.5, 2], "metal")
    # sack of wheat + rake on the back
    m.bone("pack", [0, 22, 4], "body")
    m.cube("pack", [-5.5, 8, 2], [11, 13, 7], "sack")
    m.cube("pack", [-4.5, 21, 3], [9, 2, 5], "sack")
    for i, wx in enumerate((-4, -1.5, 1, 3.2)):
        m.cube("pack", [wx, 23, 4 + (i % 2)], [1, 6 + (i % 2) * 2, 1], "leaf")
        m.cube("pack", [wx - 0.4, 28 + (i % 2) * 2, 3.6 + (i % 2)], [1.8, 4, 1.8], "wheat")
    m.cube("pack", [2.5, 21, 6], [1, 12, 1], "staff", rotation=[0, 0, -20])
    m.cube("pack", [3.5, 32, 5], [5, 1, 3], "metal", rotation=[0, 0, -20])
    m.cube("pack", [5.6, 12, 6], [2.4, 2.4, 2.4], "carrot")
    m.cube("pack", [5.9, 14.4, 6.6], [1.4, 1.4, 0.8], "leaf")
    return cv, m

# ============================================================================ extra 3D parts
def face3d(m, skin, beard=None, nose_y=27.4):
    """3D nose, and a beard + moustache around the mouth (mouth left showing)."""
    tl = m.tiles
    tl.add("x_skin", t_noise(skin, 0.05))
    m.cube("head", [-1, nose_y, -4.7], [2, 1.6, 0.8], "x_skin")
    if beard:
        tl.add("x_beard", t_noise(beard, 0.2))
        m.cube("head", [-4.1, 24, -4.6], [2.3, 3.2, 0.7], "x_beard")  # left cheek
        m.cube("head", [1.8, 24, -4.6], [2.3, 3.2, 0.7], "x_beard")  # right cheek
        m.cube("head", [-4.1, 23.4, -4.6], [8.2, 1.6, 0.8], "x_beard")  # chin (below the mouth)
        m.cube("head", [-2.4, 26.1, -4.55], [4.8, 0.6, 0.6], "x_beard")  # moustache
        m.cube("head", [-2.5, 22.2, -4.4], [5, 1.4, 1.2], "x_beard")  # beard point


def pumpkin(m, bone, x, z, s, rot=0):
    m.cube(bone, [x - s / 2, 0, z - s / 2], [s, s * 0.8, s], "x_pumpkin", rotation=[0, rot, 0], pivot=[x, 0, z])
    for dx in (-s / 4, s / 4):
        m.cube(bone, [x + dx - 0.3, 0.1, z - s / 2 - 0.2], [0.6, s * 0.75, 0.3], "x_pumpkin_d", rotation=[0, rot, 0], pivot=[x, 0, z])
    m.cube(bone, [x - 0.5, s * 0.8, z - 0.5], [1, 1.4, 1], "x_stem")
    m.cube(bone, [x + 0.5, s * 0.8 + 0.8, z - 0.5], [1.6, 0.6, 1], "x_stem")


def critter(m, bone, x, z, body, spot, yaw):
    """A little blocky animal (cow / pig) at the NPC's feet."""
    piv = [x, 0, z]
    r = [0, yaw, 0]
    m.cube(bone, [x - 2.5, 2, z - 1.5], [5, 3, 3], body, rotation=r, pivot=piv)
    m.cube(bone, [x - 4.5, 3, z - 1.25], [2.5, 2.5, 2.5], body, rotation=r, pivot=piv)
    m.cube(bone, [x - 5, 3.4, z - 0.75], [0.6, 1, 1.5], spot, rotation=r, pivot=piv)  # snout
    for lx, lz in ((-2, -1.2), (1.3, -1.2), (-2, 0.6), (1.3, 0.6)):
        m.cube(bone, [x + lx, 0, z + lz], [0.7, 2, 0.6], body, rotation=r, pivot=piv)
    m.cube(bone, [x - 4, 5.5, z - 1.2], [0.7, 0.8, 0.5], spot, rotation=r, pivot=piv)  # ears
    m.cube(bone, [x - 4, 5.5, z + 0.7], [0.7, 0.8, 0.5], spot, rotation=r, pivot=piv)
    m.cube(bone, [x - 1, 4.9, z - 1.6], [2, 0.2, 1.2], spot, rotation=r, pivot=piv)  # patch


def x_spawner(m):
    tl = m.tiles
    tl.add("x_robe", t_border("#5a2a8a", "#8a4ac0"))
    tl.add("x_belt", t_noise("#2a2630", 0.15))
    tl.add("x_ring", t_noise("#8a4ae8", 0.08))
    tl.add("x_ring2", t_noise("#a86cf6", 0.08))
    tl.add("x_mid", t_noise("#f08ad8", 0.06))
    tl.add("x_core", t_noise("#ffd23a", 0.06))
    tl.add("x_hot", t_noise("#fff6b8", 0.04))
    tl.add("x_spark_o", t_noise("#ff9a30", 0.05))
    face3d(m, "#c8946a", "#18141c")
    # long robe down to the ankles + belt
    m.cube("body", [-4.4, 2, -2.4], [8.8, 10.2, 4.8], "x_robe")
    m.cube("body", [-4.5, 15, -2.5], [9, 1.2, 5], "x_belt")
    m.cube("body", [-1, 14.8, -2.8], [2, 1.6, 0.5], "chain")
    # chain collar round the neck
    chain(m, "body", [(-4, 23.6, -2.5), (-2, 21, -2.6), (0, 19.3, -2.7), (2, 21, -2.6), (4, 23.6, -2.5)], "chain", "chain")
    # chain from the right wrist sagging to the left hand, then down the robe
    m.bone("chains", [0, 0, 0], "root")
    chain(m, "chains", [(-6, 16, -7.5), (-3, 11, -7.2), (1.5, 10.5, -6), (6, 12.5, -3.8)], "chain", "chain")
    chain(m, "chains", [(1.5, 10.5, -6), (1.2, 6, -3.2), (1, 2.5, -2.9)], "chain", "chain")
    # round portal orb over the left shoulder
    disc(m, "orb", 9, 31, 4.6, 7, 0.6, "x_ring")
    disc(m, "orb", 9, 31, 4.1, 6, 0.6, "x_ring2")
    disc(m, "orb", 9, 31, 3.6, 5, 0.6, "x_mid")
    disc(m, "orb", 9, 31, 3.1, 4, 0.6, "x_core")
    disc(m, "orb", 9, 31, 2.6, 2, 0.6, "x_hot")
    # plus-shaped sparkles
    for x, y, z, s, tile in ((-13, 27, -6, 1, "spark"), (-15, 33, -4, 0.8, "x_spark_o"), (-14, 18, -5, 0.8, "spark"),
                             (-12, 12, -4, 0.7, "x_spark_o"), (15, 36, 2, 1, "spark"), (16, 22, 1, 0.8, "spark"), (-11, 38, -3, 0.6, "spark")):
        plus(m, "sparks", x, y, z, s, tile)


def x_kits(m):
    tl = m.tiles
    tl.add("x_cork", t_noise("#a07040", 0.15))
    face3d(m, "#e0a878", "#6a3e1e")
    # gems on the collar
    for gx in (-3.5, 2.5):
        m.cube("body", [gx, 21.6, -3.1], [1, 1, 0.6], "gem")
    m.cube("body", [-0.6, 20, -3.1], [1.2, 1.2, 0.6], "gem")
    # gold tassels hanging off the shoulders
    for ax, arm in ((-9, "rightArm"), (3, "leftArm")):
        for k in range(4):
            m.cube(arm, [ax + 0.4 + k * 1.4, 19.5, -3.1], [0.6, 2, 0.6], "gold")
    # gold hem on the cape + belt buckle
    m.cube("cape", [-6.2, 1, 2.1], [12.4, 1.4, 1.2], "gold")
    m.cube("body", [-4.5, 11, -2.6], [9, 1.5, 5.2], "leather")
    m.cube("body", [-1.2, 10.7, -3], [2.4, 2.1, 0.6], "gold")
    # robe panel hanging in front of the legs
    m.cube("body", [-2, 3, -2.6], [4, 9, 0.5], "cape")
    # corks on the potions
    for px, pz in ((-8.75, -1.25), (-6.25, -0.25), (-4.25, -1.75)):
        m.cube("held", [px, 19.3, pz], [1, 0.7, 1], "x_cork")


def x_ores(m):
    tl = m.tiles
    tl.add("x_rock", t_noise("#7a7a80", 0.2))
    face3d(m, "#e0a070", "#6a3e1e")
    # backpack straps over the shoulders (front)
    for sx in (-3, 2):
        m.cube("body", [sx, 13, -2.4], [1.2, 11, 0.4], "orange")
        m.cube("body", [sx, 23.6, -2.2], [1.2, 0.6, 5], "orange")
    # belt pouch + boot caps
    m.cube("body", [1.5, 11, -3.2], [2.5, 2.5, 1.2], "handle")
    for leg, lx in (("rightLeg", -4.1), ("leftLeg", -0.3)):
        m.cube(leg, [lx, 0, -2.6], [4.4, 1.2, 1], "grey")
    # bits of rock floating off the backpack
    m.bone("rocks", [0, 20, 6], "body")
    for rx, ry, rz, s in ((6, 26, 6, 1.2), (7.5, 22, 7, 0.9), (-6.5, 27, 7, 1), (5, 30, 8, 0.8), (8, 17, 5, 0.7)):
        m.cube("rocks", [rx, ry, rz], [s, s, s], "x_rock", rotation=[30, 45, 15])


def x_farming(m):
    tl = m.tiles
    tl.add("x_pumpkin", t_noise("#f0901e", 0.12))
    tl.add("x_pumpkin_d", t_noise("#c86a10", 0.1))
    tl.add("x_stem", t_noise("#4a8a2a", 0.15))
    tl.add("x_cow", t_noise("#f4ecdc", 0.08))
    tl.add("x_cow_spot", t_noise("#9a5a30", 0.1))
    tl.add("x_pig", t_noise("#f4c8c0", 0.08))
    tl.add("x_pig_spot", t_noise("#e89a94", 0.08))
    tl.add("x_rope", t_noise("#b8b0a0", 0.15))
    face3d(m, "#e8b088", "#6a3a1c")
    # pumpkins + animals at his feet
    m.bone("ground", [0, 0, 0], "root")
    pumpkin(m, "ground", -8.5, -5, 6, 15)
    pumpkin(m, "ground", 9, -4.5, 5.5, -20)
    critter(m, "ground", -13.5, 0.5, "x_cow", "x_cow_spot", -60)
    critter(m, "ground", 14.5, -1, "x_pig", "x_pig_spot", -130)
    # sunflower petals sticking out of the crown
    for px, pz in ((-5.4, -4.2), (4.4, -4.2), (-5.4, 3.4), (4.4, 3.4)):
        m.cube("crown", [px, 32.5, pz], [1, 1, 1], "sunflower")
    # straw fringes at the sleeves and a tie on the sack
    for ax, arm in ((-8.6, "rightArm"), (3.6, "leftArm")):
        for k in range(4):
            m.cube(arm, [ax + k * 1.3, 17.2, -2.9], [0.8, 2, 0.5], "straw")
    m.cube("pack", [-5.8, 20, 1.8], [11.6, 0.8, 7.4], "x_rope")


def x_blocks(m):
    tl = m.tiles
    tl.add("x_beltl", t_noise("#7a4a26", 0.15))
    tl.add("x_hammer", t_noise("#8a8c92", 0.1))
    tl.add("x_wood", t_noise("#b07840", 0.12))
    face3d(m, "#e8b088", "#6a3a1c")
    # tool belt with a hammer
    m.cube("body", [-4.6, 11.5, -2.6], [9.2, 1.4, 5.2], "x_beltl")
    m.cube("body", [3.6, 5.5, -2.4], [0.8, 6, 0.8], "x_wood")
    m.cube("body", [2.8, 10.5, -2.8], [2.4, 1.4, 1.6], "x_hammer")
    # rolled sleeves
    for ax, arm in ((-8.4, "rightArm"), (3.6, "leftArm")):
        m.cube(arm, [ax, 17.2, -2.4], [4.8, 1.2, 4.8], "overall")
    # loose bricks on top of the backpack + a little brick pile at his feet
    m.cube("pack", [-4.5, 22, 2.5], [4, 1.8, 2], "bricks")
    m.cube("pack", [0.5, 22, 4], [3.5, 1.8, 2], "bricks")
    m.bone("ground", [0, 0, 0], "root")
    for bx, by, bz, ry in ((8, 0, -4, 10), (11.5, 0, -3.5, -15), (9.5, 1.8, -3.8, 30)):
        m.cube("ground", [bx, by, bz], [3.6, 1.8, 2], "bricks", rotation=[0, ry, 0])


def x_redstone(m):
    tl = m.tiles
    tl.add("x_dust", t_glow("#ff8a7a", "#e0201a"))
    face3d(m, "#d8a078")
    # coat hanging to the knees + raised collar
    m.cube("body", [-4.4, 5, -2.4], [8.8, 7.2, 4.8], "coat")
    m.cube("body", [-4.5, 22.8, -2.6], [2.2, 2, 5.2], "coat")
    m.cube("body", [2.3, 22.8, -2.6], [2.2, 2, 5.2], "coat")
    # cable from the shoulder device up to the goggles
    chain(m, "body", [(6.5, 24.5, 0), (5.5, 27, 0.5), (4.6, 28, -1.5)], "cable", "cable")
    # glowing redstone specks floating around
    m.bone("dust", [0, 20, 0], "root")
    for dx, dy, dz, s in ((-12, 30, -5, 0.8), (-14, 24, -3, 0.6), (11, 32, -2, 0.7), (13, 20, -4, 0.6), (-10, 36, -1, 0.5), (9, 38, -3, 0.5)):
        m.cube("dust", [dx, dy, dz], [s, s, s], "x_dust", rotation=[45, 0, 45])


def x_food(m):
    tl = m.tiles
    tl.add("x_red", t_noise("#c8302a", 0.1))
    tl.add("x_pocket", t_noise("#e8d0a0", 0.08))
    tl.add("x_stove", t_border("#8a8c92", "#5a5c62", inner="#ff8a2a"))
    tl.add("x_cake", t_noise("#f0d8a0", 0.1))
    tl.add("x_cream", t_noise("#fff6f0", 0.05))
    tl.add("x_cherry", t_noise("#e02a2a", 0.05))
    tl.add("x_pot", t_noise("#9a9ca4", 0.1))
    tl.add("x_soup", t_glow("#ffd890", "#e07a2a"))
    face3d(m, "#e8b088")
    # neckerchief + apron pocket
    m.cube("body", [-2.5, 21.2, -2.8], [5, 2.6, 0.8], "x_red")
    m.cube("body", [-1, 19.6, -2.9], [2, 1.6, 0.6], "x_red")
    m.cube("body", [0.5, 15, -2.6], [3, 2.6, 0.5], "x_pocket")
    # mini stove + cake slices on the belt
    m.cube("body", [-1.2, 10.4, -3.6], [2.6, 2.6, 1.8], "x_stove")
    for cx in (-4.6, -3):
        m.cube("body", [cx, 10.6, -3.2], [1.4, 1.6, 1.4], "x_cake")
        m.cube("body", [cx, 12.2, -3.2], [1.4, 0.4, 1.4], "x_cream")
        m.cube("body", [cx + 0.4, 12.6, -2.8], [0.6, 0.6, 0.6], "x_cherry")
    # a cooking pot at his feet
    m.bone("ground", [0, 0, 0], "root")
    m.cube("ground", [7, 0, -6], [5, 3.5, 5], "x_pot")
    m.cube("ground", [7.4, 3.5, -5.6], [4.2, 0.3, 4.2], "x_soup")
    m.cube("ground", [6.2, 2.5, -4], [0.8, 0.6, 1], "x_pot")
    m.cube("ground", [12, 2.5, -4], [0.8, 0.6, 1], "x_pot")


EXTRAS = {
    "spawner": x_spawner,
    "kits": x_kits,
    "ores": x_ores,
    "farming": x_farming,
    "blocks": x_blocks,
    "redstone": x_redstone,
    "food": x_food,
}


NPCS = {
    "spawner": npc_spawner,
    "kits": npc_kits,
    "ores": npc_ores,
    "farming": npc_farming,
    "blocks": npc_blocks,
    "redstone": npc_redstone,
    "food": npc_food,
}


def main():
    GEO_DIR.mkdir(parents=True, exist_ok=True)
    TEX_DIR.mkdir(parents=True, exist_ok=True)
    for nid, build in NPCS.items():
        cv, m = build()
        EXTRAS[nid](m)
        cv.img.save(TEX_DIR / f"npc_{nid}.png")
        geo = m.json(f"geometry.skyclans.npc_{nid}")
        (GEO_DIR / f"npc_{nid}.geo.json").write_text(json.dumps(geo, indent=1) + "\n")
        n = sum(len(b.get("cubes", [])) for b in geo["minecraft:geometry"][0]["bones"])
        print(f"npc_{nid}: {n} cubes, {m.tiles.n} tiles")


if __name__ == "__main__":
    main()
