import { ActionFormData } from "@minecraft/server-ui";
import { ItemStack, system, world } from "@minecraft/server";
import { SPAWNERS, SPAWNER_SETTINGS as S } from "./spawnerConfig.js";
import { NAV, SCREEN, fail, show, success } from "./forms.js";
import { canBuild } from "./islands.js";
import { clanOf, plotAt } from "./clans.js";
import { spawnerCapOf } from "./islandUpgrades.js";

// ============================================================================
//  SPAWNERS
//  - Spawner items are mob spawner items tagged with hidden lore (mob + level).
//  - Placing one loads a structure with a display-only spawner (the mob spins
//    inside but vanilla never spawns). This script does the spawning, so it can
//    handle stacking, upgrades, mob stacking and enchanted head drops.
//  - Each placed spawner is saved in a world dynamic property:
//      skyclans:sp:<dimension>:<x>,<y>,<z> = { mob, level, stack, owner, ownerName }
//  - Sneak + tap                  -> spawner menu (info, upgrade, heads, pick up)
//    Tap holding the same spawner -> add it to the stack (sneak = add all)
//    Mining / explosions can't break them; the owner picks them up in the menu.
// ============================================================================

const TAG = "§8skyclans:spawner:";
const KEY_PREFIX = "skyclans:sp:";
const SPAWNER_BLOCK = "minecraft:mob_spawner";
const STRUCTURE = (mob) => `skyclans:spawner_${mob}`;
const ICON = "textures/ui/skyclans/";
const maxLevel = () => S.levels.length;

const spawners = new Map(); // key -> { mob, level, stack, owner, ownerName, dim, x, y, z, timer }

const REPLACEABLE = new Set([
  "minecraft:air", "minecraft:short_grass", "minecraft:tall_grass", "minecraft:fern", "minecraft:large_fern",
  "minecraft:snow_layer", "minecraft:water", "minecraft:flowing_water", "minecraft:lava", "minecraft:flowing_lava",
  "minecraft:deadbush", "minecraft:vine", "minecraft:short_dry_grass", "minecraft:tall_dry_grass",
]);
const FACE = {
  Up: { x: 0, y: 1, z: 0 }, Down: { x: 0, y: -1, z: 0 }, North: { x: 0, y: 0, z: -1 },
  South: { x: 0, y: 0, z: 1 }, East: { x: 1, y: 0, z: 0 }, West: { x: -1, y: 0, z: 0 },
};

// ---- helpers ---------------------------------------------------------------
const pretty = (mob) => mob.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const mobInfo = (mob) => SPAWNERS.find((s) => s.mob === mob);
export const mobName = (mob) => mobInfo(mob)?.name ?? pretty(mob);
export const mobIcon = (mob) => mobInfo(mob)?.icon ?? "textures/blocks/mob_spawner";
const entityType = (mob) => (mob.includes(":") ? mob : "minecraft:" + mob);
const levelInfo = (lvl) => S.levels[Math.min(Math.max(1, lvl), maxLevel()) - 1];
const upgradeCost = (d) => levelInfo(d.level + 1).cost * (S.costTimesStack === false ? 1 : d.stack);

const keyOf = (dimId, l) => `${KEY_PREFIX}${dimId}:${l.x},${l.y},${l.z}`;
function parseKey(key) {
  const rest = key.slice(KEY_PREFIX.length);
  const i = rest.lastIndexOf(":");
  const [x, y, z] = rest.slice(i + 1).split(",").map(Number);
  return { dim: rest.slice(0, i), x, y, z };
}
const container = (p) => p.getComponent("minecraft:inventory")?.container;
const isCreative = (p) => String(p.getGameMode()).toLowerCase() === "creative";

/** Admins (players with the "admin" tag: /tag <name> add admin) can manage anyone's spawner. */
export function isAdmin(p) {
  try {
    return p.hasTag("admin");
  } catch {
    return false;
  }
}
const canManage = (p, d) => !d.owner || d.owner === p.id || isAdmin(p);

function save(key, d) {
  spawners.set(key, d);
  world.setDynamicProperty(key, JSON.stringify({ mob: d.mob, level: d.level, stack: d.stack, owner: d.owner, ownerName: d.ownerName }));
}

