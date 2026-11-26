# SkyClans

Clans add-on for Minecraft Bedrock skyblock. Built one menu at a time: each menu is tested in game before the next one is started.

## Install
Run `tools/build.sh`, then open `dist/SkyClans.mcaddon` on your device. Turn on both packs (behaviour + resources) in the world. Beta APIs are **not** needed.

## What works so far (v0.4.0)
- **SkyClans Menu** item, given once to each new player, or `/give @s skyclans:menu`. Use it to open the main menu.
- **Main menu:** Island Home, Raids, Sky Shop, Insurance, Members and Settings. Raids, Sky Shop, Insurance, Members and Settings open their screens; Island Home says "coming soon".
- **Settings screen:** 4 cards (Chunk Borders, Full Bright, Raid Alert Sound, Coordinates), all "coming soon" for now, plus a back arrow next to the X.
- **Members (Chain of Command):** you shown as owner, an invite slot, the SELECTED panel with Disband Clan, and the who-can-do-what table. Invite and Disband are "coming soon".
- **Insurance Vault:** Basic / Silver / Gold / Diamond tiers (Basic next, the rest locked), Last claim and Covers strips. Buying is "coming soon".
- **Raid Dispatch:** Normal / Intel / Cheap raid cards, Wins / Losses / Streak chips and the Your Squad panel. Buying and scouting are "coming soon".
- **Sky Shop:** 11 categories down the left, 8 item cards with x1 / x16 / x64 buttons, header with balance, and page buttons. Placeholder items (Bridging Blocks); everything is "coming soon".
- **`/admin`** (operators only) opens a placeholder admin menu.

## Layout
- `SkyClans_BP/scripts/main.js` – item use, first-join item, `/admin` command
- `SkyClans_BP/scripts/menus/` – one file per menu
- `SkyClans_RP/ui/skyclans_menu.json` – the custom menu layout
- `SkyClans_RP/ui/server_form.json` – uses the SkyClans layout only for forms whose title starts with `§s§c`; every other form stays vanilla
- `tools/make_textures.py` – redraws the menu textures
- `tools/make_layouts.py` – writes the Raid Dispatch and Sky Shop layouts (`sc_raid.json`, `sc_shop.json`)
