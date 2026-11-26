import { ActionFormData } from "@minecraft/server-ui";
import { EnchantmentTypes, ItemStack } from "@minecraft/server";
import { NAV, SCREEN, fail, show, success, tilePages } from "./forms.js";
import { fmt, getBalance, takeMoney } from "./money.js";

// ============================================================================
//  KITS - tier 1 (plain iron) up to tier 15 (best netherite).
//  Every kit: full armour, sword, pickaxe, axe, shovel, hoe, golden apples, steak.
//
//  prot  = Protection on all armour      sharp = Sharpness on the sword
//  eff   = Efficiency on the tools       unb   = Unbreaking on everything
//  extra = bonus enchants from that tier up:  "mending" (everything),
//          "fire" (Fire Aspect II sword), "fortune" (Fortune III pickaxe),
//          "feather" (Feather Falling IV boots), "looting" (Looting III sword)
//  0 = no enchant. Edit the numbers freely.
// ============================================================================
export const KITS = [
  { tier: 1, mat: "iron", prot: 0, sharp: 0, eff: 0, unb: 0, apples: 2, steak: 16, price: 5000 },
  { tier: 2, mat: "iron", prot: 1, sharp: 1, eff: 1, unb: 0, apples: 3, steak: 16, price: 10000 },
  { tier: 3, mat: "iron", prot: 1, sharp: 1, eff: 1, unb: 1, apples: 4, steak: 24, price: 20000 },
  { tier: 4, mat: "iron", prot: 2, sharp: 2, eff: 2, unb: 1, apples: 5, steak: 24, price: 35000 },
  { tier: 5, mat: "iron", prot: 2, sharp: 2, eff: 2, unb: 2, apples: 6, steak: 32, price: 50000 },
  { tier: 6, mat: "diamond", prot: 1, sharp: 1, eff: 1, unb: 1, apples: 6, steak: 32, price: 75000 },
  { tier: 7, mat: "diamond", prot: 2, sharp: 2, eff: 2, unb: 1, apples: 7, steak: 32, price: 100000 },
  { tier: 8, mat: "diamond", prot: 2, sharp: 3, eff: 3, unb: 2, apples: 8, steak: 48, price: 150000 },
  { tier: 9, mat: "diamond", prot: 3, sharp: 3, eff: 3, unb: 2, apples: 9, steak: 48, price: 200000 },
  { tier: 10, mat: "diamond", prot: 3, sharp: 4, eff: 4, unb: 3, apples: 10, steak: 64, price: 300000 },
  { tier: 11, mat: "netherite", prot: 3, sharp: 4, eff: 4, unb: 3, apples: 12, steak: 64, price: 400000 },
  { tier: 12, mat: "netherite", prot: 4, sharp: 4, eff: 4, unb: 3, apples: 14, steak: 64, price: 550000 },
  { tier: 13, mat: "netherite", prot: 4, sharp: 5, eff: 5, unb: 3, apples: 16, steak: 64, price: 750000, extra: ["mending"] },
  { tier: 14, mat: "netherite", prot: 4, sharp: 5, eff: 5, unb: 3, apples: 20, steak: 64, price: 1000000, extra: ["mending", "fire", "feather"] },
  { tier: 15, mat: "netherite", prot: 4, sharp: 5, eff: 5, unb: 3, apples: 24, steak: 64, price: 1500000, extra: ["mending", "fire", "feather", "fortune", "looting"] },
];

const ARMOUR = ["helmet", "chestplate", "leggings", "boots"];
const TOOLS = ["pickaxe", "axe", "shovel", "hoe"];
const MAT_NAME = { iron: "Iron", diamond: "Diamond", netherite: "Netherite" };
const ROMAN = ["", "I", "II", "III", "IV", "V"];
const money = fmt; // short money, e.g. $5K, $1.5M
const has = (kit, x) => kit.extra?.includes(x) ?? false;
export const kitIcon = (kit) => `textures/items/${kit.mat}_chestplate`;

/** Enchant list for one piece: [[enchant id, level], ...] */
function enchantsFor(kit, piece) {
  const list = [];
  const add = (id, lvl) => lvl > 0 && list.push([id, lvl]);
  if (ARMOUR.includes(piece)) {
    add("protection", kit.prot);
    if (piece === "boots" && has(kit, "feather")) add("feather_falling", 4);
  } else if (piece === "sword") {
    add("sharpness", kit.sharp);
    if (has(kit, "fire")) add("fire_aspect", 2);
    if (has(kit, "looting")) add("looting", 3);
  } else {
    add("efficiency", kit.eff);
    if (piece === "pickaxe" && has(kit, "fortune")) add("fortune", 3);
  }
  add("unbreaking", kit.unb);
  if (has(kit, "mending")) add("mending", 1);
  return list;
}

