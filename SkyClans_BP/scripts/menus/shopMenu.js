import { ItemStack } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { NAV, SCREEN, fail, show, success, tilePages } from "../forms.js";
import { openMainMenu } from "./mainMenu.js";
import { SPAWNERS } from "../spawnerConfig.js";
import { BLOCKS, CONCRETE, CONCRETE_POWDER, FARMING, FOOD, LIGHTS, ORES, REDSTONE, SELL, TERRACOTTA, WOOD, WOOL } from "../shopItems.js";
import { KITS, kitsMenu } from "../kits.js";
import { giveSpawner } from "../spawners.js";
import { addMoney, fmt, fmtExact, getBalance, takeMoney } from "../money.js";
import { sellMultiplier } from "../islandUpgrades.js";

// Sky Shop: a tree of pages drawn with the simple tile grid (resource pack ui/sc_list.json).
//
// Each entry is either
//   a category:  { name, icon, children: [ ...more entries ] }   -> opens a page of its children
//   an item:     { name, id, icon, price, sell? }                -> buy x1 / x16 / x64
// or a special tile: { name, icon, action: "search" | "sell" | "kits" }.
// A category with an empty children list shows "Nothing here yet".
//
// The items themselves (names, prices, icons) are in shopItems.js.
//
// id    = the item's game ID (what gets given / what can be sold)
// price = buy price for ONE
// Selling: only items on the SELL list in shopItems.js can be sold.

const PER_PAGE = 9; // 9 tiles + Back / Prev / Next = 12
const AMOUNTS = [1, 16, 64];
const SPAWNER_AMOUNTS = [1, 4, 16];

const SHOP = {
  name: "Sky Shop",
  children: [
    {
      name: "Spawners",
      icon: "textures/blocks/mob_spawner",
      // every spawner in spawnerConfig.js (prices are set there)
      children: SPAWNERS.map((s) => ({ name: `${s.name} Spawner`, icon: s.icon, price: s.price, spawner: s.mob })),
    },
    { name: "Kits", icon: "textures/items/diamond_chestplate", action: "kits" }, // tiers are in kits.js
    { name: "Ores", icon: "textures/blocks/diamond_ore", children: ORES },
    { name: "Farming", icon: "textures/items/wheat", children: FARMING },
    {
      name: "Blocks",
      icon: "textures/blocks/grass_side_carried",
      children: [
        { name: "Blocks", icon: "textures/blocks/stonebrick", children: BLOCKS },
        { name: "Wood", icon: "textures/blocks/log_oak", children: WOOD },
        { name: "Lights", icon: "textures/blocks/glowstone", children: LIGHTS },
        {
          name: "Coloured Blocks",
          icon: "textures/blocks/wool_colored_red",
          children: [
            { name: "Wool", icon: "textures/blocks/wool_colored_lime", children: WOOL },
            { name: "Terracotta", icon: "textures/blocks/hardened_clay_stained_orange", children: TERRACOTTA },
            { name: "Concrete Powder", icon: "textures/blocks/concrete_powder_light_blue", children: CONCRETE_POWDER },
            { name: "Concrete", icon: "textures/blocks/concrete_magenta", children: CONCRETE },
          ],
        },
      ],
    },
    { name: "Redstone", icon: "textures/items/redstone_dust", children: REDSTONE },
    { name: "Food", icon: "textures/items/apple", children: FOOD },
    { name: "Search", icon: "textures/items/spyglass", action: "search" },
    { name: "Sell", icon: "textures/items/emerald", action: "sell" },
  ],
};

const balanceLine = (player) => `Balance §e${fmt(getBalance(player))}`;
const isCategory = (e) => Array.isArray(e.children);
const isItem = (e) => typeof e.price === "number";
// What the shop pays: only items on the SELL list (shopItems.js)
const SELL_MAP = new Map(Object.values(SELL).flat().map((s) => [s.id, s]));
const sellPrice = (e) => (e.spawner ? 0 : SELL_MAP.get(e.id)?.sell ?? 0);
/** Money with cents for small sell prices: $0.50, $2, $1.5K */
const fmtPrice = (n) => (n < 10 && n % 1 ? "$" + n.toFixed(2) : fmt(n));

