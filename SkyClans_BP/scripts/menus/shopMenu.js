import { ActionFormData } from "@minecraft/server-ui";
import { SCREEN, comingSoon, show } from "../forms.js";
import { openMainMenu } from "./mainMenu.js";

// Sky Shop: a grid of category tiles -> a grid of item tiles.
// Uses the simple list layout (resource pack ui/sc_list.json): up to 12 tiles per page.
const NAV = "textures/ui/skyclans/nav_";
const PER_PAGE = 9; // 9 items + Back / Prev / Next = 12 tiles

// Icons are vanilla textures. "items" are placeholders until the shop is filled in.
const CATEGORIES = [
  { name: "Raid Gear", icon: "textures/items/diamond_sword" },
  { name: "Spawners", icon: "textures/blocks/mob_spawner" },
  { name: "Ores", icon: "textures/blocks/diamond_ore" },
  { name: "Farming", icon: "textures/items/wheat" },
  {
    name: "Blocks",
    icon: "textures/blocks/grass_side_carried",
    items: [
      { name: "Cobblestone", price: 2, icon: "textures/blocks/cobblestone" },
      { name: "Dirt", price: 5, icon: "textures/blocks/dirt" },
      { name: "Oak Planks", price: 1, icon: "textures/blocks/planks_oak" },
      { name: "Sandstone", price: 20, icon: "textures/blocks/sandstone_top" },
      { name: "Netherrack", price: 1, icon: "textures/blocks/netherrack" },
      { name: "Scaffolding", price: 4, icon: "textures/blocks/scaffolding_top" },
      { name: "White Wool", price: 5, icon: "textures/blocks/wool_colored_white" },
      { name: "Stone", price: 2, icon: "textures/blocks/stone" },
    ],
  },
  { name: "Food", icon: "textures/items/apple" },
  { name: "Search", icon: "textures/items/spyglass" },
  { name: "Sell", icon: "textures/items/emerald" },
];

const balanceLine = () => "Balance §e$0"; // placeholder until money exists

export async function openShopMenu(player) {
  const form = new ActionFormData().title(SCREEN.list + "§l§fSKY SHOP").body(balanceLine());
  for (const c of CATEGORIES) form.button(`${c.name}\n§7${c.items ? `${c.items.length} items` : "Coming soon"}`, c.icon);
  form.button("§7Back", NAV + "back");

  const res = await show(player, form);
  if (!res || res.canceled || res.selection === undefined) return;
  if (res.selection === CATEGORIES.length) return openMainMenu(player);

  const cat = CATEGORIES[res.selection];
  if (!cat.items) {
    comingSoon(player, cat.name);
    return openShopMenu(player);
  }
  return openCategory(player, cat, 0);
}

async function openCategory(player, cat, page) {
  const pages = Math.max(1, Math.ceil(cat.items.length / PER_PAGE));
  const items = cat.items.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
  const pageInfo = pages > 1 ? `   §7Page §f${page + 1}/${pages}` : "";

  const form = new ActionFormData().title(SCREEN.list + "§l§f" + cat.name.toUpperCase()).body(balanceLine() + pageInfo);
  for (const it of items) form.button(`${it.name}\n§a$${it.price} §feach`, it.icon);

  // nav tiles after the items
  const nav = [{ text: "§7Back", icon: NAV + "back", go: () => openShopMenu(player) }];
  if (page > 0) nav.push({ text: "§ePrev", icon: NAV + "prev", go: () => openCategory(player, cat, page - 1) });
  if (page < pages - 1) nav.push({ text: "§eNext", icon: NAV + "next", go: () => openCategory(player, cat, page + 1) });
  for (const n of nav) form.button(n.text, n.icon);

  const res = await show(player, form);
  if (!res || res.canceled || res.selection === undefined) return;
  if (res.selection >= items.length) return nav[res.selection - items.length].go();

  comingSoon(player, `Buying ${items[res.selection].name}`);
  return openCategory(player, cat, page);
}
