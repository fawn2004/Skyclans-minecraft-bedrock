# SkyClans

Clans add-on for Minecraft Bedrock skyblock. Built one menu at a time: each menu is tested in game before the next one is started.

## Install
Run `tools/build.sh`, then open `dist/SkyClans.mcaddon` on your device. Turn on both packs (behaviour + resources) in the world. Beta APIs are **not** needed.

## What works so far (v0.19.2)
- **SkyClans Menu** item, given once to each new player (with the starting money), or `/give @s skyclans:menu`.
- **Main menu:** real wallet in the stat chip; Spawn button teleports to the spawn point (0 0 0 until set in /admin). Raids, Sky Shop, Insurance, Members and Settings open their screens; Island Home teleports to your island (or opens Create clan).
- **Clans & islands:** up to 5 players (Owner / Co-owner / Member). `/is create <name>` builds a starter island (dirt, tree, starter chest) on a 150x150 plot (fixed size). Plot centres go diagonally from 10000/10000 every 700 blocks (10700/10700, 11400/11400 ...), so islands have a 550 block gap. A barrier wall surrounds each plot from Y -64 to 319, built in slices in the background. Only your clan can build, break or open things on your plot; spawn is protected in a 1000x1000 area (500 each way) where only players in creative can build or break. Explosions only break blocks in their own plot. Disbanding a clan clears its whole plot back to air in the background (spawners, mobs, items and the core removed) and frees the spot for the next new clan. Clan bank (deposit: everyone, withdraw: owner/co). Members screen shows real members with Kick / Leave / Disband and Promote / Demote. Clans are in `SkyClans_BP/scripts/clans.js`, islands and protection in `islands.js`.
- **Island Core:** a custom "Rune Rings" model in the centre of every island, about 2 blocks tall, with painted obsidian, rune bands, lava and crystal textures, drawn full bright so it glows at night (two spinning purple rings, a bobbing burning crystal; can't be hurt or moved). Tap or hit it (or `/is core`) to open the **Core Terminal**. Upgrades are bought from the clan bank (owner / co-owners): Sell Multiplier (x1.00 -> x3.00), Island Fly (needs Education Edition on, uses /ability), Spawner Cap (10 -> 50), Raid Shield Length and Extra Raid Life (saved for raids). Upkeep: $2K / hr per upgrade level from the clan bank; if unpaid, upgrades pause. Tabs: Modules, Upkeep, Raid Log. Upgrades: `SkyClans_BP/scripts/islandUpgrades.js`. Model: `tools/make_core_model.py`; terminal: `SkyClans_BP/scripts/menus/coreMenu.js`.
- **`/is`** `create <name>` `home` `sethome` `invite <player>` `join <clan>` `leave` `kick <name>` `promote <name>` `demote <name>` `transfer <name>` `info` `members` `bank` `deposit` `withdraw` (open the bank) `disband` `core`. Clan bank with amounts: `/deposit <amount>` and `/withdraw <amount>`.
- **Money:** every player has a wallet. Money shows short everywhere ($5K, $100K, $1.5M). `/bal` shows it (short and exact), `/pay <player> <amount>` sends money.
- **Sky Shop:** Spawners, Kits, Ores, Farming, Blocks (-> Blocks / Wood / Lights / Coloured Blocks -> Wool / Terracotta / Concrete Powder / Concrete), Redstone, Food, Search, Sell. 167 items with prices in `SkyClans_BP/scripts/shopItems.js`. Item tiles show the name, [Buy] and [Sell] price (green / red). Items buy as x1 / x16 / x64 (spawners x1 / x4 / x16). Sell: hand, all, or see prices (by category: Ores, Farming, Mob Drops, Blocks, Wood). Only the 76 items on the `SELL` list in `shopItems.js` can be sold; anything the shop also sells pays under a third of its buy price, so even the x3 Sell Multiplier can't turn buying into profit (e.g. glowstone dust: 4 x $2 x3 = $24 < $40 glowstone). Items need an `id` to be bought or sold. The list is at the top of `SkyClans_BP/scripts/menus/shopMenu.js`.
- **Kits:** tiers 1-15 (1-5 iron, 6-10 diamond, 11-15 netherite), bought with money. Tiers are in `SkyClans_BP/scripts/kits.js`.
- **Spawners:** 17 custom spawners. Place one, then sneak + tap it for its menu: Upgrade (paid with that mob's heads), Add heads, Add stack, Pick up. Stack up to 16, 10 levels, mobs stack, stand still and are harmless (no hits, no shooting, creepers never explode), killed mobs can drop Enchanted Heads. Can't be mined or blown up. Spawner cap: 10 per clan island (stacked spawners count one each; admins are not capped); spawners only go on your own island. Settings in `SkyClans_BP/scripts/spawnerConfig.js`.
- **Crates:** Common, Rare and Legendary keys. Use a key -> crate menu (prizes and chances) -> Open key -> a reel spins and stops on the prize (money, items, keys, spawners or kits). Prizes are in `SkyClans_BP/scripts/crates.js`. Keys drop from player kills of the Spawner Shop mobs: Common 1 in 500, Rare 1 in 2,000, Legendary 1 in 5,000 (odds in `keyDrops.js`).
- **Settings (per player):** Chunk Borders, Full Bright, Coordinates work; Raid Alert Sound is saved for when raids exist.
- **Sidebar:** each player's own panel on the right: balance, spawners, heads, players online.
- **Shop NPCs:** 7 custom characters - Spawner, Kit, Ore, Farming, Block, Redstone and Food Shop - with coloured floating names and "Tap to [Buy]" under them. Tap one to open its shop category. They can't be hurt or pushed. Admins place them with `/npc <spawner|kits|ores|farming|blocks|redstone|food>` (where you stand, facing the way you look) and remove the nearest with `/npc remove`. Models: `tools/make_npcs.py`.
- **Commands (everyone):** `/spawn` `/menu` `/shop` `/sell hand|all` `/bal` `/baltop` `/pay <player> <amount>` `/kits` `/crates` `/settings` `/coords`.
- **Admins = players with the `admin` tag** (`/tag <name> add admin`). Admin commands: `/admin` `/eco give|take|set <player> <amount>` `/givekey <player> <common|rare|legendary> [amount]` `/setspawn` `/broadcast <message>` `/npc <type|remove>`. All commands are in `SkyClans_BP/scripts/commands.js`.
- **`/admin`** menu: Money (give / take / set), Give Spawner, Give Kit, Give Keys, Set Spawn Here, Starting Money, Sidebar on/off, Menu Item.
- Insurance and Raid Dispatch still show placeholder data; plot upgrades (to 300x300) and the Island Core come next.

## Layout
- `SkyClans_BP/scripts/main.js` – item use (menu item, crate keys), first-join item and money
- `SkyClans_BP/scripts/commands.js` – every /command
- `SkyClans_BP/scripts/menus/` – one file per menu
- `SkyClans_RP/ui/skyclans_menu.json` – the custom menu layout
- `SkyClans_RP/ui/server_form.json` – uses the SkyClans layout only for forms whose title starts with `§s§c`; every other form stays vanilla
- `tools/make_textures.py` – redraws the menu textures
- `tools/make_layouts.py` – writes the Raid Dispatch and Core Terminal layouts (`sc_raid.json`, `sc_core.json`)
- `tools/make_core_model.py` – writes the Island Core model and its texture
- `tools/make_npcs.py` – writes the 7 shop NPC models and textures
- `SkyClans_RP/ui/sc_list.json` – simple tile grid used by the Sky Shop
