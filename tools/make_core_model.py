"""Builds the Island Core model ("Rune Rings") for the resource pack.

Run from the repo root:  python3 tools/make_core_model.py
Writes:
  SkyClans_RP/models/entity/island_core.geo.json   - the model (cubes, in bones that animate)
  SkyClans_RP/textures/entity/island_core.png      - 64x64 sheet of painted 16x16 material tiles

Every cube face maps onto its material's tile (obsidian, rune band, crystal, lava...).
The whole core is drawn at full brightness (render controller ignore_lighting), so it
glows at night; the entity is scaled to 70% in its behaviour file.
Units: 16 = one block. Bones:
  cage                   - base, pillars, pillar-top crystals (still)
  ring_a_tilt > ring_a   - outer purple ring (tilted, spins)
  ring_b_tilt > ring_b   - inner ring (tilted the other way, spins the other way)
  core_bob > core        - the burning crystal (bobs up and down, spins)
"""
import json
import math
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
GEO = ROOT / "SkyClans_RP" / "models" / "entity" / "island_core.geo.json"
TEX = ROOT / "SkyClans_RP" / "textures" / "entity" / "island_core.png"

OBS, OBS_L = "#1f1830", "#2c2244"
PURP, PURP_L = "#8a46e0", "#b98aff"
LAVA, FIRE, FIRE_L, HOT = "#e0632a", "#ff7a2a", "#ffb14a", "#fff0a0"
STONE = "#3a3f4a"


def cube(o, s, c, glow=0.0, rot=None, pivot=None):
    return {"o": o, "s": s, "c": c, "e": glow, "r": rot, "p": pivot}


def ring(radius, y, count, size, colour, glow):
    out = []
    for i in range(count):
        a = i / count * math.pi * 2
        x, z = math.cos(a) * radius, math.sin(a) * radius
        deg = -a * 180 / math.pi + 90
        out.append(cube([x - size[0] / 2, y - size[1] / 2, z - size[2] / 2], size, colour, glow, [0, deg, 0], [x, y, z]))
    return out


def crystal(y, size, outer=FIRE, inner=HOT):
    h = size / 2
    return [
        cube([-h, y - h, -h], [size, size, size], outer, 1, [45, 0, 45], [0, y, 0]),
        cube([-h / 2, y - h / 2, -h / 2], [h, h, h], inner, 1),
    ]


PILLARS = [(-13, -13), (9, -13), (-13, 9), (9, 9)]
cage = [cube([-14, 0, -14], [28, 3, 28], OBS), cube([-10, 3, -10], [20, 1, 20], LAVA, 0.8)]
for x, z in PILLARS:
    cage += [
        cube([x, 3, z], [4, 40, 4], OBS),
        cube([x - 0.5, 14, z - 0.5], [5, 2, 5], PURP, 0.9),
        cube([x - 0.5, 30, z - 0.5], [5, 2, 5], PURP, 0.9),
        cube([x - 1, 43, z - 1], [6, 2, 6], OBS_L),
        cube([x + 0.5, 45, z + 0.5], [3, 3, 3], PURP_L, 1, [45, 0, 45], [x + 2, 46.5, z + 2]),
    ]

core = crystal(24, 11) + [
    cube([-1, 30, -1], [2, 7, 2], FIRE, 1),
    cube([-1, 11, -1], [2, 7, 2], FIRE, 1),
    cube([5, 23, -1], [6, 2, 2], FIRE_L, 1),
    cube([-11, 23, -1], [6, 2, 2], FIRE_L, 1),
]

# name, parent, pivot, rotation, cubes
BONES = [
    ("cage", None, [0, 0, 0], None, cage),
    ("ring_a_tilt", None, [0, 24, 0], [20, 0, 0], []),
    ("ring_a", "ring_a_tilt", [0, 24, 0], None, ring(11, 24, 20, [3.6, 1.4, 1.4], PURP, 0.9)),
    ("ring_b_tilt", None, [0, 24, 0], [0, 0, 70], []),
    ("ring_b", "ring_b_tilt", [0, 24, 0], None, ring(9, 24, 18, [3.2, 1.2, 1.2], PURP_L, 0.9)),
    ("core_bob", None, [0, 24, 0], None, []),
    ("core", "core_bob", [0, 24, 0], None, core),
]

# ---- texture: one painted 16x16 tile per material, in a 64x64 sheet -----------------------
import random

TILE = 16
SIZE = 64
rng = random.Random(7)  # fixed seed = same texture every run


def hexrgb(h):
    return tuple(int(h[k : k + 2], 16) for k in (1, 3, 5))


def shade(rgb, f):
    return tuple(max(0, min(255, int(v * f))) for v in rgb)


def mix(a, b, t):
    return tuple(int(a[k] + (b[k] - a[k]) * t) for k in range(3))


def paint_obsidian(px, base, light):
    for y in range(TILE):
        for x in range(TILE):
            r = rng.random()
            c = base
            if r < 0.18:
                c = shade(base, 0.7)
            elif r < 0.30:
                c = light
            elif r < 0.33:
                c = (74, 42, 122)  # purple fleck
            px[x, y] = c + (255,)
    # a couple of crying-obsidian streaks
    for _ in range(2):
        x = rng.randrange(TILE)
        for y in range(rng.randrange(TILE - 5), TILE):
            if rng.random() < 0.6:
                px[x, y] = (110, 60, 190, 255)


