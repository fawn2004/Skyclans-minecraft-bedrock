# SkyClans

Clans add-on for Minecraft Bedrock skyblock. Built one menu at a time: each menu is tested in game before the next one is started.

## Install
Run `tools/build.sh`, then open `dist/SkyClans.mcaddon` on your device. Turn on both packs (behaviour + resources) in the world. Beta APIs are **not** needed.

## What works so far (v0.2.0)
- **SkyClans Menu** item, given once to each new player, or `/give @s skyclans:menu`. Use it to open the main menu.
- **Main menu:** Island Home, Raids, Sky Shop, Insurance, Members and Settings. Settings opens the settings screen; the other tiles say "coming soon" in chat.
- **Settings screen:** 4 cards (Chunk Borders, Full Bright, Raid Alert Sound, Coordinates), all "coming soon" for now, plus a back arrow next to the X.
- **`/admin`** (operators only) opens a placeholder admin menu.

## Layout
- `SkyClans_BP/scripts/main.js` – item use, first-join item, `/admin` command
- `SkyClans_BP/scripts/menus/` – one file per menu
- `SkyClans_RP/ui/skyclans_menu.json` – the custom menu layout
- `SkyClans_RP/ui/server_form.json` – uses the SkyClans layout only for forms whose title starts with `§s§c`; every other form stays vanilla
- `tools/make_textures.py` – redraws the menu textures
