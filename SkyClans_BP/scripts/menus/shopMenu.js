import { ActionFormData } from "@minecraft/server-ui";
import { SCREEN, comingSoon, show } from "../forms.js";
import { openMainMenu } from "./mainMenu.js";

// Categories down the left (max 9). Icons are vanilla textures.
const CATEGORIES = [
  { name: "Raid Gear", icon: "textures/items/diamond_sword" },
  { name: "Spawners", icon: "textures/blocks/mob_spawner" },
  { name: "Ores", icon: "textures/blocks/diamond_ore" },
  { name: "Farming", icon: "textures/items/wheat" },
  { name: "Blocks", icon: "textures/blocks/grass_side_carried", desc: "Blocks for building your island and bridging" },
  { name: "Food", icon: "textures/items/apple" },
  { name: "Chunk Hopper", icon: "textures/blocks/hopper_top" },
  { name: "Search", icon: "textures/items/spyglass" },
  { name: "Sell", icon: "textures/items/emerald" },
];
const START_CATEGORY = 4; // Blocks - matches the placeholder items below

// Items shown on the page (max 8). Placeholder list = Blocks.
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

// Button numbers - must match tools/make_layouts.py (Sky Shop).
const CATS = 9;
const ITEM0 = CATS; // 9-16
const QTY0 = ITEM0 + 8; // 17-40
const PREV = QTY0 + 24; // 41
const NEXT = PREV + 1; // 42
const BACK = NEXT + 4; // 46 (43 page, 44 header, 45 balance)

export async function openShopMenu(player, selected = START_CATEGORY) {
  const cat = CATEGORIES[selected];
  const form = new ActionFormData().title(SCREEN.shop).body("");

  // categories (selected one in gold)
  for (let i = 0; i < CATS; i++) {
    const c = CATEGORIES[i];
    if (c) form.button(i === selected ? `§e§l${c.name}` : c.name, c.icon);
    else form.button("");
  }
  // item cards
  for (let n = 0; n < 8; n++) {
    const it = ITEMS[n];
    if (it) form.button(`§f${it.name}\n§a$${it.price} §feach`, it.icon);
    else form.button("");
  }
  // quantity buttons: their look and text are fixed in the layout
  for (let i = 0; i < 24; i++) form.button("");
  form.button("§7« Prev").button("Next »").button("§f1 / 1"); // prev, next, page
  form.button(`§f${cat.name}\n§7${cat.desc ?? "Coming soon"}`, cat.icon); // header
  form.button("§fBalance §e$0"); // balance
  form.button("Back");

  const res = await show(player, form);
  if (!res || res.canceled || res.selection === undefined) return;
  const s = res.selection;

  if (s === BACK) return openMainMenu(player);
  if (s < CATS) {
    if (CATEGORIES[s] && s !== selected) comingSoon(player, CATEGORIES[s].name);
  } else if (s >= QTY0 && s < PREV) {
    const it = ITEMS[Math.floor((s - QTY0) / 3)];
    if (it) comingSoon(player, `Buying ${AMOUNTS[(s - QTY0) % 3]}x ${it.name}`);
  } else if (s === PREV || s === NEXT) {
    player.sendMessage("§b[SkyClans] §7There's only one page for now.");
  }
  return openShopMenu(player, selected);
}
