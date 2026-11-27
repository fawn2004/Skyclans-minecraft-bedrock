"""Builds the Island Core model ("Rune Rings") for the resource pack.

Run from the repo root:  python3 tools/make_core_model.py
Writes:
  SkyClans_RP/models/entity/island_core.geo.json   - the model (cubes, in bones that animate)
  SkyClans_RP/textures/entity/island_core.png      - a tiny palette: one pixel per colour

Every cube face points at its colour's pixel in the palette. Glowing colours get a
low alpha, which the entity_emissive material draws at full brightness.
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

# ---- palette texture -------------------------------------------------------------
palette = {}
for _, _, _, _, cubes in BONES:
    for c in cubes:
        palette.setdefault((c["c"], round(c["e"], 2)), len(palette))
SIZE = 16
assert len(palette) <= SIZE * SIZE
img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 255))
for (hexcol, glow), i in palette.items():
    r, g, b = (int(hexcol[k : k + 2], 16) for k in (1, 3, 5))
    # glowing pixels: low alpha = drawn fully bright by entity_emissive
    # (never fully transparent: some tools drop the colour of alpha-0 pixels)
    a = 255 if glow <= 0 else max(24, int(255 * (1 - glow)))
    img.putpixel((i % SIZE, i // SIZE), (r, g, b, a))
TEX.parent.mkdir(parents=True, exist_ok=True)
img.save(TEX)


def r2(v):
    return round(v, 4)


def geo_cube(c):
    i = palette[(c["c"], round(c["e"], 2))]
    u, v = i % SIZE, i // SIZE
    face = {"uv": [u, v], "uv_size": [1, 1]}
    out = {"origin": [r2(n) for n in c["o"]], "size": [r2(n) for n in c["s"]], "uv": {f: dict(face) for f in ("north", "south", "east", "west", "up", "down")}}
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
print(f"core model: {sum(len(b.get('cubes', [])) for b in bones)} cubes, {len(palette)} colours")
