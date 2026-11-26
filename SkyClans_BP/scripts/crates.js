import { ItemStack, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { NAV, SCREEN, show, success } from "./forms.js";
import { addMoney, fmt } from "./money.js";
import { KITS, giveKit, kitIcon } from "./kits.js";
import { giveSpawner, mobIcon, mobName } from "./spawners.js";

// ============================================================================
//  CRATES - Common, Rare and Legendary.
//  Use a key -> crate menu (prizes + chances) -> Open key -> the reel spins and
//  stops on the prize, which you get when it stops.
//
//  Prizes:  { name, weight, ...one of }
//    money: 2500                         -> money
//    item: "minecraft:diamond", amount   -> items (icon = the item's picture path)
//    key: "rare"                         -> another crate key
//    spawner: "pig"                      -> a spawner
//    kit: 5                              -> a whole kit (tier)
//  weight = how likely, compared with the others in the same crate (shown as %).
//  name   = short text on the reel (fits ~2 short lines).
// ============================================================================
export const CRATES = {
  common: {
    name: "Common",
    colour: "§f",
    prizes: [
      { name: "$2.5K", money: 2500, weight: 20 },
      { name: "16x Iron", item: "minecraft:iron_ingot", amount: 16, icon: "textures/items/iron_ingot", weight: 20 },
      { name: "8x Gold", item: "minecraft:gold_ingot", amount: 8, icon: "textures/items/gold_ingot", weight: 15 },
      { name: "16x Steak", item: "minecraft:cooked_beef", amount: 16, icon: "textures/items/beef_cooked", weight: 15 },
      { name: "$10K", money: 10000, weight: 10 },
      { name: "4x Golden Apple", item: "minecraft:golden_apple", amount: 4, icon: "textures/items/apple_golden", weight: 10 },
      { name: "4x Diamond", item: "minecraft:diamond", amount: 4, icon: "textures/items/diamond", weight: 5 },
      { name: "Rare Key", key: "rare", weight: 5 },
    ],
  },
  rare: {
    name: "Rare",
    colour: "§b",
    prizes: [
      { name: "$25K", money: 25000, weight: 20 },
      { name: "8x Iron Block", item: "minecraft:iron_block", amount: 8, icon: "textures/blocks/iron_block", weight: 20 },
      { name: "16x Diamond", item: "minecraft:diamond", amount: 16, icon: "textures/items/diamond", weight: 15 },
      { name: "16x Emerald", item: "minecraft:emerald", amount: 16, icon: "textures/items/emerald", weight: 15 },
      { name: "Tier 5 Kit", kit: 5, weight: 10 },
      { name: "Pig Spawner", spawner: "pig", weight: 10 },
      { name: "God Apple", item: "minecraft:enchanted_golden_apple", amount: 1, icon: "textures/items/apple_golden", weight: 5 },
      { name: "Legendary Key", key: "legendary", weight: 5 },
    ],
  },
  legendary: {
    name: "Legendary",
    colour: "§6",
    prizes: [
      { name: "$250K", money: 250000, weight: 20 },
      { name: "4x Diamond Block", item: "minecraft:diamond_block", amount: 4, icon: "textures/blocks/diamond_block", weight: 15 },
      { name: "2x God Apple", item: "minecraft:enchanted_golden_apple", amount: 2, icon: "textures/items/apple_golden", weight: 15 },
      { name: "4x Netherite", item: "minecraft:netherite_ingot", amount: 4, icon: "textures/items/netherite_ingot", weight: 10 },
      { name: "Tier 12 Kit", kit: 12, weight: 10 },
      { name: "Blaze Spawner", spawner: "blaze", weight: 10 },
      { name: "Iron Golem Spawner", spawner: "iron_golem", weight: 5 },
      { name: "$1M", money: 1000000, weight: 5 },
    ],
  },
};

const KEY_ID = (crate) => `skyclans:key_${crate}`;
const KEY_ICON = (crate) => `textures/items/key_${crate}`;
const SPIN_TICKS = 80; // must match the 4 second "spin" anim in ui/sc_crate.json
const REEL = 30; // slots on the reel
const WIN_SLOT = 27; // where the reel stops (ui/sc_crate.json)

/** Which crate a key item opens, or undefined. */
export function crateOfKey(typeId) {
  if (!typeId?.startsWith("skyclans:key_")) return undefined;
  const id = typeId.slice("skyclans:key_".length);
  return CRATES[id] ? id : undefined;
}

function prizeIcon(p) {
  if (p.money) return "textures/ui/skyclans/coin";
  if (p.key) return KEY_ICON(p.key);
  if (p.spawner) return mobIcon(p.spawner);
  if (p.kit) return kitIcon(KITS.find((k) => k.tier === p.kit) ?? KITS[0]);
  return p.icon ?? "textures/items/paper";
}

function roll(crate) {
  const total = crate.prizes.reduce((n, p) => n + p.weight, 0);
  let r = Math.random() * total;
  for (const p of crate.prizes) {
    r -= p.weight;
    if (r < 0) return p;
  }
  return crate.prizes[crate.prizes.length - 1];
}

const inventory = (player) => player.getComponent("minecraft:inventory")?.container;

function countKeys(player, crateId) {
  const inv = inventory(player);
  let n = 0;
  if (inv) for (let i = 0; i < inv.size; i++) if (inv.getItem(i)?.typeId === KEY_ID(crateId)) n += inv.getItem(i).amount;
  return n;
}

/** Takes one key (from the held slot first). -> true if taken */
function takeKey(player, crateId) {
  const inv = inventory(player);
  if (!inv) return false;
  const slots = [player.selectedSlotIndex, ...Array.from({ length: inv.size }, (_, i) => i)];
  for (const i of slots) {
    const it = inv.getItem(i);
    if (it?.typeId !== KEY_ID(crateId)) continue;
    if (it.amount > 1) {
      it.amount -= 1;
      inv.setItem(i, it);
    } else inv.setItem(i, undefined);
    return true;
  }
  return false;
}

function giveItem(player, id, amount) {
  const inv = inventory(player);
  while (amount > 0) {
    const stack = new ItemStack(id, 1);
    stack.amount = Math.min(stack.maxAmount, amount);
    amount -= stack.amount;
    const left = inv ? inv.addItem(stack) : stack;
    if (left) player.dimension.spawnItem(left, player.location);
  }
}

export function giveKeys(player, crateId, amount = 1) {
  giveItem(player, KEY_ID(crateId), amount);
}

function givePrize(player, p) {
  if (p.money) addMoney(player, p.money);
  else if (p.key) giveKeys(player, p.key, p.amount ?? 1);
  else if (p.spawner) giveSpawner(player, p.spawner, p.amount ?? 1);
  else if (p.kit) giveKit(player, KITS.find((k) => k.tier === p.kit) ?? KITS[0]);
  else if (p.item) giveItem(player, p.item, p.amount ?? 1);
}

function prizeText(p) {
  if (p.money) return fmt(p.money);
  if (p.key) return `${CRATES[p.key].name} Key`;
  if (p.spawner) return `${mobName(p.spawner)} Spawner`;
  if (p.kit) return `Tier ${p.kit} Kit`;
  return `${p.amount ?? 1}x ${p.name.replace(/^\d+x /, "")}`;
}

// ---- crate menu: prizes + Open key ------------------------------------------------
export async function crateMenu(player, crateId, msg) {
  const crate = CRATES[crateId];
  const total = crate.prizes.reduce((n, p) => n + p.weight, 0);
  const keys = countKeys(player, crateId);
  const pct = (w) => {
    const v = (w / total) * 100;
    return (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10) + "%";
  };
  const info = [
    msg ? `${msg}\n` : "",
    `§7Keys you have §f${keys}`,
    "",
    "§fPrizes",
    ...crate.prizes.map((p) => `§7${prizeText(p)} §8${pct(p.weight)}`),
  ]
    .filter((l, i) => l !== "" || i > 0)
    .join("\n");

  const form = new ActionFormData()
    .title(`${SCREEN.spawner}§l${crate.colour}${crate.name.toUpperCase()} CRATE`)
    .body(info)
    .button(`§a§lOpen key\n§7${keys} key${keys === 1 ? "" : "s"}`, KEY_ICON(crateId))
    .button("§7Close", NAV + "back");
  const res = await show(player, form);
  if (!res || res.canceled || res.selection !== 0) return;
  return openCrate(player, crateId);
}

// ---- opening: the spinning reel -----------------------------------------------------
const spinning = new Set(); // players mid-spin (one at a time)

async function openCrate(player, crateId) {
  const crate = CRATES[crateId];
  if (spinning.has(player.id)) return;
  if (!takeKey(player, crateId)) return crateMenu(player, crateId, `§cYou have no ${crate.name} keys.`);
  spinning.add(player.id);

  const won = roll(crate);
  const reel = Array.from({ length: REEL }, (_, i) => (i === WIN_SLOT ? won : roll(crate)));

  // ticking sound as each slot passes the frame (slows down like the reel)
  for (let k = 1; k <= WIN_SLOT; k++) {
    const t = 1 - Math.cbrt(1 - k / WIN_SLOT); // inverse of the out_cubic easing
    system.runTimeout(() => {
      try {
        player.playSound("note.hat", { pitch: 1 + k / WIN_SLOT });
      } catch {}
    }, Math.max(1, Math.round(t * SPIN_TICKS)));
  }

  // the prize is given when the reel stops, even if they close the window
  let given = false;
  system.runTimeout(() => {
    spinning.delete(player.id);
    if (!player.isValid) return;
    givePrize(player, won);
    given = true;
    try {
      player.playSound(crateId === "legendary" ? "random.totem" : "random.levelup");
    } catch {}
    success(player, `${crate.name} crate: you won ${prizeText(won)}!`);
  }, SPIN_TICKS);

  const form = new ActionFormData()
    .title(`${SCREEN.crate}§l${crate.colour}${crate.name.toUpperCase()} CRATE`)
    .body(`§7You won §f§l${prizeText(won)}§r§7!`);
  for (const p of reel) form.button(p.name, prizeIcon(p));
  form.button("§0§lCollect");

  const res = await show(player, form);
  if (res && !res.canceled && res.selection === REEL) {
    while (!given && player.isValid) await system.waitTicks(5); // pressed early: wait for the reel
    return crateMenu(player, crateId);
  }
}

// ---- admin: give keys -----------------------------------------------------------------
export function crateKeyTiles(player, reopen) {
  return Object.entries(CRATES).map(([id, c]) => ({
    text: `${c.colour}${c.name} Key\n§7Tap = 1 key`,
    icon: KEY_ICON(id),
    onClick: () => {
      giveKeys(player, id, 1);
      success(player, `Gave you 1 ${c.name} key.`);
      return reopen();
    },
  }));
}
