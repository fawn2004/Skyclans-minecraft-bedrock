import { system, world } from "@minecraft/server";
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
    id: "size",
    name: "Island Size",
    icon: "textures/ui/skyclans/icon_expand",
    prices: [250000, 1000000, 5000000],
    effect: (lvl) => `Border ${ISLAND.sizes[lvl]} x ${ISLAND.sizes[lvl]}`,
  },
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
    effect: (lvl) => `Immune ${12 + lvl * 3}h after a raid`,
  },
  {
    id: "lives",
    name: "Extra Raid Life",
    icon: "textures/ui/skyclans/icon_heart",
    prices: [250000, 1000000],
    effect: (lvl) => `Your raiders get ${3 + lvl} lives`,
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
  if (m.id === "size" && clan.island.wallJob) return "The island border is still moving - try again in a minute.";
  const price = m.prices[lvl];
  if (clan.bank < price) return `The clan bank needs ${fmt(price)} (it has ${fmt(clan.bank)}).`;
  clan.bank -= price;
  upgrades(clan)[m.id] = lvl + 1;
  if (totalLevels(clan) === 1) upkeepState(clan).next = Date.now() + HOUR; // first upkeep in an hour
  saveClan(clan);
  if (m.id === "size") resizeIsland(clan, ISLAND.sizes[lvl], ISLAND.sizes[lvl + 1]);
  tell(clan, `§b[${clan.name}] §f${player.name} §7upgraded §f${m.name} §7to level §f${lvl + 1}§7: ${m.effect(lvl + 1)}.`);
}

// ---- island size: move the barrier walls (in slices, so any size works) --------------------
const WALL = "minecraft:barrier";
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

export function resizeIsland(clan, oldSize, newSize) {
  clan.island.size = newSize;
  clan.island.wallJob = { oldSize, newSize, step: 0 };
  saveClan(clan);
  runWallJobs();
}

async function runWallJobs() {
  if (wallBusy) return;
  wallBusy = true;
  try {
    for (const clan of allClans()) {
      if (clan.island.wallJob) await wallJob(clan);
    }
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
    ...wallSlices(cx, cz, job.oldSize).map((s) => ({ ...s, cmd: "air replace barrier" })),
    ...wallSlices(cx, cz, job.newSize).map((s) => ({ ...s, cmd: WALL })),
  ];
  const area = `skyclans_wall_${clan.island.index}`;
  for (let i = job.step; i < steps.length; i++) {
    const s = steps[i];
    const mx = Math.floor((s.from.x + s.to.x) / 2), mz = Math.floor((s.from.z + s.to.z) / 2);
    if (!(await loadAt(dim, mx, mz, area))) {
      console.warn(`[SkyClans] couldn't load ${mx},${mz} to move ${clan.name}'s wall - will retry later`);
      return;
    }
    for (const [ya, yb] of [[-64, 127], [128, 320]]) {
      try {
        dim.runCommand(`fill ${s.from.x} ${ya} ${s.from.z} ${s.to.x} ${yb} ${s.to.z} ${s.cmd}`);
      } catch {}
    }
    job.step = i + 1;
    if (i % 8 === 0) saveClan(clan);
  }
  try {
    dim.runCommand(`tickingarea remove ${area}`);
  } catch {}
  delete clan.island.wallJob;
  saveClan(clan);
  tell(clan, `§a✔ Your island border is now ${job.newSize} x ${job.newSize}.`);
}

/** Makes sure the chunk at x,z is loaded (with a small ticking area if needed). */
async function loadAt(dim, x, z, area) {
  const ok = () => {
    try {
      return dim.getBlock({ x, y: 64, z }) !== undefined;
    } catch {
      return false;
    }
  };
  if (ok()) return true;
  try {
    dim.runCommand(`tickingarea remove ${area}`);
  } catch {}
  try {
    dim.runCommand(`tickingarea add circle ${x} 64 ${z} 1 ${area} true`);
  } catch {}
  for (let t = 0; t < 200; t += 5) {
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
    system.runTimeout(runWallJobs, 100); // finish any wall move interrupted by a restart
  });
}