def paint_slab(px, base):
    for y in range(TILE):
        for x in range(TILE):
            c = base
            if x in (0, TILE - 1) or y in (0, TILE - 1):
                c = shade(base, 0.65)
            elif x == 1 or y == 1:
                c = shade(base, 1.35)
            elif rng.random() < 0.15:
                c = shade(base, 0.85)
            px[x, y] = c + (255,)


def paint_band(px, base):
    hi, lo, rune = shade(base, 1.35), shade(base, 0.6), (225, 200, 255)
    for y in range(TILE):
        for x in range(TILE):
            c = hi if y < 3 else lo if y > 12 else base
            if 4 <= y <= 11 and rng.random() < 0.08:
                c = shade(base, 1.15)
            px[x, y] = c + (255,)
    # carved runes
    for rx in (2, 7, 12):
        pattern = rng.choice([[(0, 0), (0, 1), (0, 2), (1, 1)], [(0, 0), (1, 1), (2, 2), (0, 2)], [(1, 0), (0, 1), (2, 1), (1, 2)]])
        for dx, dy in pattern:
            if rx + dx < TILE:
                px[rx + dx, 6 + dy] = rune + (255,)


def paint_crystal(px, dark, mid, light, sparkle=(255, 255, 255)):
    for y in range(TILE):
        for x in range(TILE):
            d = (x + y) / (2 * TILE - 2)  # diagonal facets
            c = mix(light, dark, d)
            if (x + y) % 6 == 0:
                c = mix(c, light, 0.5)  # facet edge
            if x in (0, TILE - 1) or y in (0, TILE - 1):
                c = shade(dark, 0.85)
            px[x, y] = c + (255,)
    for _ in range(4):
        x, y = rng.randrange(1, TILE - 1), rng.randrange(1, TILE - 1)
        px[x, y] = sparkle + (255,)


def paint_lava(px):
    cols = [(150, 30, 10), (210, 70, 20), (240, 120, 30), (255, 190, 60), (255, 235, 140)]
    for y in range(TILE):
        for x in range(TILE):
            v = (math.sin(x * 0.9 + y * 0.4) + math.sin(y * 1.1 - x * 0.3) + rng.random() * 0.8) / 2.8 + 0.5
            px[x, y] = cols[max(0, min(4, int(v * 5)))] + (255,)


def paint_glow(px, base, core):
    for y in range(TILE):
        for x in range(TILE):
            d = max(abs(x - 7.5), abs(y - 7.5)) / 8
            c = mix(core, base, d)
            if rng.random() < 0.1:
                c = shade(c, 1.1)
            px[x, y] = c + (255,)


MATERIALS = {
    OBS: lambda px: paint_obsidian(px, hexrgb(OBS), hexrgb(OBS_L)),
    OBS_L: lambda px: paint_slab(px, hexrgb(OBS_L)),
    PURP: lambda px: paint_band(px, hexrgb(PURP)),
    PURP_L: lambda px: paint_crystal(px, (110, 60, 200), hexrgb(PURP_L), (235, 215, 255)),
    LAVA: paint_lava,
    FIRE: lambda px: paint_crystal(px, (200, 70, 15), hexrgb(FIRE), (255, 215, 120), (255, 250, 200)),
    FIRE_L: lambda px: paint_crystal(px, (210, 110, 20), hexrgb(FIRE_L), (255, 235, 170)),
    HOT: lambda px: paint_glow(px, (255, 200, 90), (255, 255, 235)),
}
tiles = {}
img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 255))
for n, (col, painter) in enumerate(MATERIALS.items()):
    tile = Image.new("RGBA", (TILE, TILE))
    painter(tile.load())
    tx, ty = (n % (SIZE // TILE)) * TILE, (n // (SIZE // TILE)) * TILE
    img.paste(tile, (tx, ty))
    tiles[col] = (tx, ty)
TEX.parent.mkdir(parents=True, exist_ok=True)
img.save(TEX)


def r2(v):
    return round(v, 4)


def geo_cube(c):
    tx, ty = tiles[c["c"]]
    w, h, d = c["s"]
    fit = lambda a, b: [r2(max(1, min(TILE, a))), r2(max(1, min(TILE, b)))]
    faces = {"north": (w, h), "south": (w, h), "east": (d, h), "west": (d, h), "up": (w, d), "down": (w, d)}
    out = {
        "origin": [r2(n) for n in c["o"]],
        "size": [r2(n) for n in c["s"]],
        "uv": {f: {"uv": [tx, ty], "uv_size": fit(*dims)} for f, dims in faces.items()},
    }
    if c["r"]:
        out["rotation"] = [r2(n) for n in c["r"]]
        out["pivot"] = [r2(n) for n in (c["p"] or [c["o"][k] + c["s"][k] / 2 for k in range(3)])]
    return out


bones = []
for name, parent, pivot, rot, cubes in BONES:
    b = {"name": name, "pivot": pivot}
    if parent:
        b["parent"] = parent
    if rot:
        b["rotation"] = rot
    if cubes:
        b["cubes"] = [geo_cube(c) for c in cubes]
    bones.append(b)

geo = {
    "format_version": "1.16.0",
    "minecraft:geometry": [
        {
            "description": {
                "identifier": "geometry.skyclans.island_core",
                "texture_width": SIZE,
                "texture_height": SIZE,
                "visible_bounds_width": 4,
                "visible_bounds_height": 5,
                "visible_bounds_offset": [0, 1.5, 0],
            },
            "bones": bones,
        }
    ],
}
GEO.parent.mkdir(parents=True, exist_ok=True)
GEO.write_text(json.dumps(geo, indent=1) + "\n")
print(f"core model: {sum(len(b.get('cubes', [])) for b in bones)} cubes, {len(tiles)} materials")
