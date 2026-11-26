import { ActionFormData } from "@minecraft/server-ui";
import { SCREEN, comingSoon, show } from "../forms.js";
import { openMainMenu } from "./mainMenu.js";

// Categories down the left (max 11). Icons are vanilla textures.
const CATEGORIES = [
  { name: "Bridging Blocks", icon: "textures/blocks/cobblestone", desc: "Cheap blocks for building across to enemy islands" },
  { name: "Raid Gear", icon: "textures/items/diamond_sword" },
  { name: "Spawners", icon: "textures/blocks/mob_spawner" },
  { name: "Generators / Ores", icon: "textures/blocks/diamond_ore" },
  { name: "Farming", icon: "textures/items/wheat" },
  { name: "Blocks", icon: "textures/blocks/grass_side_carried" },
  { name: "Food", icon: "textures/items/apple" },
  { name: "Chunk Hopper", icon: "textures/blocks/hopper_top" },
  { name: "More", icon: "textures/items/redstone_dust" },
  { name: "Search", icon: "textures/items/spyglass" },
  { name: "Sell", icon: "textures/items/emerald" },
];

// Items shown on the page (max 8). Placeholder list = Bridging Blocks.
const ITEMS = [
  { name: "Cobblestone", price: 2, icon: "textures/blocks/cobblestone" },
  { name: "Dirt", price: 5, icon: "textures/blocks/dirt" },
  { name: "Oak Planks", price: 1, icon: "textures/blocks/planks_oak" },
  { name: "Sandstone", price: 20, icon: "textures/blocks/sandstone_top" },
  { name: "Netherrack", price: 1, icon: "textures/blocks/netherrack" },
  { name: "Scaffolding", price: 4, icon: "textures/blocks/scaffolding_top" },
  { name: "White Wool", price: 5, icon: "textures/blocks/wool_colored_white" },
  { name: "Stone", price: 2, icon: "textures/blocks/stone" },
];
const AMOUNTS = [1, 16, 64];
const QTY = "textures/ui/skyclans/shop_qty";

// Button numbers must match tools/make_layouts.py (Sky Shop).
export async function openShopMenu(player, selected = 0) {
  const cat = CATEGORIES[selected];
  const form = new ActionFormData().title(SCREEN.shop).body("");

  // 0-10 categories (selected one in gold)
  for (let i = 0; i < 11; i++) {
    const c = CATEGORIES[i];
    if (c) form.button(i === selected ? `§e§l${c.name}` : c.name, c.icon);
    else form.button("");
  }
  // 11-18 item cards
  for (let n = 0; n < 8; n++) {
    const it = ITEMS[n];
    if (it) form.button(`§f${it.name}\n§a$${it.price} §feach`, it.icon);
    else form.button("");
  }
  // 19-42 quantity buttons (x64 highlighted)
  for (let n = 0; n < 8; n++) {
    for (const a of AMOUNTS) {
      if (!ITEMS[n]) form.button("");
      else if (a === 64) form.button("§0x64", QTY + "_gold");
      else form.button(`x${a}`, QTY);
    }
  }
  form.button("§7« Prev").button("Next »").button("§f1 / 1"); // 43-45
  form.button(`§f${cat.name}\n§7${cat.desc ?? "Coming soon"}`, cat.icon); // 46 header
  form.button("§fBalance §e$0"); // 47
  form.button("Back"); // 48

  const res = await show(player, form);
  if (!res || res.canceled || res.selection === undefined) return;
  const s = res.selection;

  if (s === 48) return openMainMenu(player);
  if (s <= 10) {
    if (CATEGORIES[s] && s !== selected) comingSoon(player, CATEGORIES[s].name);
  } else if (s >= 19 && s <= 42) {
    const it = ITEMS[Math.floor((s - 19) / 3)];
    if (it) comingSoon(player, `Buying ${AMOUNTS[(s - 19) % 3]}x ${it.name}`);
  } else if (s === 43 || s === 44) {
    player.sendMessage("§b[SkyClans] §7There's only one page for now.");
  }
  return openShopMenu(player, selected);
}