function tileText(e) {
  if (isItem(e)) return `${e.name}\n§a${fmt(e.price)}${e.spawner ? "" : " §feach"}`;
  if (isCategory(e)) {
    const n = e.children.length;
    if (n === 0) return `${e.name}\n§8Empty`;
    const word = e.children.every(isItem) ? "item" : "section";
    return `${e.name}\n§7${n} ${word}${n === 1 ? "" : "s"}`;
  }
  if (e.action === "kits") return `${e.name}\n§7${KITS.length} tiers`;
  if (e.action === "sell") return `${e.name}\n§7Sell your items`;
  return `${e.name}\n§7Find an item`;
}

/** Every item in the shop. */
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

/** Opens one top-level category straight away (used by the shop NPCs). Back closes the menu. */
export function openShopCategory(player, name) {
  const cat = SHOP.children.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (!cat) return openShopMenu(player);
  if (cat.action === "kits") return kitsMenu(player, () => {});
  if (isCategory(cat)) return openPage(player, [SHOP, cat], 0);
  return openShopMenu(player);
}

/** /sell hand  or  /sell all */
export function quickSell(player, mode) {
  const prices = sellList();
  if (mode === "all") sellAll(player, prices);
  else sellHand(player, prices);
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

  let info = balanceLine(player);
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
  if (res.selection >= shown.length) return nav[res.selection - shown.length]?.go();

  const picked = shown[res.selection];
  const here = () => openPage(player, trail, page);
  if (isCategory(picked)) return openPage(player, [...trail, picked], 0);
  if (picked.action === "search") return search(player, trail);
  if (picked.action === "kits") return kitsMenu(player, here);
  if (picked.action === "sell") return sellMenu(player, here);
  return buyMenu(player, picked, here);
}

// ---- buying ------------------------------------------------------------------------
function buyMenu(player, item, back) {
  if (!item.spawner && !item.id) {
    fail(player, `${item.name} isn't set up yet (no item ID).`);
    return back();
  }
  const amounts = item.spawner ? SPAWNER_AMOUNTS : AMOUNTS;
  const sell = sellPrice(item);
  return tilePages(player, {
    title: item.name.toUpperCase(),
    body: balanceLine(player) + (sell ? `   §7Sells for §a${fmtPrice(sell)} §7each` : ""),
    tiles: amounts.map((n) => ({
      text: `Buy x${n}\n§a${fmt(item.price * n)}`,
      icon: item.icon,
      onClick: () => {
        buy(player, item, n);
        return buyMenu(player, item, back);
      },
    })),
    back,
  });
}

function buy(player, item, n) {
  const cost = item.price * n;
  if (!takeMoney(player, cost)) {
    return fail(player, `You need ${fmt(cost)} (you have ${fmt(getBalance(player))}).`);
  }
  if (item.spawner) {
    giveSpawner(player, item.spawner, n);
  } else {
    let stack;
    try {
      stack = new ItemStack(item.id, 1);
    } catch {
      addMoney(player, cost); // refund
      return fail(player, `${item.name} has a wrong item ID (${item.id}) - tell an admin.`);
    }
    giveItems(player, item.id, n, stack.maxAmount);
  }
  success(player, `Bought ${n}x ${item.name} for ${fmt(cost)}.`);
}

/** Gives n of an item in full stacks; anything that doesn't fit drops at their feet. */
function giveItems(player, id, n, max) {
  const inv = player.getComponent("minecraft:inventory")?.container;
  while (n > 0) {
    const stack = new ItemStack(id, Math.min(max, n));
    n -= stack.amount;
    const left = inv ? inv.addItem(stack) : stack;
    if (left) player.dimension.spawnItem(left, player.location);
  }
}

// ---- selling -----------------------------------------------------------------------
/** id -> { name, sell, icon } for everything the shop buys (the SELL list in shopItems.js) */
function sellList() {
  return SELL_MAP;
}

