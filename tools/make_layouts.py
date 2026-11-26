"""Writes the Raid Dispatch and Sky Shop layouts (SkyClans_RP/ui/sc_raid.json, sc_shop.json).

These screens have a lot of placed parts, so positions are worked out here
instead of by hand. Run from the repo root:  python3 tools/make_layouts.py

Every form button is placed by its number (collection_index). Some "buttons"
are text-only: a label shows that button's text, nothing is pressable.

Text that sits on a picture needs a higher "layer" than the picture, or the
picture is drawn over it - label() does this by default.
"""
import json
from pathlib import Path

UI = Path(__file__).resolve().parent.parent / "SkyClans_RP" / "ui"
TEX = "textures/ui/skyclans/"
COLL = {"binding_type": "collection", "binding_collection_name": "form_buttons"}
MAPPINGS = [
    {"from_button_id": "button.menu_select", "to_button_id": "button.form_button_click", "mapping_type": "pressed"},
    {"from_button_id": "button.menu_ok", "to_button_id": "button.form_button_click", "mapping_type": "focused"},
]


def at(x, y, **extra):
    return {"anchor_from": "top_left", "anchor_to": "top_left", "offset": [x, y], **extra}


def image(tex, x, y, w, h, controls=None):
    c = {"type": "image", "texture": TEX + tex, "size": [w, h], **at(x, y)}
    if controls:
        c["controls"] = controls
    return c


def label(text, x, y, scale=0.6, w="default", align="left", color=None, shadow=False, layer=2):
    c = {"type": "label", "text": text, "layer": layer, "size": [w, "default"], "font_scale_factor": scale, "text_alignment": align, **at(x, y)}
    if color:
        c["color"] = color
    if shadow:
        c["shadow"] = True
    return c


def title_line(marker, x, y):
    """Small grey line = form title minus the screen marker."""
    c = label("#text", x, y, 0.8, 220, color=[0.62, 0.66, 0.72])
    c["bindings"] = [
        {"binding_name": "#title_text"},
        {"binding_type": "view", "source_property_name": f"(#title_text - '{marker}')", "target_property_name": "#text"},
    ]
    return c


def data_label(index, x, y, scale=0.6, w="default", align="left", layer=6):
    """Label showing the text of form button <index> (not pressable)."""
    c = label("#form_button_text", x, y, scale, w, align, layer=layer)
    c.update({"collection_index": index, "bindings": [{"binding_name": "#form_button_text", **COLL}]})
    return c


def data_image(index, x, y, w, h, layer=6):
    """Image showing the picture of form button <index> (not pressable)."""
    return {
        "type": "image", "size": [w, h], "collection_index": index, "layer": layer, **at(x, y),
        "bindings": [
            {"binding_name": "#form_button_texture", "binding_name_override": "#texture", **COLL},
            {"binding_name": "#form_button_texture_file_system", "binding_name_override": "#texture_file_system", **COLL},
        ],
    }


def button(index, x, y, w, h, text_scale=0.6, art_from_form=True, default_tex=None, hover_tex=None,
           text_align="center", shadow=True, fixed_text=None):
    """One pressable form button.
    Picture: from the form (art_from_form) or fixed textures (default_tex / hover_tex).
    Text: the form button's text, or fixed_text (no binding at all - cheapest)."""
    if default_tex:
        states = [
            {"default": {"type": "image", "texture": TEX + default_tex}},
            {"hover": {"type": "image", "texture": TEX + (hover_tex or default_tex)}},
            {"pressed": {"type": "image", "texture": TEX + (hover_tex or default_tex)}},
        ]
    else:
        states = [
            {"default": {"type": "panel"}},
            {"hover": {"type": "image", "texture": TEX + "tile_hover", "layer": 3}},
            {"pressed": {"type": "image", "texture": TEX + "tile_pressed", "layer": 3}},
        ]
    controls = list(states)
    if art_from_form:
        art = data_image(index, 0, 0, "100%", "100%", layer=1)
        del art["collection_index"]
        controls.append({"art": art})
    text = {
        "type": "label", "layer": 2, "size": ["100% - 4px", "default"], "font_scale_factor": text_scale,
        "text_alignment": text_align, "anchor_from": "center", "anchor_to": "center",
    }
    if shadow:
        text["shadow"] = True
    if fixed_text is not None:
        text["text"] = fixed_text
    else:
        text["text"] = "#form_button_text"
        text["bindings"] = [{"binding_name": "#form_button_text", **COLL}]
    controls.append({"text": text})
    return {
        "type": "button", "size": [w, h], "collection_index": index, **at(x, y),
        "default_control": "default", "hover_control": "hover", "pressed_control": "pressed",
        "sound_name": "random.click", "focus_enabled": True, "button_mappings": MAPPINGS,
        "bindings": [{"binding_type": "collection_details", "binding_collection_name": "form_buttons"}],
        "controls": controls,
    }


