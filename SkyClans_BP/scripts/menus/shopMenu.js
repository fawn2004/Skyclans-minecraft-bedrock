import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { SCREEN, comingSoon, show } from "../forms.js";
import { openMainMenu } from "./mainMenu.js";

// Sky Shop: a tree of pages drawn with the simple tile grid (resource pack ui/sc_list.json).
//
// Each entry is either
//   a category:  { name, icon, children: [ ...more entries ] }   -> opens a page of its children
//   an item:     { name, icon, price }                           -> buying (coming soon)
// or a special tile: { name, icon, action: "search" | "sell" }.
// A category with an empty children list shows "Nothing here yet".
//
// To add items, put them in the right children list, e.g. in Wood:
//   { name: "Oak Log", icon: "textures/blocks/log_oak", price: 3 },

const NAV = "textures/ui/skyclans/nav_";
const PER_PAGE = 9; // 9 tiles + Back / Prev / Next = 12

const SHOP = {
  name: "Sky Shop",
  children: [
    { name: "Raid Gear", icon: "textures/items/diamond_sword", children: [] },
    { name: "Spawners", icon: "textures/blocks/mob_spawner", children: [] },
    { name: "Ores", icon: "textures/blocks/diamond_ore", children: [] },
    { name: "Farming", icon: "textures/items/wheat", children: [] },
    {
      name: "Blocks",
      icon: "textures/blocks/grass_side_carried",
      children: [
        {
          name: "Blocks",
          icon: "textures/blocks/stonebrick",
          children: [
            // placeholders - swap for the real list
            { name: "Cobblestone", price: 2, icon: "textures/blocks/cobblestone" },
            { name: "Dirt", price: 5, icon: "textures/blocks/dirt" },
            { name: "Sandstone", price: 20, icon: "textures/blocks/sandstone_top" },
            { name: "Netherrack", price: 1, icon: "textures/blocks/netherrack" },
            { name: "Scaffolding", price: 4, icon: "textures/blocks/scaffolding_top" },
            { name: "White Wool", price: 5, icon: "textures/blocks/wool_colored_white" },
            { name: "Stone", price: 2, icon: "textures/blocks/stone" },
          ],
        },
        { name: "Wood", icon: "textures/blocks/log_oak", children: [] },
        { name: "Lights", icon: "textures/blocks/glowstone", children: [] },
        { name: "Coloured Blocks", icon: "textures/blocks/wool_colored_red", children: [] },
        { name: "Redstone", icon: "textures/items/redstone_dust", children: [] },
      ],
    },
    { name: "Food", icon: "textures/items/apple", children: [] },
    { name: "Search", icon: "textures/items/spyglass", action: "search" },
    { name: "Sell", icon: "textures/items/emerald", action: "sell" },
  ],
};

const balanceLine = () => "Balance §e$0"; // placeholder until money exists
const isCategory = (e) => Array.isArray(e.children);
const isItem = (e) => typeof e.price === "number";

function tileText(e) {
  if (isItem(e)) return `${e.name}\n§a$${e.price} §feach`;
  if (isCategory(e)) {
    const n = e.children.length;
    if (n === 0) return `${e.name}\n§8Empty`;
    const word = e.children.every(isItem) ? "item" : "section";
    return `${e.name}\n§7${n} ${word}${n === 1 ? "" : "s"}`;
  }
  return `${e.name}\n§7${e.action === "search" ? "Find an item" : "Coming soon"}`;
}

/** Every item in the shop (for search). */
function allItems(entry = SHOP, out = []) {
  for (const e of entry.children ?? []) {
    if (isItem(e)) out.push(e);
    else if (isCategory(e)) allItems(e, out);
  }
  return out;
}

export function openShopMenu(player) {
  return openPage(player, [SHOP], 0);
}

/**
 * Shows one page of a category.
 *   trail: the categories from the shop down to this one (used for Back)
 */
async function openPage(player, trail, page) {
  const node = trail[trail.length - 1];
  const entries = node.children;
  const pages = Math.max(1, Math.ceil(entries.length / PER_PAGE));
  page = Math.min(Math.max(0, page), pages - 1);
  const shown = entries.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);

  let info = balanceLine();
  if (pages > 1) info += `   §7Page §f${page + 1}/${pages}`;
  if (entries.length === 0) info += "   §7Nothing here yet";

  const title = trail.length === 1 ? "SKY SHOP" : node.name.toUpperCase();
  const form = new ActionFormData().title(SCREEN.list + "§l§f" + title).body(info);
  for (const e of shown) form.button(tileText(e), e.icon);

  const back = () => (trail.length > 1 ? openPage(player, trail.slice(0, -1), 0) : openMainMenu(player));
  const nav = [{ text: "§7Back", icon: NAV + "back", go: back }];
  if (page > 0) nav.push({ text: "§ePrev", icon: NAV + "prev", go: () => openPage(player, trail, page - 1) });
  if (page < pages - 1) nav.push({ text: "§eNext", icon: NAV + "next", go: () => openPage(player, trail, page + 1) });
  for (const n of nav) form.button(n.text, n.icon);

  const res = await show(player, form);
  if (!res || res.canceled || res.selection === undefined) return;
  if (res.selection >= shown.length) return nav[res.selection - shown.length].go();

  const picked = shown[res.selection];
  if (isCategory(picked)) return openPage(player, [...trail, picked], 0);
  if (picked.action === "search") return search(player, trail);
  if (picked.action === "sell") comingSoon(player, "Selling");
  else comingSoon(player, `Buying ${picked.name}`);
  return openPage(player, trail, page);
}

async function search(player, trail) {
  const res = await show(player, new ModalFormData().title("Search the Sky Shop").textField("Item name", "e.g. stone, wool"));
  if (!res || res.canceled) return openPage(player, trail, 0);
  const query = String(res.formValues?.[0] ?? "").trim().toLowerCase();
  if (!query) return openPage(player, trail, 0);

  const results = { name: `Search: ${query}`, children: allItems().filter((it) => it.name.toLowerCase().includes(query)) };
  if (results.children.length === 0) player.sendMessage(`§b[SkyClans] §7No items match "${query}".`);
  return openPage(player, [...trail, results], 0);
}