/** Forgets every spawner inside an area (used when a disbanded island is cleared). -> how many */
export function forgetSpawnersIn(dimId, x0, x1, z0, z1) {
  let n = 0;
  for (const [key, d] of [...spawners]) {
    if (d.dim === dimId && d.x >= x0 && d.x <= x1 && d.z >= z0 && d.z <= z1) {
      forget(key);
      n++;
    }
  }
  return n;
}

function forget(key) {
  spawners.delete(key);
  world.setDynamicProperty(key, undefined);
}

function loadAll() {
  spawners.clear();
  for (const key of world.getDynamicPropertyIds()) {
    if (!key.startsWith(KEY_PREFIX)) continue;
    const raw = world.getDynamicProperty(key);
    if (typeof raw !== "string") continue;
    try {
      spawners.set(key, { level: 1, stack: 1, ...JSON.parse(raw), ...parseKey(key), timer: 0 });
    } catch {}
  }
}

/** How many spawners (counting stacks) a player owns. */
export function ownedSpawnerCount(playerId) {
  let n = 0;
  for (const d of spawners.values()) if (d.owner === playerId) n += d.stack;
  return n;
}

/** All of a player's head points added up. */
export function totalHeads(player) {
  return SPAWNERS.reduce((n, s) => n + getHeadPoints(player, s.mob), 0);
}

// ---- spawner items ---------------------------------------------------------
export function makeSpawnerItem(mob, amount = 1, level = 1) {
  const stack = new ItemStack(SPAWNER_BLOCK, amount);
  stack.nameTag = `§r§d${mobName(mob)} Spawner${level > 1 ? ` §6[Lv ${level}]` : ""}`;
  stack.setLore([
    `§7Mob: §f${mobName(mob)}`,
    `§7Level: §f${level}§7/§f${maxLevel()}`,
    "§7Place it, then sneak and tap",
    "§7it to open its menu",
    `${TAG}${mob}:${level}`,
  ]);
  return stack;
}

/** Gives a player spawner items (drops any that don't fit). */
export function giveSpawner(player, mob, amount = 1, level = 1) {
  let left = amount;
  while (left > 0) {
    const n = Math.min(64, left);
    const overflow = container(player)?.addItem(makeSpawnerItem(mob, n, level));
    if (overflow) player.dimension.spawnItem(overflow, player.location);
    left -= n;
  }
}

/** -> { mob, level } for a SkyClans spawner item, else undefined */
function spawnerFromItem(item) {
  if (item?.typeId !== SPAWNER_BLOCK) return undefined;
  const line = item.getLore().find((l) => l.startsWith(TAG));
  if (!line) return undefined;
  const [mob, lvl] = line.slice(TAG.length).split(":");
  return { mob, level: Math.min(maxLevel(), Math.max(1, Number(lvl) || 1)) };
}

function takeFromHand(player, count = 1) {
  if (isCreative(player)) return;
  const inv = container(player);
  const slot = player.selectedSlotIndex;
  const held = inv?.getItem(slot);
  if (!held) return;
  if (held.amount > count) {
    held.amount -= count;
    inv.setItem(slot, held);
  } else inv.setItem(slot, undefined);
}

// ---- enchanted heads ---------------------------------------------------------
const headItemId = (mob) => `skyclans:head_${mob}`;
const headMob = (typeId) => (typeId?.startsWith("skyclans:head_") ? typeId.slice(14) : undefined);
export const getHeadPoints = (player, mob) => Number(player.getDynamicProperty(`skyclans:heads:${mob}`) ?? 0);
function addHeadPoints(player, mob, n) {
  player.setDynamicProperty(`skyclans:heads:${mob}`, Math.max(0, getHeadPoints(player, mob) + n));
}

/** Head items in the player's inventory: Map mob -> count */
function countHeads(player) {
  const inv = container(player);
  const out = new Map();
  if (!inv) return out;
  for (let i = 0; i < inv.size; i++) {
    const it = inv.getItem(i);
    const mob = headMob(it?.typeId);
    if (mob) out.set(mob, (out.get(mob) ?? 0) + it.amount);
  }
  return out;
}

/** Turns one mob's head items into head points. -> how many */
function depositHeads(player, mob) {
  const inv = container(player);
  if (!inv) return 0;
  let n = 0;
  for (let i = 0; i < inv.size; i++) {
    const it = inv.getItem(i);
    if (headMob(it?.typeId) !== mob) continue;
    n += it.amount;
    inv.setItem(i, undefined);
  }
  if (n) addHeadPoints(player, mob, n);
  return n;
}

