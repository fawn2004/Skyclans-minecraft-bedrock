# SkyClans

Clans add-on for Minecraft Bedrock skyblock. Built one menu at a time: each menu is tested in game before the next one is started.

## Install
Run `tools/build.sh`, then open `dist/SkyClans.mcaddon` on your device. Turn on both packs (behaviour + resources) in the world. Beta APIs are **not** needed.

## What works so far (v0.11.0)
- **SkyClans Menu** item, given once to each new player (with the starting money), or `/give @s skyclans:menu`.
- **Main menu:** real wallet in the stat chip; Spawn button teleports to the spawn point (0 0 0 until set in /admin). Raids, Sky Shop, Insurance, Members and Settings open their screens; Island Home says "coming soon".
- **Money:** every player has a wallet. Money shows short everywhere ($5K, $100K, $1.5M). `/bal` shows it (short and exact), `/pay <player> <amount>` sends money.
- **Sky Shop:** Spawners, Kits, Ores, Farming, Blocks (-> Blocks / Wood / Lights / Coloured Blocks), Redstone, Food, Search, Sell. Items buy as x1 / x16 / x64 (spawners x1 / x4 / x16). Sell: hand, all, or see prices (half the buy price unless an item sets `sell`). Items need an `id` to be bought or sold. The list is at the top of `SkyClans_BP/scripts/menus/shopMenu.js`.
- **Kits:** tiers 1-15 (1-5 iron, 6-10 diamond, 11-15 netherite), bought with money. Tiers are in `SkyClans_BP/scripts/kits.js`.
- **Spawners:** 17 custom spawners. Place one, then sneak + tap it for its menu: Upgrade (paid with that mob's heads), Add heads, Add stack, Pick up. Stack up to 16, 10 levels, mobs stack, stand still and are harmless (no hits, no shooting, creepers never explode), killed mobs can drop Enchanted Heads. Can't be mined or blown up. Settings in `SkyClans_BP/scripts/spawnerConfig.js`.
- **Crates:** Common, Rare and Legendary keys. Use a key -> crate menu (prizes and chances) -> Open key -> a reel spins and stops on the prize (money, items, keys, spawners or kits). Prizes are in `SkyClans_BP/scripts/crates.js`.
- **Settings (per player):** Chunk Borders, Full Bright, Coordinates work; Raid Alert Sound is saved for when raids exist.
- **Sidebar:** each player's own panel on the right: balance, spawners, heads, players online.
- **`/admin`** (operators): Money (give / take / set), Give Spawner, Give Kit, Give Keys, Set Spawn Here, Starting Money, Sidebar on/off, Menu Item.
- Members, Insurance and Raid Dispatch screens show placeholder data until clans exist.

## Layout
- `SkyClans_BP/scripts/main.js` – item use, first-join item, `/admin` command
- `SkyClans_BP/scripts/menus/` – one file per menu
- `SkyClans_RP/ui/skyclans_menu.json` – the custom menu layout
- `SkyClans_RP/ui/server_form.json` – uses the SkyClans layout only for forms whose title starts with `§s§c`; every other form stays vanilla
- `tools/make_textures.py` – redraws the menu textures
- `tools/make_layouts.py` – writes the Raid Dispatch layout (`sc_raid.json`)
- `SkyClans_RP/ui/sc_list.json` – simple tile grid used by the Sky Shop