def screen(window_tex, controls, buttons, back_index):
    buttons = buttons + [{"back@skyclans.back_button": {"collection_index": back_index}}]
    return {
        "type": "image", "texture": TEX + window_tex, "size": [352, 236],
        "controls": controls + [
            {"buttons": {"type": "collection_panel", "collection_name": "form_buttons", "size": ["100%", "100%"], "layer": 5, "controls": buttons}},
            {"close@skyclans.close_button": {"anchor_from": "top_right", "anchor_to": "top_right", "offset": [-8, 6], "layer": 5}},
        ],
    }


def write(name, header, data):
    (UI / name).write_text(header + json.dumps(data, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")


# ------------------------------------------------------------------ Raid Dispatch
# 0-2   action bars (pressable): picture = bar colour, text = "BUY · $30,000"
# 3-5   text inside each card's box
# 6-8   description under each box
# 9-11  stat chips: Wins / Losses / Streak
# 12    squad member name      13  squad member status ("READY")
# 14    values on the right of "Lives each / Clan bank"
# 15    BACK
RAID_MARK = "§s§c§5"
CARDS = [
    ("normal", "§6BLIND DROP", "NORMAL RAID"),
    ("intel", "§6SCOUTED FIRST", "INTEL RAID"),
    ("cheap", "§cSHIELDS DOWN", "CHEAP RAID"),
]
raid_controls = [
    {"small": title_line(RAID_MARK, 8, 6)},
    {"big": label("§l§fRAID DISPATCH", 8, 18, 1.6, shadow=True)},
]
raid_buttons = []
for i, (art, kicker, title) in enumerate(CARDS):
    x = 8 + i * 84
    raid_controls.append({f"card{i}": image(f"raid_{art}", x, 48, 80, 180, [
        {"kicker": label(kicker, 5, 5, 0.5)},
        {"title": label(f"§l§f{title}", 18, 15, 0.7)},
    ])})
    raid_buttons += [
        {f"bar{i}": button(i, x + 5, 48 + 158, 70, 16, 0.7, shadow=False)},
        {f"inner{i}": data_label(3 + i, x + 9, 48 + 32, 0.5, 62)},
        {f"desc{i}": data_label(6 + i, x + 5, 48 + 112, 0.5, 70)},
    ]
for i, stat in enumerate(("wins", "losses", "streak")):
    x = 186 + i * 54
    raid_controls.append({f"stat{i}": image(f"stat_{stat}", x, 24, 50, 14)})
    raid_buttons.append({f"stat_text{i}": data_label(9 + i, x + 13, 28, 0.55)})
raid_controls.append({"squad": image("squad_panel", 260, 48, 84, 180, [
    {"title": label("§l§fYOUR SQUAD", 6, 6, 0.8)},
    {"sub": label("Everyone online goes", 6, 17, 0.5, color=[0.6, 0.6, 0.62])},
    {"row": image("squad_row", 5, 26, 74, 18)},
    {"foot": label("Lives each\nClan bank", 6, 160, 0.6, color=[0.75, 0.75, 0.78])},
])})
raid_buttons += [
    {"squad_name": data_label(12, 260 + 24, 48 + 29, 0.5, 34)},
    {"squad_state": data_label(13, 260 + 5, 48 + 35, 0.5, 72, "right")},
    {"squad_vals": data_label(14, 260 + 6, 48 + 160, 0.6, 72, "right")},
]
write("sc_raid.json", f"// Raid Dispatch screen. Title marker \"{RAID_MARK}\". Generated by tools/make_layouts.py - edit that, not this.\n",
      {"namespace": "sc_raid", "screen": screen("window", raid_controls, raid_buttons, 15)})


# ------------------------------------------------------------------ Sky Shop
# Button numbers (keep in sync with SkyClans_BP/scripts/menus/shopMenu.js):
CATS = 9                      # 0-8   category buttons: picture = small icon, text = name
ITEM0 = CATS                  # 9-16  item cards (text-only): picture = block/item, text = "Name\n$2 each"
QTY0 = ITEM0 + 8              # 17-40 quantity buttons, 3 per card (x1 / x16 / x64) - fixed look, no bindings
PREV = QTY0 + 24              # 41
NEXT = PREV + 1               # 42
PAGE = NEXT + 1               # 43    page text ("1 / 2")
HEAD = PAGE + 1               # 44    header: picture = category icon, text = "Name\ndescription"
BAL = HEAD + 1                # 45    balance text
BACK = BAL + 1                # 46
SHOP_MARK = "§s§c§6"
shop_controls = [
    {"big": label("§l§fSKY SHOP", 8, 8, 1.4, shadow=True)},
    {"header": image("shop_header", 90, 24, 254, 26, [
        {"badge": image("shop_badge", 152, 7, 32, 12, [{"t": label("§6§lSELL x1.5", 0, 3, 0.5, 32, "center")}])},
    ])},
]
shop_buttons = []
for i in range(CATS):
    y = 30 + i * 22
    b = button(i, 8, y, 76, 16, 0.6, art_from_form=False, default_tex="shop_cat", hover_tex="shop_cat_hover", text_align="left")
    b["controls"][-1]["text"].update({"anchor_from": "left_middle", "anchor_to": "left_middle", "offset": [17, 0], "size": [57, "default"]})
    icon = data_image(i, 4, 3, 10, 10, layer=2)
    del icon["collection_index"]
    b["controls"].append({"icon": icon})
    shop_buttons.append({f"cat{i}": b})
for n in range(8):
    col, row = n % 4, n // 4
    x, y = 91 + col * 64, 54 + row * 80
    shop_controls.append({f"card{n}": image("shop_card", x, y, 60, 78)})
    shop_buttons += [
        {f"item_img{n}": data_image(ITEM0 + n, x + 20, y + 8, 20, 20)},
        {f"item_text{n}": data_label(ITEM0 + n, x + 3, y + 36, 0.55, 54)},
    ]
    for q, (amount, tex) in enumerate((("x1", "shop_qty"), ("x16", "shop_qty"), ("§0x64", "shop_qty_gold"))):
        shop_buttons.append({f"qty{n}_{q}": button(
            QTY0 + n * 3 + q, x + 3 + q * 19, y + 64, 16, 11, 0.5,
            art_from_form=False, default_tex=tex, hover_tex=tex + "_hover", shadow=False, fixed_text=amount)})
shop_buttons += [
    {"prev": button(PREV, 166, 214, 34, 12, 0.5, art_from_form=False, default_tex="shop_pager", hover_tex="shop_pager_hover")},
    {"next": button(NEXT, 234, 214, 34, 12, 0.5, art_from_form=False, default_tex="shop_pager", hover_tex="shop_pager_hover")},
    {"page_bg": image("shop_page", 203, 214, 28, 12)},
    {"page": data_label(PAGE, 203, 217, 0.5, 28, "center")},
    {"head_icon": data_image(HEAD, 95, 29, 16, 16)},
    {"head_text": data_label(HEAD, 115, 28, 0.5, 125)},
    {"balance": data_label(BAL, 278, 32, 0.6, 62, "right")},
]
write("sc_shop.json", f"// Sky Shop screen. Title marker \"{SHOP_MARK}\". Generated by tools/make_layouts.py - edit that, not this.\n",
      {"namespace": "sc_shop", "screen": screen("shop_window", shop_controls, shop_buttons, BACK)})
print("layouts written")