// ---- placing & stacking ------------------------------------------------------
// ---- spawner cap: each clan's island holds SPAWNER_CAP spawners (stacked ones count one each) ----
// 10, +5 per Spawner Cap upgrade in the Island Core (while upkeep is paid)
export const spawnerCap = (clan) => spawnerCapOf(clan);

/** Spawners on a clan's island, counting every spawner in each stack. */
export function clanSpawnerCount(clan) {
  let n = 0;
  for (const d of spawners.values()) {
    if (d.dim === "minecraft:overworld" && plotAt(d.x, d.z)?.id === clan.id) n += d.stack;
  }
  return n;
}

/** How many more spawners can go on the island the player is building on (Infinity for admins). */
function capRoom(player, loc) {
  if (isAdmin(player)) return Infinity;
  const clan = clanOf(player);
  if (!clan || player.dimension.id !== "minecraft:overworld" || plotAt(loc.x, loc.z)?.id !== clan.id) return -1; // not their island
  return spawnerCap(clan) - clanSpawnerCount(clan);
}

const capFull = (player) => {
  const clan = clanOf(player);
  return fail(player, `Your island is at its spawner cap (${spawnerCap(clan)}). Upgrade Spawner Cap in your Island Core.`);
};

function placeSpawner(player, block, face, info) {
  const target = REPLACEABLE.has(block.typeId) ? block : block.offset(FACE[face] ?? FACE.Up);
  if (!target || !REPLACEABLE.has(target.typeId)) return;
  const p = player.location;
  const px = Math.floor(p.x), py = Math.floor(p.y), pz = Math.floor(p.z);
  if (target.x === px && target.z === pz && (target.y === py || target.y === py + 1)) return;

  const loc = target.location;
  if (!canBuild(player, player.dimension.id, loc)) return fail(player, "You can only place spawners on your own island.");
  const room = capRoom(player, loc);
  if (room < 0) return fail(player, "Spawners can only go on your own clan's island.");
  if (room < 1) return capFull(player);
  try {
    world.structureManager.place(STRUCTURE(info.mob), player.dimension, loc);
  } catch {
    fail(player, `Missing spawner structure for "${info.mob}" - tell an admin.`);
    return;
  }
  const key = keyOf(player.dimension.id, loc);
  save(key, { mob: info.mob, level: info.level, stack: 1, owner: player.id, ownerName: player.name, dim: player.dimension.id, ...loc, timer: 0 });
  player.playSound("dig.stone");
  takeFromHand(player);
  player.sendMessage(`§a${mobName(info.mob)} Spawner placed. §7Sneak and tap it to open its menu.`);
}

function addToStack(player, key, info, all) {
  const d = spawners.get(key);
  if (!d) return;
  if (!canManage(player, d)) return fail(player, `Only ${d.ownerName ?? "the owner"} can add to this spawner.`);
  if (info.level !== d.level) return fail(player, `Only level ${d.level} ${mobName(d.mob)} spawners can stack onto this one.`);
  const room = S.maxStack - d.stack;
  if (room <= 0) return fail(player, `This spawner is full (${S.maxStack} max).`);
  const cap = capRoom(player, d);
  if (cap < 1) return capFull(player);
  const held = container(player)?.getItem(player.selectedSlotIndex);
  const n = Math.min(room, cap, all ? held?.amount ?? 1 : 1);
  d.stack += n;
  save(key, d);
  takeFromHand(player, n);
  success(player, `Added ${n} spawner${n > 1 ? "s" : ""} - now x${d.stack}.`);
}

/** Adds every matching spawner item from the inventory to the stack. */
function addFromInventory(player, key) {
  const d = spawners.get(key);
  const inv = container(player);
  if (!d || !inv) return 0;
  let added = 0;
  let cap = capRoom(player, d);
  if (cap < 1) return 0;
  for (let i = 0; i < inv.size && d.stack < S.maxStack && cap > 0; i++) {
    const it = inv.getItem(i);
    const info = spawnerFromItem(it);
    if (!info || info.mob !== d.mob || info.level !== d.level) continue;
    const n = Math.min(S.maxStack - d.stack, it.amount, cap);
    cap -= n;
    d.stack += n;
    added += n;
    if (it.amount > n) {
      it.amount -= n;
      inv.setItem(i, it);
    } else inv.setItem(i, undefined);
  }
  if (added) save(key, d);
  return added;
}

