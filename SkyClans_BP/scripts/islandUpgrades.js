import { BlockVolume, system, world } from "@minecraft/server";
import { ISLAND, can, clanOf, allClans, onlineMembers, plotAt, saveClan } from "./clans.js";
import { fmt } from "./money.js";

// ============================================================================
//  ISLAND CORE UPGRADES + UPKEEP
//
//  Each clan has clan.island.upgrades = { <module id>: level }.
//  Upgrades are bought from the clan bank (owner / co-owners).
//
//  Upkeep: UPKEEP_PER_LEVEL per hour for every upgrade level owned, taken from
//  the clan bank every hour. If the bank can't pay, upgrades PAUSE (they work as
//  level 0) until the bank can pay again. No upgrades = no upkeep.
// ============================================================================

export const UPKEEP_PER_LEVEL = 2000;
const HOUR = 60 * 60 * 1000;

// prices[i] = cost of going from level i to level i+1
export const MODULES = [
  {
    id: "sell",
    name: "Sell Multiplier",
    icon: "textures/ui/skyclans/coin",
    prices: [100000, 200000, 350000, 500000, 750000, 1000000, 1500000, 2000000],
    effect: (lvl) => `Sell prices x${(1 + lvl * 0.25).toFixed(2)}`,
  },
  {
    id: "fly",
    name: "Island Fly",
    icon: "textures/items/feather",
    prices: [500000],
    effect: (lvl) => (lvl ? "Fly anywhere on your island" : "No flying yet"),
  },
  {
    id: "spawners",
    name: "Spawner Cap",
    icon: "textures/blocks/mob_spawner",
    prices: [100000, 200000, 300000, 450000, 600000, 800000, 1000000, 1500000],
    effect: (lvl) => `Up to ${10 + lvl * 5} spawners`,
  },
  {
    id: "shield",
    name: "Raid Shield Length",
    icon: "textures/ui/skyclans/head_insurance",
    prices: [100000, 250000, 500000, 1000000],
    effect: (lvl) => `Shield holds up to ${12 + lvl * 3}h`,
  },
  {
    id: "lives",
    name: "Extra Raid Life",
    icon: "textures/ui/skyclans/icon_heart",
    prices: [250000, 1000000],
    effect: (lvl) => `Your clan raids with ${3 + lvl} lives`,
  },
];
export const moduleById = (id) => MODULES.find((m) => m.id === id);

const upgrades = (clan) => (clan.island.upgrades ??= {});
/** Level bought (whether or not upkeep is paid). */
export const levelOf = (clan, id) => upgrades(clan)[id] ?? 0;
/** Level that actually works right now (0 while upkeep is unpaid). */
export const activeLevel = (clan, id) => (upkeepPaid(clan) ? levelOf(clan, id) : 0);
export const totalLevels = (clan) => MODULES.reduce((n, m) => n + levelOf(clan, m.id), 0);
export const coreLevel = (clan) => 1 + totalLevels(clan);
export const upkeepPerHour = (clan) => totalLevels(clan) * UPKEEP_PER_LEVEL;

// ---- effects other files use -----------------------------------------------------------
export const spawnerCapOf = (clan) => 10 + activeLevel(clan, "spawners") * 5;
export const sellMultiplierOf = (clan) => 1 + activeLevel(clan, "sell") * 0.25;
/** Sell multiplier for a player (1 if they're not in a clan). */
export const sellMultiplier = (player) => {
  const c = clanOf(player);
  return c ? sellMultiplierOf(c) : 1;
};
export const raidShieldHours = (clan) => 12 + activeLevel(clan, "shield") * 3;
export const raidLives = (clan) => 3 + activeLevel(clan, "lives");

// ---- upkeep ---------------------------------------------------------------------------
function upkeepState(clan) {
  return (clan.island.upkeep ??= { paid: true, next: Date.now() + HOUR });
}
export const upkeepPaid = (clan) => upkeepState(clan).paid !== false;
export const nextChargeIn = (clan) => Math.max(0, upkeepState(clan).next - Date.now());

/** Charges every clan whose hour is up. Runs every minute. */
function chargeUpkeep() {
  const now = Date.now();
  for (const clan of allClans()) {
    const st = upkeepState(clan);
    const cost = upkeepPerHour(clan);
    if (cost === 0) {
      // nothing to pay: always counts as paid
      if (!st.paid || st.next < now) {
        st.paid = true;
        st.next = now + HOUR;
        saveClan(clan);
      }
      continue;
    }
    // unpaid clans pay as soon as the bank has enough again; paid ones once an hour
    if (st.paid && now < st.next) continue;
    if (clan.bank >= cost) {
      clan.bank -= cost;
      const wasPaused = !st.paid;
      st.paid = true;
      st.next = now + HOUR;
      saveClan(clan);
      if (wasPaused) tell(clan, `§a✔ Upkeep paid (${fmt(cost)}) - your island upgrades are working again.`);
    } else if (st.paid) {
      st.paid = false;
      saveClan(clan);
      tell(clan, `§c✘ The clan bank can't pay the island upkeep (${fmt(cost)} / hr). Upgrades are paused until you deposit enough.`);
    }
  }
}

