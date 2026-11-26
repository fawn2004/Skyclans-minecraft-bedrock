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


print("layouts written")