function pickUp(player, key) {
  const d = spawners.get(key);
  if (!d) return;
  if (!canManage(player, d)) return fail(player, "This isn't your spawner.");
  try {
    world.getDimension(d.dim).getBlock(d)?.setType("minecraft:air");
  } catch {}
  forget(key);
  giveSpawner(player, d.mob, d.stack, d.level);
  success(player, `Picked up ${d.stack}x level ${d.level} ${mobName(d.mob)} Spawner.`);
}

function upgrade(player, key) {
  const d = spawners.get(key);
  if (!d) return "§cThat spawner is gone.";
  if (!canManage(player, d)) return "§cThis isn't your spawner.";
  if (d.level >= maxLevel()) return "§aAlready max level!";
  const cost = upgradeCost(d);
  const have = getHeadPoints(player, d.mob);
  if (have < cost) {
    fail(player, `You need ${cost} ${mobName(d.mob)} heads (you have ${have}).`);
    return `§cNeed §f${cost} §cheads §7(you have ${have})`;
  }
  addHeadPoints(player, d.mob, -cost);
  d.level += 1;
  save(key, d);
  success(player, `${mobName(d.mob)} Spawner upgraded to level ${d.level}!`);
  player.playSound("random.levelup");
  return `§aUpgraded to level §f${d.level}§a!`;
}

// ---- spawner menu (SkyClans layout: ui/sc_spawner.json) ----------------------
export async function spawnerMenu(player, key, msg) {
  const d = spawners.get(key);
  if (!d) return;
  const name = mobName(d.mob);
  const lvl = levelInfo(d.level);
  const next = d.level < maxLevel() ? levelInfo(d.level + 1) : undefined;
  const cost = next ? upgradeCost(d) : 0;
  const points = getHeadPoints(player, d.mob);
  const inBag = countHeads(player).get(d.mob) ?? 0;
  const manage = canManage(player, d);
  const perCycle = d.stack * S.mobsPerSpawn;

  const info = [
    msg ? `${msg}\n` : "",
    `§7Owner  §f${d.ownerName ?? "?"}`,
    `§7Stack  §f${d.stack}§7/§f${S.maxStack}`,
    `§7Level  §6${d.level}§7/§6${maxLevel()}`,
    "",
    `§7Spawns §f${perCycle} §7mob${perCycle > 1 ? "s" : ""} every §f${lvl.interval}s`,
    `§7Head chance §d${lvl.headChance}%`,
    "",
    next ? `§8Next level: every ${next.interval}s,\n§8${next.headChance}% heads, costs ${cost} heads` : "§aMax level!",
    "",
    `§7Your ${name} heads §d${points}`,
    inBag ? `§8+${inBag} in your bag` : "",
    manage ? "" : `\n§8Only ${d.ownerName ?? "the owner"} can upgrade\n§8or pick this up.`,
  ].filter((l, i) => l !== "" || i > 0).join("\n").trimEnd();

  const reopen = (m) => spawnerMenu(player, key, m);
  const tiles = [];
  if (manage) {
    tiles.push({
      text: next ? `§a§lUpgrade\n${points >= cost ? "§d" : "§c"}${cost} heads` : "§a§lMax level\n§7Level " + maxLevel(),
      icon: ICON + "icon_upgrade",
      go: () => reopen(upgrade(player, key)),
    });
  }
  tiles.push({
    text: `§d§lAdd heads\n§7${inBag} in bag`,
    icon: mobIcon(d.mob),
    go: () => {
      const n = depositHeads(player, d.mob);
      if (!n) return reopen(`§cYou have no Enchanted ${name} Heads.`);
      success(player, `Added ${n} ${name} heads to your head balance.`);
      return reopen(`§aAdded §f${n} §a${name} heads.`);
    },
  });
  if (manage) {
    tiles.push({
      text: "§e§lAdd stack\n§7From inventory",
      icon: "textures/blocks/mob_spawner",
      go: () => {
        const n = addFromInventory(player, key);
        if (!n) return reopen(`§cNothing added: no level ${d.level}\n§c${name} spawners in your bag,\n§cthe stack is full, or your\n§cisland hit its spawner cap.`);
        success(player, `Added ${n} spawners - now x${spawners.get(key)?.stack}.`);
        return reopen(`§aAdded §f${n} §aspawners.`);
      },
    });
    tiles.push({ text: "§c§lPick up\n§7To inventory", icon: ICON + "icon_pickup", go: () => pickUp(player, key) });
  }
  tiles.push({ text: "§7Close", icon: NAV + "back" });

  const form = new ActionFormData().title(`${SCREEN.spawner}§l§f${name.toUpperCase()} SPAWNER`).body(info);
  for (const t of tiles) form.button(t.text, t.icon);
  const res = await show(player, form);
  if (!res || res.canceled || res.selection === undefined) return;
  return tiles[res.selection]?.go?.();
}

