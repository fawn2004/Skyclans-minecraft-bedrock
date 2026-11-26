"""Draws the SkyClans UI textures (pixel art) with Pillow.

Run from the repo root:  python3 tools/make_textures.py
Writes PNGs into SkyClans_RP/textures/. Safe to re-run.
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
UI = ROOT / "SkyClans_RP" / "textures" / "ui" / "skyclans"
ITEMS = ROOT / "SkyClans_RP" / "textures" / "items"
UI.mkdir(parents=True, exist_ok=True)
ITEMS.mkdir(parents=True, exist_ok=True)

BG = (17, 22, 32, 255)        # tile / window fill
EDGE = (42, 50, 66, 255)      # 1px border
WINDOW = (12, 15, 22, 245)

# 12x12 sprites: "#" = main colour, "o" = dark outline, "." = empty
SPRITES = {
    "home": [
        ".....##.....",
        "....####....",
        "...######...",
        "..########..",
        ".##########.",
        "############",
        "..########..",
        "..########..",
        "..###..###..",
        "..##....##..",
        "..##....##..",
        "..##....##..",
    ],
    "raids": [
        "##........##",
        "###......###",
        ".###....###.",
        "..###..###..",
        "...######...",
        "....####....",
        "....####....",
        "...######...",
        "..###..###..",
        "o###....###o",
        "oo#......#oo",
        "oo........oo",
    ],
    "shop": [
        "....####....",
        "...#....#...",
        "..#......#..",
        "############",
        "#o##o##o##o#",
        "############",
        ".##########.",
        ".#o##o##o##.",
        ".##########.",
        "..########..",
        "..o......o..",
        "............",
    ],
    "insurance": [
        "############",
        "#..........#",
        "#....##....#",
        "#....##....#",
        "#..######..#",
        "#..######..#",
        "#....##....#",
        ".#...##...#.",
        ".#........#.",
        "..#......#..",
        "...##..##...",
        ".....##.....",
    ],
    "members": [
        "....####....",
        "...######...",
        "...######...",
        "...######...",
        "....####....",
        "............",
        "..########..",
        ".##########.",
        "############",
        "############",
        "############",
        "............",
    ],
    "settings": [
        ".....##.....",
        "..#..##..#..",
        ".###.##.###.",
        "..########..",
        "..###..###..",
        "#####..#####",
        "#####..#####",
        "..###..###..",
        "..########..",
        ".###.##.###.",
        "..#..##..#..",
        ".....##.....",
    ],
}

# tile name -> strip/icon colour
TILES = {
    "home": (64, 196, 230),
    "raids": (236, 84, 76),
    "shop": (240, 186, 64),
    "insurance": (52, 206, 140),
    "members": (160, 124, 240),
    "settings": (150, 160, 176),
}

S = 2  # texture pixels per GUI unit (keeps pixel art crisp)


def border_box(w, h, fill, edge):
    img = Image.new("RGBA", (w, h), fill)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, w - 1, h - 1], outline=edge)
    return img


def draw_sprite(img, rows, colour, x0, y0, scale):
    dark = tuple(int(c * 0.55) for c in colour) + (255,)
    d = ImageDraw.Draw(img)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == ".":
                continue
            c = colour + (255,) if ch == "#" else dark
            d.rectangle([x0 + x * scale, y0 + y * scale, x0 + (x + 1) * scale - 1, y0 + (y + 1) * scale - 1], fill=c)


# Tile art: 108x74 GUI units -> background, coloured strip at the top, icon.
TW, TH = 108 * S, 74 * S
for name, colour in TILES.items():
    img = border_box(TW, TH, BG, EDGE)
    ImageDraw.Draw(img).rectangle([0, 0, TW - 1, 3 * S - 1], fill=colour + (255,))
    scale = 2 * S  # 12px sprite -> 24 GUI units
    draw_sprite(img, SPRITES[name], colour, (TW - 12 * scale) // 2, 9 * S, scale)
    img.save(UI / f"tile_{name}.png")

# Hover / pressed overlays (9-slice: white edge, light see-through middle)
for name, alpha, edge_a in (("hover", 28, 220), ("pressed", 60, 255)):
    img = Image.new("RGBA", (16, 16), (255, 255, 255, alpha))
    ImageDraw.Draw(img).rectangle([0, 0, 15, 15], outline=(255, 255, 255, edge_a))
    img.save(UI / f"tile_{name}.png")

# Window and stat-chip backgrounds (9-slice)
border_box(16, 16, WINDOW, EDGE).save(UI / "window.png")
border_box(16, 16, (24, 30, 42, 255), (56, 66, 84, 255)).save(UI / "chip.png")

# Close button
for name, col in (("close", (190, 196, 206)), ("close_hover", (255, 255, 255))):
    img = border_box(14, 14, (24, 30, 42, 255), (56, 66, 84, 255))
    d = ImageDraw.Draw(img)
    for i in range(4, 10):
        d.point((i, i), fill=col + (255,))
        d.point((13 - i, i), fill=col + (255,))
        d.point((i + 1, i), fill=col + (255,))
        d.point((12 - i, i), fill=col + (255,))
    img.save(UI / f"{name}.png")

# Menu item: a little floating island with a cloud
item = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
d = ImageDraw.Draw(item)
d.rectangle([3, 2, 12, 4], fill=(240, 244, 250, 255))
d.rectangle([5, 1, 10, 1], fill=(240, 244, 250, 255))
d.rectangle([2, 8, 13, 9], fill=(84, 180, 72, 255))
d.rectangle([3, 10, 12, 11], fill=(134, 96, 60, 255))
d.rectangle([5, 12, 10, 13], fill=(110, 78, 50, 255))
d.rectangle([7, 14, 8, 14], fill=(90, 64, 40, 255))
item.save(ITEMS / "skyclans_menu.png")

# Pack icon
icon = Image.new("RGBA", (128, 128), WINDOW)
draw_sprite(icon, SPRITES["home"], TILES["home"], 16, 16, 8)
icon.save(ROOT / "SkyClans_RP" / "pack_icon.png")
icon.save(ROOT / "SkyClans_BP" / "pack_icon.png")
print("textures written")


# ---------------------------------------------------------------- Settings
SET_SPRITES = {
    "chunks": [
        "############",
        "#....##....#",
        "#.##.##.##.#",
        "#.##.##.##.#",
        "#....##....#",
        "############",
        "############",
        "#....##....#",
        "#.##.##.##.#",
        "#.##.##.##.#",
        "#....##....#",
        "############",
    ],
    "bright": [
        ".....##.....",
        ".#...##...#.",
        "..#......#..",
        "....####....",
        "...######...",
        "##.######.##",
        "##.######.##",
        "...######...",
        "....####....",
        "..#......#..",
        ".#...##...#.",
        ".....##.....",
    ],
    "alert": [
        ".....##.....",
        "....####....",
        "...######...",
        "...######...",
        "..########..",
        "..########..",
        "..########..",
        ".##########.",
        "############",
        "............",
        ".....##.....",
        "............",
    ],
    "coords": [
        "....####....",
        "..##....##..",
        ".#.......##.",
        ".#......#.#.",
        "#......#...#",
        "#.....#....#",
        "#....#.....#",
        "#...#......#",
        ".#.#......#.",
        ".##.......#.",
        "..##....##..",
        "....####....",
    ],
}

# setting -> card border / icon colour
CARDS = {
    "chunks": (88, 136, 232),
    "bright": (52, 206, 140),
    "alert": (236, 84, 76),
    "coords": (52, 206, 140),
}

CW, CH = 166 * S, 84 * S


def lever(img, on):
    """Lever on the right of a card: grey base + stick (tilted right when ON)."""
    d = ImageDraw.Draw(img)
    bx, by = CW - 36 * S, CH // 2 + 4 * S
    d.rectangle([bx, by, bx + 28 * S - 1, by + 5 * S - 1], fill=(150, 154, 160, 255))
    d.rectangle([bx, by + 5 * S, bx + 28 * S - 1, by + 7 * S - 1], fill=(96, 100, 108, 255))
    stick = (140, 100, 60, 255)
    tip = (230, 50, 40, 255) if on else (110, 40, 36, 255)
    for i in range(10):
        # each step is 2x2 GUI units, walking up-right (ON) or up-left (OFF)
        x = bx + 14 * S + (i if on else -i) * S
        y = by - (i + 1) * S * 2 // 2 - i * S
        c = tip if i >= 8 else stick
        d.rectangle([x, y, x + 2 * S - 1, y + 2 * S - 1], fill=c)


for name, colour in CARDS.items():
    for state in ("off", "on"):
        img = Image.new("RGBA", (CW, CH), BG)
        d = ImageDraw.Draw(img)
        d.rectangle([0, 0, CW - 1, CH - 1], outline=colour + (255,), width=S)
        # icon box on the left
        ix, iy = 10 * S, CH // 2 - 11 * S
        d.rectangle([ix, iy, ix + 22 * S - 1, iy + 22 * S - 1], fill=(10, 13, 19, 255), outline=EDGE, width=S)
        draw_sprite(img, SET_SPRITES[name], colour, ix + 5 * S, iy + 5 * S, S)
        lever(img, state == "on")
        img.save(UI / f"card_{name}_{state}.png")

# Header gear + back button
gear = Image.new("RGBA", (12 * S, 12 * S), (0, 0, 0, 0))
draw_sprite(gear, SPRITES["settings"], (150, 160, 176), 0, 0, S)
gear.save(UI / "head_settings.png")

ARROW = [
    "....#.....",
    "...##.....",
    "..#######.",
    ".########.",
    "..#######.",
    "...##.....",
    "....#.....",
]
for name, col in (("back", (190, 196, 206)), ("back_hover", (255, 255, 255))):
    img = border_box(14, 14, (24, 30, 42, 255), (56, 66, 84, 255))
    draw_sprite(img, ARROW, col, 2, 3, 1)
    img.save(UI / f"{name}.png")
print("settings textures written")


# ---------------------------------------------------------------- Members
CYAN = (64, 196, 230)
GOLD = (240, 186, 64)


def card(w, h, border, fill=BG):
    img = Image.new("RGBA", (w * S, h * S), fill)
    ImageDraw.Draw(img).rectangle([0, 0, w * S - 1, h * S - 1], outline=border + (255,) if len(border) == 3 else border, width=S)
    return img


FACE = [  # simple 8x8 player face: h hair, s skin, e eye, w white, m mouth
    "hhhhhhhh",
    "hhhhhhhh",
    "hssssssh",
    "swessews",
    "ssssssss",
    "sssmmsss",
    "ssmssmss",
    "ssssssss",
]
FACE_COL = {"h": (92, 62, 34), "s": (226, 172, 130), "e": (70, 60, 140), "w": (240, 240, 240), "m": (150, 90, 70)}


def face(img, x0, y0, scale):
    d = ImageDraw.Draw(img)
    for y, row in enumerate(FACE):
        for x, ch in enumerate(row):
            d.rectangle([x0 + x * scale, y0 + y * scale, x0 + (x + 1) * scale - 1, y0 + (y + 1) * scale - 1], fill=FACE_COL[ch] + (255,))


f = Image.new("RGBA", (8 * 4, 8 * 4), (0, 0, 0, 0))
face(f, 0, 0, 4)
f.save(UI / "face.png")

# Person card (84x30): cyan border, face on the left
c = card(84, 30, CYAN)
face(c, 5 * S, 5 * S, int(2.5 * S))
c.save(UI / "member_owner.png")

# Invite card: gold border, grey plus
c = card(84, 30, GOLD)
d = ImageDraw.Draw(c)
d.rectangle([12 * S, 7 * S, 16 * S - 1, 23 * S - 1], fill=(110, 118, 132, 255))
d.rectangle([6 * S, 13 * S, 22 * S - 1, 17 * S - 1], fill=(110, 118, 132, 255))
c.save(UI / "member_invite.png")

# Tree background (224x188) with the connecting lines
LINE = (70, 80, 98, 255)
t = card(224, 188, EDGE, (13, 17, 25, 255))
d = ImageDraw.Draw(t)
def hl(x1, x2, y): d.rectangle([x1 * S, y * S, x2 * S + S - 1, y * S + S - 1], fill=LINE)
def vl(x, y1, y2): d.rectangle([x * S, y1 * S, x * S + S - 1, y2 * S + S - 1], fill=LINE)
vl(112, 42, 66)
vl(112, 94, 120)
hl(40, 184, 106)
vl(40, 106, 118)
vl(184, 106, 118)
t.save(UI / "members_tree.png")

# Selected panel (106x72) and the permissions table (106x128)
card(106, 72, CYAN, (13, 17, 25, 255)).save(UI / "panel_selected.png")
tbl = card(106, 128, EDGE, (13, 17, 25, 255))
d = ImageDraw.Draw(tbl)
PERMS = [(1, 1, 0), (1, 1, 0), (1, 1, 0), (1, 1, 0), (1, 1, 0), (1, 0, 0), (1, 1, 1)]
for r, row in enumerate(PERMS):
    for col, on in enumerate(row):
        x, y = (54 + col * 18) * S, (26 + r * 13 + 2) * S
        d.rectangle([x, y, x + 4 * S - 1, y + 4 * S - 1], fill=(52, 206, 140, 255) if on else (44, 50, 62, 255))
tbl.save(UI / "panel_perms.png")

for name, col in (("btn_red", (86, 22, 24)), ("btn_red_hover", (120, 32, 34))):
    b = card(60, 14, tuple(min(255, v + 30) for v in col), col + (255,))
    b.save(UI / f"{name}.png")


# ---------------------------------------------------------------- Insurance
TIERS = {
    "basic": (178, 170, 158),
    "silver": (214, 222, 232),
    "gold": (240, 186, 64),
    "diamond": (64, 180, 170),
}


def vault(img, x0, y0, colour, scale):
    """16x16 vault door: coloured frame, black ring, light keyhole."""
    d = ImageDraw.Draw(img)
    dark = tuple(int(v * 0.6) for v in colour)
    for y in range(16):
        for x in range(16):
            dx, dy = x - 7.5, y - 7.5
            dist = (dx * dx + dy * dy) ** 0.5
            if x in (0, 15) or y in (0, 15) or y >= 14:
                c = dark
            elif dist < 1.6 and abs(dx) < 1:
                c = (236, 230, 214)
            elif dist < 5.6:
                c = (20, 20, 24) if dist > 1.6 else (60, 60, 66)
            elif dist < 6.6:
                c = dark
            else:
                c = colour
            d.rectangle([x0 + x * scale, y0 + y * scale, x0 + (x + 1) * scale - 1, y0 + (y + 1) * scale - 1], fill=c + (255,))


def fade(rgb, k=0.45):
    return tuple(int(v * k + b * (1 - k)) for v, b in zip(rgb, BG[:3]))


for name, colour in TIERS.items():
    for state in ("next", "locked"):
        border = GOLD if state == "next" else EDGE[:3]
        c = card(81, 146, border, (15, 20, 27, 255))
        vault(c, int(16.5 * S), 14 * S, colour if state == "next" else fade(colour), 3 * S)
        d = ImageDraw.Draw(c)
        bar = GOLD if state == "next" else (38, 44, 54)
        d.rectangle([8 * S, 120 * S, 73 * S - 1, 134 * S - 1], fill=bar + (255,))
        d.rectangle([8 * S, 132 * S, 73 * S - 1, 134 * S - 1], fill=tuple(int(v * 0.7) for v in bar) + (255,))
        c.save(UI / f"tier_{name}_{state}.png")

ins = Image.new("RGBA", (12 * S, 12 * S), (0, 0, 0, 0))
draw_sprite(ins, SPRITES["insurance"], (52, 206, 140), 0, 0, S)
ins.save(UI / "head_insurance.png")
print("members + insurance textures written")


# ---------------------------------------------------------------- Raid Dispatch
RED = (236, 84, 76)
PANEL = (20, 18, 18, 255)        # warm dark like the war table
PANEL_IN = (14, 12, 12, 255)
EDGE_W = (58, 52, 50)

EYE = [
    "............",
    "....####....",
    "..##....##..",
    ".#...##...#.",
    "#...####...#",
    "#...####...#",
    ".#...##...#.",
    "..##....##..",
    "....####....",
    "............",
]
BROKEN_SHIELD = [
    "############",
    "#....#.....#",
    "#....#.....#",
    "#.....#....#",
    "#....#.....#",
    "#...#......#",
    "#....#.....#",
    ".#....#...#.",
    ".#...#....#.",
    "..#..#...#..",
    "...##.###...",
    ".....##.....",
]
QUESTION = [
    "..####..",
    ".##..##.",
    ".....##.",
    "....##..",
    "...##...",
    "...##...",
    "........",
    "...##...",
]
SKULL = [
    ".######.",
    "########",
    "#..##..#",
    "#..##..#",
    "########",
    ".##..##.",
    ".######.",
    ".#.##.#.",
]

for name, border, icon, icol in (
    ("normal", EDGE_W, SPRITES["raids"], RED),
    ("intel", GOLD, EYE, GOLD),
    ("cheap", EDGE_W, BROKEN_SHIELD, RED),
):
    c = card(80, 180, border, PANEL)
    draw_sprite(c, icon, icol, 5 * S, 14 * S, S)
    d = ImageDraw.Draw(c)
    d.rectangle([5 * S, 28 * S, 75 * S - 1, 108 * S - 1], fill=PANEL_IN, outline=EDGE_W + (255,), width=S)
    if name == "normal":
        d.rectangle([26 * S, 70 * S, 54 * S - 1, 98 * S - 1], fill=(60, 50, 44, 255))
        draw_sprite(c, QUESTION, GOLD, 32 * S, 76 * S, 2 * S)
    if name == "cheap":
        draw_sprite(c, BROKEN_SHIELD, RED, 28 * S, 74 * S, 2 * S)
    c.save(UI / f"raid_{name}.png")

for name, col in (("bar_gold", GOLD), ("bar_red", RED)):
    b = Image.new("RGBA", (70 * S, 16 * S), col + (255,))
    ImageDraw.Draw(b).rectangle([0, 13 * S, 70 * S - 1, 16 * S - 1], fill=tuple(int(v * 0.7) for v in col) + (255,))
    b.save(UI / f"{name}.png")

for name, icon, col in (("wins", SPRITES["raids"], RED), ("losses", SKULL, RED), ("streak", SPRITES["insurance"], (52, 206, 140))):
    c = card(50, 14, EDGE_W, PANEL)
    draw_sprite(c, icon, col, 3 * S, (14 * S - len(icon) * S) // 2, S)
    c.save(UI / f"stat_{name}.png")

card(84, 180, EDGE_W, PANEL).save(UI / "squad_panel.png")
row = card(74, 18, EDGE_W, PANEL_IN)
face(row, 3 * S, 3 * S, int(1.5 * S))
row.save(UI / "squad_row.png")


# ---------------------------------------------------------------- Sky Shop
NAVY = (22, 30, 48, 255)
NAVY_IN = (14, 20, 34, 255)
NAVY_EDGE = (48, 62, 90)

c = card(60, 78, NAVY_EDGE, NAVY)
ImageDraw.Draw(c).rectangle([3 * S, 3 * S, 57 * S - 1, 33 * S - 1], fill=NAVY_IN)
c.save(UI / "shop_card.png")
card(76, 14, NAVY_EDGE, NAVY).save(UI / "shop_cat.png")
card(76, 14, (78, 96, 130), (32, 42, 64, 255)).save(UI / "shop_cat_hover.png")
for name, fill, edge in (("qty", (34, 44, 66, 255), NAVY_EDGE), ("qty_gold", GOLD + (255,), (200, 150, 40))):
    card(16, 11, edge, fill).save(UI / f"shop_{name}.png")
card(254, 26, NAVY_EDGE, NAVY).save(UI / "shop_header.png")
card(32, 12, GOLD, (30, 26, 14, 255)).save(UI / "shop_badge.png")
card(34, 12, NAVY_EDGE, NAVY).save(UI / "shop_pager.png")
card(34, 12, (78, 96, 130), (32, 42, 64, 255)).save(UI / "shop_pager_hover.png")
card(28, 12, NAVY_EDGE, NAVY_IN).save(UI / "shop_page.png")
card(352, 236, (40, 50, 72), (16, 22, 36, 245)).save(UI / "shop_window.png")
print("raid + shop textures written")