const tell = (clan, msg) => {
  for (const p of onlineMembers(clan)) p.sendMessage(msg);
};

// ---- buying ------------------------------------------------------------------------------
/** Buys the next level of a module from the clan bank. -> error message or undefined */
export function buyUpgrade(player, moduleId) {
  const clan = clanOf(player);
  if (!clan) return "You're not in a clan.";
  if (!can(clan, player.id, "withdraw")) return "Only the owner and co-owners can buy upgrades.";
  const m = moduleById(moduleId);
  const lvl = levelOf(clan, m.id);
  if (lvl >= m.prices.length) return `${m.name} is already maxed.`;
  const price = m.prices[lvl];
  if (clan.bank < price) return `The clan bank needs ${fmt(price)} (it has ${fmt(clan.bank)}).`;
  clan.bank -= price;
  upgrades(clan)[m.id] = lvl + 1;
  if (totalLevels(clan) === 1) upkeepState(clan).next = Date.now() + HOUR; // first upkeep in an hour
  saveClan(clan);
  tell(clan, `§b[${clan.name}] §f${player.name} §7upgraded §f${m.name} §7to level §f${lvl + 1}§7: ${m.effect(lvl + 1)}.`);
}

// ---- island size: move the barrier walls (in slices, so any size works) --------------------
const WALL = "minecraft:barrier";
const WALL_BOTTOM = -64;
const WALL_TOP = 319; // the highest block in the world (320 is outside it and makes /fill fail)
let wallBusy = false;

/** Wall slices for a plot of `size`: [{ from, to }] up to 16 blocks long, full height. */
function wallSlices(cx, cz, size) {
  const half = size / 2;
  const x0 = cx - half - 1, x1 = cx + half, z0 = cz - half - 1, z1 = cz + half;
  const out = [];
  for (let x = x0; x <= x1; x += 16) {
    const xe = Math.min(x + 15, x1);
    out.push({ from: { x, z: z0 }, to: { x: xe, z: z0 } }, { from: { x, z: z1 }, to: { x: xe, z: z1 } });
  }
  for (let z = z0 + 1; z <= z1 - 1; z += 16) {
    const ze = Math.min(z + 15, z1 - 1);
    out.push({ from: { x: x0, z }, to: { x: x0, z: ze } }, { from: { x: x1, z }, to: { x: x1, z: ze } });
  }
  return out;
}

/** Starts building / fixing border walls in the background (new islands call this). */
export function queueWalls() {
  runWallJobs();
}

// Island Size used to be an upgrade (100 -> 150 -> 200 -> 300). Now every island is
// ISLAND.size; clans that bought size levels get the money back in their clan bank.
const OLD_SIZE_PRICES = [250000, 1000000, 5000000];
function migrateSize(clan) {
  const ups = clan.island.upgrades ?? {};
  if (ups.size) {
    const refund = OLD_SIZE_PRICES.slice(0, ups.size).reduce((a, b) => a + b, 0);
    clan.bank += refund;
    delete ups.size;
    tell(clan, `§b[SkyClans] §7Island Size upgrades were removed - every island is now ${ISLAND.size} x ${ISLAND.size}. §a${fmt(refund)} §7was refunded to your clan bank.`);
  }
  if (clan.island.size !== ISLAND.size && !clan.island.wallJob) {
    clan.island.wallJob = { oldSize: clan.island.size, newSize: ISLAND.size, step: 0 };
    clan.island.size = ISLAND.size;
  }
}

/** 0-100 while the border is moving, else undefined. */
export function wallProgress(clan) {
  const job = clan.island.wallJob;
  if (!job) return undefined;
  const total = (job.oldSize ? wallSlices(0, 0, job.oldSize).length : 0) + wallSlices(0, 0, job.newSize).length;
  return Math.min(99, Math.floor((job.step / total) * 100));
}

async function runWallJobs() {
  if (wallBusy) return;
  wallBusy = true;
  try {
    for (const clan of allClans()) {
      if (clan.island.built) migrateSize(clan);
      // new islands, and islands built before v0.15.2 (walls only to Y 127): build full height once
      if (!clan.island.wallJob && clan.island.built && !clan.island.wallsFull) {
        clan.island.wallJob = { oldSize: null, newSize: clan.island.size, step: 0, repair: true };
        saveClan(clan);
      }
      if (clan.island.wallJob) await wallJob(clan);
    }
  } catch (e) {
    console.warn(`[SkyClans] border move error: ${e}`);
  } finally {
    wallBusy = false;
  }
}