// ---- spawning ---------------------------------------------------------------
const MOB_TAG = "skyclans_spawner_mob";
const stackOf = (e) => Number(e.getDynamicProperty("skyclans:stack") ?? 1);
const capStack = (n) => (S.maxMobStack > 0 ? Math.min(S.maxMobStack, n) : n);
const isFull = (e) => S.maxMobStack > 0 && stackOf(e) >= S.maxMobStack;

function setStack(e, mob, n) {
  e.setDynamicProperty("skyclans:stack", n);
  e.nameTag = S.stackMobs ? `§e${mobName(mob)} §fx${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}` : `§e${mobName(mob)}`;
}

function freeze(e) {
  if (!S.freezeMobs) return;
  try {
    if (!e.getEffect("slowness")) e.addEffect("slowness", 20000000, { amplifier: 255, showParticles: false });
    if (!e.getEffect("fire_resistance")) e.addEffect("fire_resistance", 20000000, { amplifier: 0, showParticles: false });
    // harmless: max Weakness = melee hits do no damage
    if (S.harmlessMobs && !e.getEffect("weakness")) e.addEffect("weakness", 20000000, { amplifier: 255, showParticles: false });
  } catch {}
  // harmless creepers: keep resetting the fuse so they never go off
  if (S.harmlessMobs && e.typeId === "minecraft:creeper") {
    try {
      e.triggerEvent("minecraft:stop_exploding");
    } catch {}
  }
}

// Things spawner mobs can shoot or throw - removed straight away when harmlessMobs is on.
const PROJECTILES = new Set([
  "minecraft:arrow", "minecraft:fireball", "minecraft:small_fireball", "minecraft:splash_potion",
  "minecraft:lingering_potion", "minecraft:wither_skull", "minecraft:wither_skull_dangerous",
]);

function firedBySpawnerMob(projectile) {
  try {
    const owner = projectile.getComponent("minecraft:projectile")?.owner;
    if (owner) return owner.hasTag(MOB_TAG);
  } catch {}
  // no owner info: anything fired right next to a spawner mob counts
  try {
    return projectile.dimension.getEntities({ tags: [MOB_TAG], location: projectile.location, maxDistance: 3 }).length > 0;
  } catch {
    return false;
  }
}

function tagMob(e, key, mob, n, anchor) {
  e.setDynamicProperty("skyclans:sp", key);
  e.setDynamicProperty("skyclans:mob", mob);
  const a = anchor ?? e.location;
  e.setDynamicProperty("skyclans:anchor", JSON.stringify({ x: a.x, y: a.y, z: a.z }));
  try {
    e.addTag(MOB_TAG);
  } catch {}
  setStack(e, mob, n);
  freeze(e);
}

/** Keeps every spawner mob standing on its spot. */
function holdMobs() {
  if (!S.freezeMobs || !spawners.size) return;
  const dims = new Set([...spawners.values()].map((d) => d.dim));
  for (const id of dims) {
    let list;
    try {
      list = world.getDimension(id).getEntities({ tags: [MOB_TAG] });
    } catch {
      continue;
    }
    for (const e of list) {
      try {
        const raw = e.getDynamicProperty("skyclans:anchor");
        if (typeof raw !== "string") continue;
        const a = JSON.parse(raw);
        const l = e.location;
        if (Math.abs(l.x - a.x) > 0.2 || Math.abs(l.z - a.z) > 0.2 || Math.abs(l.y - a.y) > 0.6) {
          e.teleport(a, { rotation: e.getRotation() });
        }
        freeze(e);
      } catch {}
    }
  }
}

