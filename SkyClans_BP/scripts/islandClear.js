import { system, world } from "@minecraft/server";
import { freeIslandIndex, islandCentre, setDisbandHandler } from "./clans.js";
import { forgetSpawnersIn } from "./spawners.js";

// ============================================================================
//  CLEARING DISBANDED ISLANDS
//  When a clan is disbanded its whole plot (walls included) is set back to air,
//  one 16x16 chunk at a time, loading each chunk as it goes. Spawners, mobs,
//  items and the Island Core there are removed first. When it's done the spot is
//  freed, so the next new clan gets it.
//  Jobs are saved in the world, so a restart part way through carries on.
// ============================================================================

const KEY = "skyclans:clearJobs";
const BOTTOM = -64, TOP = 319;
let busy = false;

function jobs() {
  try {
    return JSON.parse(String(world.getDynamicProperty(KEY) ?? "[]"));
  } catch {
    return [];
  }
}
const saveJobs = (list) => world.setDynamicProperty(KEY, JSON.stringify(list));

/** Queues a disbanded clan's island to be cleared. */
function queueClear(clan) {
  const is = clan.island;
  if (!is) return;
  const list = jobs();
  list.push({ name: clan.name, index: is.index, cx: is.cx, cz: is.cz, size: is.size, step: 0 });
  saveJobs(list);
  system.run(runClearJobs);
}

/** 16x16 squares (chunk aligned) covering the plot + its wall. */
function squares(job) {
  const half = job.size / 2;
  const x0 = job.cx - half - 1, x1 = job.cx + half, z0 = job.cz - half - 1, z1 = job.cz + half;
  const out = [];
  for (let x = Math.floor(x0 / 16) * 16; x <= x1; x += 16) {
    for (let z = Math.floor(z0 / 16) * 16; z <= z1; z += 16) {
      out.push({ x0: Math.max(x, x0), x1: Math.min(x + 15, x1), z0: Math.max(z, z0), z1: Math.min(z + 15, z1) });
    }
  }
  return out;
}

async function loadSquare(dim, s, area) {
  const loaded = () => {
    try {
      return dim.getBlock({ x: s.x0, y: 64, z: s.z0 }) !== undefined && dim.getBlock({ x: s.x1, y: 64, z: s.z1 }) !== undefined;
    } catch {
      return false;
    }
  };
  if (loaded()) return true;
  try {
    dim.runCommand(`tickingarea remove ${area}`);
  } catch {}
  try {
    dim.runCommand(`tickingarea add ${s.x0} 0 ${s.z0} ${s.x1} 0 ${s.z1} ${area} true`);
  } catch {}
  for (let t = 0; t < 300; t += 5) {
    if (loaded()) return true;
    await system.waitTicks(5);
  }
  return false;
}

function clearSquare(dim, s) {
  // everything that isn't a player: mobs, items, the Island Core, spawner mobs...
  try {
    const ents = dim.getEntities({ location: { x: s.x0, y: BOTTOM, z: s.z0 }, volume: { x: s.x1 - s.x0 + 1, y: TOP - BOTTOM + 1, z: s.z1 - s.z0 + 1 } });
    for (const e of ents) if (e.typeId !== "minecraft:player") e.remove();
  } catch {}
  // blocks: 3 fills of at most 16x128x16 (the /fill limit is 32768 blocks)
  for (const [ya, yb] of [[-64, 63], [64, 191], [192, 319]]) {
    try {
      dim.runCommand(`fill ${s.x0} ${ya} ${s.z0} ${s.x1} ${yb} ${s.z1} air`);
    } catch {}
  }
}

async function runClearJobs() {
  if (busy) return;
  busy = true;
  const dim = world.getDimension("minecraft:overworld");
  try {
    let list = jobs();
    while (list.length) {
      const job = list[0];
      const half = job.size / 2;
      forgetSpawnersIn("minecraft:overworld", job.cx - half - 1, job.cx + half, job.cz - half - 1, job.cz + half);
      const sq = squares(job);
      const area = `skyclans_clear_${job.index}`;
      for (let i = job.step; i < sq.length; i++) {
        if (!(await loadSquare(dim, sq[i], area))) {
          console.warn(`[SkyClans] couldn't load part of ${job.name}'s old island - will retry`);
          saveJobs(list);
          return; // tried again in 30 seconds
        }
        clearSquare(dim, sq[i]);
        job.step = i + 1;
        if (i % 4 === 0) saveJobs(list);
      }
      try {
        dim.runCommand(`tickingarea remove ${area}`);
      } catch {}
      // only reuse spots that sit on the current island grid
      if (job.cx === islandCentre(job.index) && job.cz === islandCentre(job.index)) freeIslandIndex(job.index);
      list = jobs().filter((j) => !(j.index === job.index && j.cx === job.cx));
      saveJobs(list);
      console.warn(`[SkyClans] cleared ${job.name}'s old island at ${job.cx}, ${job.cz}`);
    }
  } catch (e) {
    console.warn(`[SkyClans] island clear error: ${e}`);
  } finally {
    busy = false;
  }
}

export function registerIslandClear() {
  setDisbandHandler(queueClear);
  world.afterEvents.worldLoad.subscribe(() => system.runInterval(runClearJobs, 20 * 30));
}
