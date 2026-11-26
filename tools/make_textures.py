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