// Slimes & magma cubes split when they die. Spawner ones spawn at the size
// that drops loot without splitting into loot-less pieces (small slime,
// medium magma cube), and any split pieces next to a stack are removed.
const SIZE_EVENT = { "minecraft:slime": "spawn_small", "minecraft:magma_cube": "spawn_medium" };
const SIZE_VALUE = { "minecraft:slime": 1, "minecraft:magma_cube": 2 };
const recentSplits = [];

function spawnMob(dim, type, loc) {
  const event = SIZE_EVENT[type];
  if (!event) return dim.spawnEntity(type, loc);
  let e;
  try {
    e = dim.spawnEntity(type, loc, { spawnEvent: event });
  } catch {
    e = dim.spawnEntity(type, loc);
  }
  try {
    if (e.getComponent("minecraft:variant")?.value === SIZE_VALUE[type]) return e;
  } catch {}
  try {
    e.remove();
    dim.runCommand(`summon ${type} ${loc.x} ${loc.y} ${loc.z} 0 0 ${event}`);
    const found = dim.getEntities({ type, location: loc, maxDistance: 1.5 }).find((x) => x.getDynamicProperty("skyclans:sp") === undefined);
    if (found) return found;
  } catch {}
  return dim.spawnEntity(type, loc);
}

function findSpot(dim, d) {
  for (let i = 0; i < 8; i++) {
    const x = d.x + Math.floor(Math.random() * 5) - 2;
    const z = d.z + Math.floor(Math.random() * 5) - 2;
    for (const y of [d.y, d.y + 1, d.y - 1]) {
      try {
        const b = dim.getBlock({ x, y, z });
        const up = dim.getBlock({ x, y: y + 1, z });
        const below = dim.getBlock({ x, y: y - 1, z });
        if (b?.isAir && up?.isAir && below && !below.isAir) return { x: x + 0.5, y, z: z + 0.5 };
      } catch {}
    }
  }
  return { x: d.x + 0.5, y: d.y + 1, z: d.z + 0.5 };
}

function spawnFor(dim, key, d, count) {
  const type = entityType(d.mob);
  const center = { x: d.x + 0.5, y: d.y + 0.5, z: d.z + 0.5 };
  const near = dim.getEntities({ type, location: center, maxDistance: S.mergeRadius }).filter((e) => e.getDynamicProperty("skyclans:sp") === key);

  if (S.stackMobs) {
    const target = near.find((e) => !isFull(e));
    if (target) {
      setStack(target, d.mob, capStack(stackOf(target) + count));
      return;
    }
    if (near.length) return; // full stack nearby
    const spot = findSpot(dim, d);
    tagMob(spawnMob(dim, type, spot), key, d.mob, capStack(count), spot);
    return;
  }
  const room = Math.min(count, S.maxLooseMobs - near.length);
  for (let i = 0; i < room; i++) {
    const spot = findSpot(dim, d);
    tagMob(spawnMob(dim, type, spot), key, d.mob, 1, spot);
  }
}

function tick() {
  const players = world.getAllPlayers();
  const r2 = S.activationRange * S.activationRange;
  for (const [key, d] of spawners) {
    const active = players.some((p) => {
      if (p.dimension.id !== d.dim) return false;
      const l = p.location;
      return (l.x - d.x) ** 2 + (l.y - d.y) ** 2 + (l.z - d.z) ** 2 <= r2;
    });
    if (!active) continue;
    let dim, block;
    try {
      dim = world.getDimension(d.dim);
      block = dim.getBlock(d);
    } catch {
      continue;
    }
    if (!block) continue; // chunk not loaded
    if (block.typeId !== SPAWNER_BLOCK) {
      forget(key); // removed by a command, /fill, etc.
      continue;
    }
    d.timer = (d.timer ?? 0) + 1;
    if (d.timer < levelInfo(d.level).interval) continue;
    d.timer = 0;
    try {
      spawnFor(dim, key, d, d.stack * S.mobsPerSpawn);
    } catch (e) {
      console.warn(`[SkyClans] spawner ${key}: ${e}`);
    }
  }
}