function makePiece(kit, piece) {
  const item = new ItemStack(`minecraft:${kit.mat}_${piece}`, 1);
  item.setLore([`§bSkyClans Kit §7- Tier ${kit.tier}`]);
  const ench = item.getComponent("minecraft:enchantable");
  for (const [id, level] of enchantsFor(kit, piece)) {
    try {
      ench?.addEnchantment({ type: EnchantmentTypes.get(id), level });
    } catch (e) {
      console.warn(`[SkyClans] kit ${kit.tier}: couldn't add ${id} ${level} to ${piece}: ${e}`);
    }
  }
  return item;
}

/** Puts a whole kit in the player's inventory (anything that doesn't fit drops at their feet). */
export function giveKit(player, kit) {
  const inv = player.getComponent("minecraft:inventory")?.container;
  const items = [
    ...ARMOUR.map((p) => makePiece(kit, p)),
    makePiece(kit, "sword"),
    ...TOOLS.map((p) => makePiece(kit, p)),
    new ItemStack("minecraft:golden_apple", kit.apples),
    new ItemStack("minecraft:cooked_beef", kit.steak),
  ];
  for (const it of items) {
    const left = inv ? inv.addItem(it) : it; // addItem returns what didn't fit (undefined = all fitted)
    if (left) player.dimension.spawnItem(left, player.location);
  }
}

const enchantText = (list) => list.map(([id, l]) => `${id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} ${ROMAN[l] ?? l}`).join(", ");

/** What's in a kit, for the info panel. */
function kitInfo(kit, balance) {
  const armour = enchantText(enchantsFor(kit, "helmet"));
  const boots = has(kit, "feather") ? "§8Boots also Feather Falling IV" : "";
  const sword = enchantText(enchantsFor(kit, "sword"));
  const tools = enchantText(enchantsFor(kit, "axe"));
  return [
    `§7Armour §f${MAT_NAME[kit.mat]} full set`,
    `§8${armour || "No enchants"}`,
    boots,
    `§7Sword §f${MAT_NAME[kit.mat]}`,
    `§8${sword || "No enchants"}`,
    `§7Tools §fPickaxe, Axe, Shovel, Hoe`,
    `§8${tools || "No enchants"}`,
    has(kit, "fortune") ? "§8Pickaxe also Fortune III" : "",
    `§7Food §6${kit.apples} Golden Apples§7, §f${kit.steak} Steak`,
    "",
    `§7Price §a${money(kit.price)}`,
    `§7You have §e${money(balance)}`,
  ]
    .filter((l, i, a) => l !== "" || (i > 0 && a[i - 1] !== ""))
    .join("\n");
}

/** Shop > Kits: all 15 tiers. back = where Back goes. */
export function kitsMenu(player, back, page = 0) {
  return tilePages(
    player,
    {
      title: "KITS",
      body: `Balance §e${fmt(getBalance(player))}`,
      tiles: KITS.map((k, i) => ({
        text: `Tier ${k.tier}\n§a${money(k.price)}`,
        icon: kitIcon(k),
        onClick: () => kitMenu(player, k, () => kitsMenu(player, back, Math.floor(i / 9))),
      })),
      back,
    },
    page
  );
}

/** One kit: what's in it + Buy. Uses the info-panel layout (ui/sc_spawner.json). */
async function kitMenu(player, kit, back) {
  const form = new ActionFormData()
    .title(`${SCREEN.spawner}§l§fTIER ${kit.tier} KIT`)
    .body(kitInfo(kit, getBalance(player)))
    .button(`§a§lBuy\n§a${money(kit.price)}`, kitIcon(kit))
    .button("§7Back", NAV + "back");
  const res = await show(player, form);
  if (!res || res.canceled || res.selection === undefined) return;
  if (res.selection === 1) return back();
  if (!takeMoney(player, kit.price)) {
    fail(player, `You need ${money(kit.price)} (you have ${money(getBalance(player))}).`);
  } else {
    giveKit(player, kit);
    success(player, `Bought the Tier ${kit.tier} kit for ${money(kit.price)}.`);
  }
  return kitMenu(player, kit, back);
}

/** Admin: give any kit (for testing). */
export function giveKitMenu(player, back, page = 0) {
  return tilePages(
    player,
    {
      title: "GIVE KIT",
      body: "§7Tap one to get that kit",
      tiles: KITS.map((k, i) => ({
        text: `Tier ${k.tier}\n§7${MAT_NAME[k.mat]}`,
        icon: kitIcon(k),
        onClick: () => {
          giveKit(player, k);
          success(player, `Gave you the Tier ${k.tier} kit.`);
          return giveKitMenu(player, back, Math.floor(i / 9));
        },
      })),
      back,
    },
    page
  );
}