// Only plain items sell (not renamed ones, kit gear or spawners - those have lore).
const plain = (it) => !it.nameTag && it.getLore().length === 0;

function sellMenu(player, back) {
  const prices = sellList();
  return tilePages(player, {
    title: "SELL",
    body: balanceLine(player),
    tiles: [
      { text: "Sell hand\n§7What you're holding", icon: "textures/items/emerald", onClick: () => (sellHand(player, prices), sellMenu(player, back)) },
      { text: "Sell all\n§7Everything sellable", icon: "textures/items/gold_ingot", onClick: () => (sellAll(player, prices), sellMenu(player, back)) },
      { text: `Prices\n§7${prices.size} items`, icon: "textures/items/paper", onClick: () => priceList(player, prices, () => sellMenu(player, back)) },
    ],
    back,
  });
}

function sellHand(player, prices) {
  const inv = player.getComponent("minecraft:inventory")?.container;
  const slot = player.selectedSlotIndex;
  const it = inv?.getItem(slot);
  const p = it && plain(it) ? prices.get(it.typeId) : undefined;
  if (!p) return fail(player, it ? "The shop doesn't buy that item." : "You're not holding anything.");
  const mult = sellMultiplier(player);
  const earned = Math.floor(p.sell * it.amount * mult);
  inv.setItem(slot, undefined);
  addMoney(player, earned);
  success(player, `Sold ${it.amount}x ${p.name} for ${fmtExact(earned)}${mult > 1 ? ` (x${mult.toFixed(2)} island bonus)` : ""}.`);
}

function sellAll(player, prices) {
  const inv = player.getComponent("minecraft:inventory")?.container;
  if (!inv) return;
  let earned = 0, count = 0;
  for (let i = 0; i < inv.size; i++) {
    const it = inv.getItem(i);
    const p = it && plain(it) ? prices.get(it.typeId) : undefined;
    if (!p) continue;
    earned += p.sell * it.amount;
    count += it.amount;
    inv.setItem(i, undefined);
  }
  if (!count) return fail(player, "You have nothing the shop buys.");
  const mult = sellMultiplier(player);
  earned = Math.floor(earned * mult);
  addMoney(player, earned);
  success(player, `Sold ${count} items for ${fmtExact(earned)}${mult > 1 ? ` (x${mult.toFixed(2)} island bonus)` : ""}.`);
}

/** Sell prices, one page of categories, then a page per category. */
function priceList(player, prices, back) {
  const mult = sellMultiplier(player);
  const bonus = mult > 1 ? `   §7Your island: §ax${mult.toFixed(2)}` : "";
  return tilePages(player, {
    title: "SELL PRICES",
    body: "§7What the shop pays for one" + bonus,
    tiles: Object.entries(SELL).map(([cat, list]) => ({
      text: `${cat}\n§7${list.length} items`,
      icon: list[0]?.icon,
      onClick: () =>
        tilePages(player, {
          title: cat.toUpperCase(),
          body: "§7What the shop pays for one" + bonus,
          tiles: list.map((p) => ({ text: `${p.name}\n§a${fmtPrice(p.sell)}`, icon: p.icon, onClick: () => priceList(player, prices, back) })),
          back: () => priceList(player, prices, back),
        }),
    })),
    back,
  });
}

// ---- search ------------------------------------------------------------------------
async function search(player, trail) {
  const res = await show(player, new ModalFormData().title("Search the Sky Shop").textField("Item name", "e.g. stone, wool"));
  if (!res || res.canceled) return openPage(player, trail, 0);
  const query = String(res.formValues?.[0] ?? "").trim().toLowerCase();
  if (!query) return openPage(player, trail, 0);

  const results = { name: `Search: ${query}`, children: allItems().filter((it) => it.name.toLowerCase().includes(query)) };
  if (results.children.length === 0) player.sendMessage(`§b[SkyClans] §7No items match "${query}".`);
  return openPage(player, [...trail, results], 0);
}