// ---- events ---------------------------------------------------------------------
export function registerSpawners() {
  world.afterEvents.worldLoad.subscribe(() => {
    loadAll();
    system.runInterval(tick, 20);
    system.runInterval(holdMobs, 5);
  });

  world.beforeEvents.playerInteractWithBlock.subscribe((ev) => {
    const { player, block, itemStack } = ev;
    const info = spawnerFromItem(itemStack);
    if (block.typeId === SPAWNER_BLOCK) {
      const key = keyOf(block.dimension.id, block.location);
      if (spawners.has(key)) {
        const d = spawners.get(key);
        if (info && info.mob === d.mob) {
          ev.cancel = true;
          if (ev.isFirstEvent) system.run(() => addToStack(player, key, info, player.isSneaking));
          return;
        }
        if (player.isSneaking && !info) {
          ev.cancel = true;
          if (ev.isFirstEvent) system.run(() => spawnerMenu(player, key).catch((e) => console.warn(`[SkyClans] ${e}`)));
          return;
        }
      }
    }
    if (!info) return;
    ev.cancel = true;
    if (!ev.isFirstEvent) return;
    const face = ev.blockFace;
    system.run(() => placeSpawner(player, block, face, info));
  });

  // spawners can't be mined - pick them up from the spawner menu
  world.beforeEvents.playerBreakBlock.subscribe((ev) => {
    if (ev.block.typeId !== SPAWNER_BLOCK) return;
    if (!spawners.has(keyOf(ev.block.dimension.id, ev.block.location))) return;
    ev.cancel = true;
    const p = ev.player;
    system.run(() => p.sendMessage("§7Spawners can't be mined. §fSneak and tap it §7and press §cPick up§7."));
  });

  // ...or blown up. Spawner mobs (creepers) can't cause explosions at all when harmless.
  world.beforeEvents.explosion.subscribe((ev) => {
    if (S.harmlessMobs) {
      try {
        if (ev.source?.hasTag(MOB_TAG)) {
          ev.cancel = true;
          return;
        }
      } catch {}
    }
    const blocks = ev.getImpactedBlocks();
    const keep = blocks.filter((b) => !(b.typeId === SPAWNER_BLOCK && spawners.has(keyOf(b.dimension.id, b.location))));
    if (keep.length !== blocks.length) ev.setImpactedBlocks(keep);
  });

  // remove the pieces a stacked slime / magma cube splits into,
  // and anything a spawner mob shoots or throws (harmlessMobs)
  world.afterEvents.entitySpawn.subscribe(({ entity }) => {
    try {
      if (S.harmlessMobs && PROJECTILES.has(entity.typeId) && firedBySpawnerMob(entity)) {
        entity.remove();
        return;
      }
    } catch {}
    try {
      if (!SIZE_EVENT[entity.typeId] || entity.getDynamicProperty("skyclans:sp")) return;
      const now = system.currentTick;
      const l = entity.location;
      const split = recentSplits.some(
        (r) => r.type === entity.typeId && r.dim === entity.dimension.id && now - r.tick <= 40 &&
          (r.x - l.x) ** 2 + (r.y - l.y) ** 2 + (r.z - l.z) ** 2 <= 9
      );
      if (split) entity.remove();
    } catch {}
  });

  // stacked mobs: killing one leaves the rest; maybe drop an enchanted head
  world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
    let key, mob, stack, loc, dim, type, anchor;
    try {
      key = deadEntity.getDynamicProperty("skyclans:sp");
      if (typeof key !== "string") return;
      mob = String(deadEntity.getDynamicProperty("skyclans:mob"));
      stack = stackOf(deadEntity);
      loc = deadEntity.location;
      dim = deadEntity.dimension;
      type = deadEntity.typeId;
      const raw = deadEntity.getDynamicProperty("skyclans:anchor");
      anchor = typeof raw === "string" ? JSON.parse(raw) : loc;
    } catch {
      return;
    }
    if (SIZE_EVENT[type]) {
      recentSplits.push({ type, dim: dim.id, x: loc.x, y: loc.y, z: loc.z, tick: system.currentTick });
      if (recentSplits.length > 50) recentSplits.shift();
    }
    const d = spawners.get(key);
    if (d && Math.random() * 100 < levelInfo(d.level).headChance) {
      try {
        dim.spawnItem(new ItemStack(headItemId(mob), 1), loc);
      } catch {}
    }
    if (S.stackMobs && stack > 1) {
      try {
        tagMob(spawnMob(dim, type, anchor), key, mob, stack - 1, anchor);
      } catch {}
    }
  });
}
