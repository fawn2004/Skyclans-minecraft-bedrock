# SkyClans

Clans add-on for Minecraft Bedrock skyblock. Built one menu at a time: each menu is tested in game before the next one is started.

## Install
Run `tools/build.sh`, then open `dist/SkyClans.mcaddon` on your device. Turn on both packs (behaviour + resources) in the world. Beta APIs are **not** needed.

## What works so far (v0.9.2)
- **SkyClans Menu** item, given once to each new player, or `/give @s skyclans:menu`. Use it to open the main menu.
- **Main menu:** Spawn button under the stat chip (teleports to 0 0 0 in the overworld; set in `mainMenu.js`). Island Home, Raids, Sky Shop, Insurance, Members and Settings. Raids, Sky Shop, Insurance, Members and Settings open their screens; Island Home says "coming soon".
- **Settings screen:** 4 cards (Chunk Borders, Full Bright, Raid Alert Sound, Coordinates), all "coming soon" for now, plus a back arrow next to the X.
- **Members (Chain of Command):** you shown as owner, an invite slot, the SELECTED panel with Disband Clan, and the who-can-do-what table. Invite and Disband are "coming soon".
- **Insurance Vault:** Basic / Silver / Gold / Diamond tiers (Basic next, the rest locked), Last claim and Covers strips. Buying is "coming soon".
- **Raid Dispatch:** Normal / Intel / Cheap raid cards, Wins / Losses / Streak chips and the Your Squad panel. Buying and scouting are "coming soon".
- **Sky Shop:** simple tile grid of pages. Raid Gear, Spawners, Ores, Farming, Blocks (-> Blocks / Wood / Lights / Coloured Blocks / Redstone), Food, Search, Sell. Every category opens its page (empty ones say "Nothing here yet"); Search finds items by name. Only Blocks > Blocks has placeholder items; buying and selling are "coming soon". The shop list is at the top of `SkyClans_BP/scripts/menus/shopMenu.js`.
- **`/admin`** (operators only): admin menu with **Give Spawner** and **Give Kit** (for testing).

- **Spawners:** 17 custom spawners. Place one, then sneak + tap it for its menu (SkyClans colours): Upgrade (paid with that mob's heads), Add heads, Add stack, Pick up. Stack up to 16, 10 levels, mobs stack and stand still, killed mobs can drop Enchanted Heads. Can't be mined or blown up. Settings in `SkyClans_BP/scripts/spawnerConfig.js`. Listed in Shop > Spawners (buying coming soon).

- **Kits:** Shop > Kits, tiers 1-15 (1-5 iron, 6-10 diamond, 11-15 netherite). Each: full armour, sword, pickaxe, axe, shovel, hoe, golden apples, steak; enchants go up per tier. Tap a tier to see exactly what's in it. Buying coming soon. Tiers are in `SkyClans_BP/scripts/kits.js`.

## Layout
- `SkyClans_BP/scripts/main.js` – item use, first-join item, `/admin` command
- `SkyClans_BP/scripts/menus/` – one file per menu
- `SkyClans_RP/ui/skyclans_menu.json` – the custom menu layout
- `SkyClans_RP/ui/server_form.json` – uses the SkyClans layout only for forms whose title starts with `§s§c`; every other form stays vanilla
- `tools/make_textures.py` – redraws the menu textures
- `tools/make_layouts.py` – writes the Raid Dispatch layout (`sc_raid.json`)
- `SkyClans_RP/ui/sc_list.json` – simple tile grid used by the Sky Shop
