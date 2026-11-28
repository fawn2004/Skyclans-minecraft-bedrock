"""Writes the Raid Dispatch layout (SkyClans_RP/ui/sc_raid.json).

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
    if back_index is not None:
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
    ("normal", "§6BLIND DROP", "RANDOM RAID"),
    ("intel", "§6WAR ROOM", "RAID STATUS"),
    ("cheap", "§cDEFENCE", "RAID SHIELD"),
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
    {"sub": label("The whole clan raids", 6, 17, 0.5, color=[0.6, 0.6, 0.62])},
    {"row": image("squad_row", 5, 26, 74, 18)},
    {"foot": label("Clan lives\nClan bank", 6, 160, 0.6, color=[0.75, 0.75, 0.78])},
])})
raid_buttons += [
    {"squad_name": data_label(12, 260 + 24, 48 + 29, 0.5, 34)},
    {"squad_state": data_label(13, 260 + 5, 48 + 35, 0.5, 72, "right")},
    {"squad_vals": data_label(14, 260 + 6, 48 + 160, 0.6, 72, "right")},
]
write("sc_raid.json", f"// Raid Dispatch screen. Title marker \"{RAID_MARK}\". Generated by tools/make_layouts.py - edit that, not this.\n",
      {"namespace": "sc_raid", "screen": screen("window", raid_controls, raid_buttons, 15)})



# ------------------------------------------------------------------ Core Terminal
CORE_SCALE = 1.12  # the whole terminal is drawn this much bigger than the other menus


def scaled(node, k):
    """Multiplies every number in offsets, sizes and text sizes (recursively) by k."""
    if isinstance(node, dict):
        out = {}
        for key, v in node.items():
            if key in ("offset", "size") and isinstance(v, list):
                out[key] = [round(n * k, 2) if isinstance(n, (int, float)) else n for n in v]
            elif key == "font_scale_factor" and isinstance(v, (int, float)):
                out[key] = round(v * k, 3)
            else:
                out[key] = scaled(v, k)
        return out
    if isinstance(node, list):
        return [scaled(v, k) for v in node]
    return node


# Button numbers (keep in sync with SkyClans_BP/scripts/menus/coreMenu.js):
#  0-4   UPGRADE buttons on the 5 module cards (pressable, fixed look; hidden when the button text is empty = maxed)
#  5-9   module cards (text-only): picture = icon, text = "Name 0/3\npips\ndescription\nprice"
#  10    clan bank text (header, right)     11  status chip text
#  12    "ISLAND CORE - LEVEL 1" (left panel title)
#  13    DEPOSIT TO BANK (pressable)
#  14-16 tabs: Modules, Upkeep, Raid Log (pressable, fixed text)
#  body  -> upkeep lines in the left panel;  title (after marker) -> clan line in the header
CORE_MARK = "§s§c§9"
MODULES = 5
TABS = ["Modules", "Upkeep", "Raid Log"]
CARD0, BANK = MODULES, MODULES * 2
SHIELD, CORE_TITLE, DEPOSIT, TAB0 = BANK + 1, BANK + 2, BANK + 3, BANK + 4
core_controls = [
    {"header": image("list_tile", 6, 6, 320, 20, [
        {"icon": image("core_small", 5, 4, 12, 12)},
        {"title": label("§l§fCORE TERMINAL", 22, 6, 1.0)},
        {"clan": title_line(CORE_MARK, 116, 7)},
    ])},
    {"shield_bg": image("chip_green", 268, 9, 54, 14)},
    {"left": image("list_tile", 6, 30, 100, 172, [
        {"pic": image("core_big", 25, 16, 50, 50)},
    ])},
    {"mod_title": label("§l§fCORE MODULES", 112, 30, 0.9)},
    {"mod_note": label("§7Upgrades only work while upkeep is paid", 196, 31, 0.5, 150, "right")},
]
upkeep = label("#form_text", 11, 104, 0.55, 90, color=[0.85, 0.88, 0.93], layer=6)
upkeep["bindings"] = [{"binding_name": "#form_text"}]
core_buttons = [
    {"bank_text": data_label(BANK, 150, 13, 0.7, 114, "right")},
    {"shield_text": data_label(SHIELD, 268, 13, 0.5, 54, "center")},
    {"core_title": data_label(CORE_TITLE, 6, 35, 0.5, 100, "center")},
    {"upkeep": upkeep},
    {"deposit": button(DEPOSIT, 12, 182, 88, 16, 0.6, shadow=False)},
]
for i in range(MODULES):
    col, row = i % 3, i // 3
    x, y = 112 + col * 78, 42 + row * 70  # 2 rows of 3, taller cards
    core_controls.append({f"card{i}": image("list_tile", x, y, 76, 66)})
    upg = button(i, x + 38, y + 52, 35, 11, 0.5, art_from_form=False, default_tex="btn_upg",
                 hover_tex="btn_upg_hover", shadow=False, fixed_text="UPGRADE")
    # the script sends an empty button for a maxed module: hide it
    upg["bindings"] += [
        {"binding_name": "#form_button_text", **COLL},
        {"binding_type": "view", "source_property_name": "(not (#form_button_text = ''))", "target_property_name": "#visible"},
    ]
    core_buttons += [
        {f"card_text{i}": data_label(CARD0 + i, x + 3, y + 4, 0.55, 60)},
        {f"card_icon{i}": data_image(CARD0 + i, x + 63, y + 3, 10, 10)},
        {f"upgrade{i}": upg},
    ]
for k, name in enumerate(TABS):
    core_buttons.append({f"tab{k}": button(TAB0 + k, 6 + k * 112, 207, 110, 16, 0.6, art_from_form=False,
                                           default_tex="tab_on" if k == 0 else "tab", hover_tex="tab_hover",
                                           shadow=False, fixed_text=name)})
core_screen = scaled(screen("shop_window", core_controls, core_buttons, back_index=None), CORE_SCALE)
write("sc_core.json", f"// Island Core terminal. Title marker \"{CORE_MARK}\". Generated by tools/make_layouts.py - edit that, not this.\n",
      {"namespace": "sc_core", "screen": core_screen})
print("layouts written")