async function wallJob(clan) {
  const dim = world.getDimension("minecraft:overworld");
  const { cx, cz } = clan.island;
  const job = clan.island.wallJob;
  // first remove the old walls (only barrier blocks), then build the new ones
  const steps = [
    ...(job.oldSize ? wallSlices(cx, cz, job.oldSize).map((s) => ({ ...s, remove: true })) : []),
    ...wallSlices(cx, cz, job.newSize).map((s) => ({ ...s, remove: false })),
  ];
  const area = `skyclans_wall_${clan.island.index}`;
  let lastTold = Math.floor((job.step / steps.length) * 4);
  for (let i = job.step; i < steps.length; i++) {
    const s = steps[i];
    // both ends of the slice must be loaded, or the fill fails
    if (!(await loadSlice(dim, s, area))) {
      if (!job.warned) {
        job.warned = true;
        tell(clan, "§eYour island border is waiting for its area to load - it keeps trying, or stand near the edge of your island to speed it up.");
      }
      saveClan(clan);
      return; // runWallJobs tries again in 30 seconds
    }
    for (const [ya, yb] of [[WALL_BOTTOM, 127], [128, WALL_TOP]]) {
      fillSlice(dim, { x: s.from.x, y: ya, z: s.from.z }, { x: s.to.x, y: yb, z: s.to.z }, s.remove);
    }
    job.step = i + 1;
    if (i % 8 === 0) saveClan(clan);
    const quarter = Math.floor((job.step / steps.length) * 4);
    if (!job.repair && quarter > lastTold && quarter < 4) {
      lastTold = quarter;
      tell(clan, `§7Moving your island border... §f${quarter * 25}%`);
    }
  }
  try {
    dim.runCommand(`tickingarea remove ${area}`);
  } catch {}
  delete clan.island.wallJob;
  clan.island.wallsFull = true;
  saveClan(clan);
  if (!job.repair) tell(clan, `§a✔ Your island border is now ${job.newSize} x ${job.newSize}.`);
}

/** Fills one slice: barrier (build) or barrier -> air (remove). Script fill first, /fill as backup. */
function fillSlice(dim, from, to, remove) {
  try {
    if (remove) dim.fillBlocks(new BlockVolume(from, to), "minecraft:air", { blockFilter: { includeTypes: [WALL] } });
    else dim.fillBlocks(new BlockVolume(from, to), WALL);
    return;
  } catch {}
  const cmd = remove ? "air replace barrier" : WALL;
  try {
    dim.runCommand(`fill ${from.x} ${from.y} ${from.z} ${to.x} ${to.y} ${to.z} ${cmd}`);
  } catch {} // removing where there's no barrier "fails" - that's fine
}

/** Loads both ends of a wall slice (with a small ticking area if needed). */
async function loadSlice(dim, s, area) {
  const loaded = (x, z) => {
    try {
      return dim.getBlock({ x, y: 64, z }) !== undefined;
    } catch {
      return false;
    }
  };
  const ok = () => loaded(s.from.x, s.from.z) && loaded(s.to.x, s.to.z);
  if (ok()) return true;
  const mx = Math.floor((s.from.x + s.to.x) / 2), mz = Math.floor((s.from.z + s.to.z) / 2);
  try {
    dim.runCommand(`tickingarea remove ${area}`);
  } catch {}
  try {
    dim.runCommand(`tickingarea add circle ${mx} 64 ${mz} 2 ${area} true`);
  } catch (e) {
    console.warn(`[SkyClans] tickingarea failed at ${mx},${mz}: ${e}`);
  }
  for (let t = 0; t < 300; t += 5) {
    if (ok()) return true;
    await system.waitTicks(5);
  }
  return false;
}

// ---- island fly ------------------------------------------------------------------------------
// Uses the /ability command, which needs "Education Edition" turned on in the world settings.
const FLY_TAG = "skyclans_fly";
let flyWarned = false;

function setFly(player, on) {
  try {
    player.runCommand(`ability @s mayfly ${on}`);
    if (on) player.addTag(FLY_TAG);
    else player.removeTag(FLY_TAG);
  } catch {
    if (on && !flyWarned) {
      flyWarned = true;
      player.sendMessage("§cIsland Fly needs Education Edition turned on in the world settings (it uses /ability).");
    }
  }
}

function updateFly() {
  for (const p of world.getAllPlayers()) {
    try {
      const mode = String(p.getGameMode()).toLowerCase();
      if (mode === "creative" || mode === "spectator") continue;
      const clan = clanOf(p);
      const l = p.location;
      const allowed =
        !!clan && activeLevel(clan, "fly") > 0 && p.dimension.id === "minecraft:overworld" && plotAt(l.x, l.z)?.id === clan.id;
      const has = p.hasTag(FLY_TAG);
      if (allowed && !has) setFly(p, true);
      else if (!allowed && has) {
        setFly(p, false);
        p.addEffect("slow_falling", 100, { showParticles: false }); // don't drop like a stone at the border
      }
    } catch {}
  }
}

export function registerIslandUpgrades() {
  world.afterEvents.worldLoad.subscribe(() => {
    system.runInterval(chargeUpkeep, 20 * 60);
    system.runInterval(updateFly, 20);
    system.runInterval(runWallJobs, 20 * 30); // finish / retry border moves (and repair old walls)
  });
}

