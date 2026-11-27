import { BlockTypes, BlockVolume, ItemStack, system, world } from "@minecraft/server";
import { ISLAND, clanById, clanOf, inIslandZone, markIslandBuilt, plotAt } from "./clans.js";
import { getSpawn } from "./serverSettings.js";
import { isAdmin } from "./spawners.js";

// ============================================================================
//  ISLANDS - building a clan's starter island and border, /is home, protection.
//
//  The plot is ISLAND.sizes[0] (100) blocks square around the island centre.
//  A wall of barrier blocks (invisible, unbreakable) stands just outside it,
//  from the bottom of the world (-64) to the top (320).
//
//  Protection (everyone except admins):
//   - island area: you can only build / break / open things inside your clan's plot
//   - spawn: a 1000 x 1000 area around spawn - only players in CREATIVE can build / break there
// ============================================================================

const WALL_BLOCK = "minecraft:barrier";
const WORLD_BOTTOM = -64;
const WORLD_TOP = 320;
const SPAWN_PROTECT = 500; // blocks each way from spawn = 1000 x 1000

const STARTER_CHEST = [
  ["minecraft:lava_bucket", 1],
  ["minecraft:ice", 2],
  ["minecraft:oak_sapling", 2],
  ["minecraft:wheat_seeds", 8],
  ["minecraft:bone_meal", 8],
  ["minecraft:bread", 8],
  ["minecraft:torch", 16],
];

const overworld = () => world.getDimension("minecraft:overworld");

/** fill from -> to (inclusive) with a block. Uses the script fill, falls back to /fill. */
function fill(dim, from, to, block) {
  try {
    dim.fillBlocks(new BlockVolume(from, to), block);
  } catch {
    try {
      dim.runCommand(`fill ${from.x} ${from.y} ${from.z} ${to.x} ${to.y} ${to.z} ${block}`);
    } catch (e) {
      console.warn(`[SkyClans] fill failed ${JSON.stringify(from)} -> ${JSON.stringify(to)}: ${e}`);
    }
  }
}

function setBlock(dim, loc, block) {
  try {
    dim.getBlock(loc)?.setType(block);
  } catch {}
}

const loaded = (dim, x, z) => {
  try {
    return dim.getBlock({ x, y: ISLAND.y, z }) !== undefined;
  } catch {
    return false;
  }
};

/** Waits (up to `ticks`) until the whole plot plus its wall is loaded. */
async function waitLoaded(dim, cx, cz, half, ticks) {
  for (let t = 0; t < ticks; t += 10) {
    if (loaded(dim, cx - half - 1, cz - half - 1) && loaded(dim, cx + half, cz + half) && loaded(dim, cx, cz)) return true;
    await system.waitTicks(10);
  }
  return false;
}

function buildStarterIsland(dim, cx, cz) {
  const y = ISLAND.y; // grass level
  fill(dim, { x: cx - 2, y: y - 3, z: cz - 2 }, { x: cx + 2, y: y - 3, z: cz + 2 }, "minecraft:dirt");
  fill(dim, { x: cx - 3, y: y - 2, z: cz - 3 }, { x: cx + 3, y: y - 2, z: cz + 3 }, "minecraft:dirt");
  fill(dim, { x: cx - 4, y: y - 1, z: cz - 4 }, { x: cx + 4, y: y - 1, z: cz + 4 }, "minecraft:dirt");
  fill(dim, { x: cx - 4, y, z: cz - 4 }, { x: cx + 4, y, z: cz + 4 }, "minecraft:grass_block");
  for (const [dx, dz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) {
    setBlock(dim, { x: cx + dx, y, z: cz + dz }, "minecraft:air");
    setBlock(dim, { x: cx + dx, y: y - 1, z: cz + dz }, "minecraft:air");
  }

  // oak tree
  const tx = cx + 2, tz = cz + 2;
  fill(dim, { x: tx - 2, y: y + 4, z: tz - 2 }, { x: tx + 2, y: y + 5, z: tz + 2 }, "minecraft:oak_leaves");
  fill(dim, { x: tx - 1, y: y + 6, z: tz - 1 }, { x: tx + 1, y: y + 6, z: tz + 1 }, "minecraft:oak_leaves");
  fill(dim, { x: tx, y: y + 7, z: tz - 1 }, { x: tx, y: y + 7, z: tz + 1 }, "minecraft:oak_leaves");
  fill(dim, { x: tx - 1, y: y + 7, z: tz }, { x: tx + 1, y: y + 7, z: tz }, "minecraft:oak_leaves");
  fill(dim, { x: tx, y: y + 1, z: tz }, { x: tx, y: y + 5, z: tz }, "minecraft:oak_log");

  // starter chest
  const chestLoc = { x: cx - 2, y: y + 1, z: cz - 2 };
  setBlock(dim, chestLoc, "minecraft:chest");
  try {
    const inv = dim.getBlock(chestLoc)?.getComponent("minecraft:inventory")?.container;
    for (const [id, n] of STARTER_CHEST) inv?.addItem(new ItemStack(id, n));
  } catch {}
}

/** Barrier wall just outside a plot of `size`, bottom to top of the world. */
export function buildWalls(dim, cx, cz, size, block = WALL_BLOCK) {
  const half = size / 2;
  const x0 = cx - half - 1, x1 = cx + half; // wall columns
  const z0 = cz - half - 1, z1 = cz + half;
  const mid = 127;
  for (const [ya, yb] of [[WORLD_BOTTOM, mid], [mid + 1, WORLD_TOP]]) {
    fill(dim, { x: x0, y: ya, z: z0 }, { x: x1, y: yb, z: z0 }, block); // north
    fill(dim, { x: x0, y: ya, z: z1 }, { x: x1, y: yb, z: z1 }, block); // south
    fill(dim, { x: x0, y: ya, z: z0 }, { x: x0, y: yb, z: z1 }, block); // west
    fill(dim, { x: x1, y: ya, z: z0 }, { x: x1, y: yb, z: z1 }, block); // east
  }
}

const building = new Set(); // clan ids being built right now

/** Builds the clan's island + walls (once), then sends the player home. */
export async function buildIsland(player, clan) {
  if (clan.island.built) return teleportHome(player, clan);
  if (building.has(clan.id)) return player.sendMessage("§7Your island is still being built - hang on...");
  building.add(clan.id);
  const dim = overworld();
  const { cx, cz, size, index } = clan.island;
  const half = size / 2;
  const area = `skyclans_island_${index}`;
  player.sendMessage("§b[SkyClans] §7Building your island...");
  try {
    // keep the plot loaded while we build (radius 4 chunks covers a 100 block plot + wall)
    try {
      dim.runCommand(`tickingarea add circle ${cx} ${ISLAND.y} ${cz} 4 ${area} true`);
    } catch {}
    let ok = await waitLoaded(dim, cx, cz, half, 200);
    if (!ok) {
      // not loaded yet: bring the player over (slow falling so they don't drop into the void)
      player.addEffect("slow_falling", 400, { showParticles: false });
      player.teleport({ x: cx + 0.5, y: ISLAND.y + 20, z: cz + 0.5 }, { dimension: dim });
      ok = await waitLoaded(dim, cx, cz, half, 200);
    }
    if (!ok) {
      player.sendMessage("§cCouldn't load your island area - try /is home again in a moment.");
      return;
    }
    buildStarterIsland(dim, cx, cz);
    buildWalls(dim, cx, cz, size);
    markIslandBuilt(clan);
    ensureCore(clan);
    player.sendMessage("§a✔ Your island is ready!");
  } finally {
    building.delete(clan.id);
    try {
      dim.runCommand(`tickingarea remove ${area}`);
    } catch {}
  }
  if (clan.island.built) teleportHome(player, clan);
}

export function teleportHome(player, clan) {
  const h = clan.island.home;
  player.teleport({ x: h.x + 0.5, y: h.y, z: h.z + 0.5 }, { dimension: overworld() });
  player.sendMessage(`§b[SkyClans] §7Welcome home to §f${clan.name}§7.`);
  // islands made before the core existed get one once the area has loaded
  system.runTimeout(() => ensureCore(clan), 40);
}

// ---- Island Core -----------------------------------------------------------------------
// A custom entity (Rune Rings model) standing on the island, just off the centre.
// Tapping it opens the Core Terminal (menus/coreMenu.js).
export const CORE_ID = "skyclans:island_core";
const CORE_TAG = "skyclans_core";
export const corePos = (clan) => ({ x: clan.island.cx + 0.5, y: ISLAND.y + 1, z: clan.island.cz - 2.5 });

/** Spawns the clan's core if it isn't there. Only works while the island area is loaded. */
export function ensureCore(clan) {
  const dim = overworld();
  const pos = corePos(clan);
  try {
    if (!dim.getBlock(pos)) return; // not loaded
    const there = dim.getEntities({ type: CORE_ID, location: pos, maxDistance: 6 });
    if (there.length) {
      for (const e of there.slice(1)) e.remove(); // never more than one
      return;
    }
    const core = dim.spawnEntity(CORE_ID, pos);
    core.setDynamicProperty("skyclans:clan", clan.id);
    core.addTag(CORE_TAG);
    core.nameTag = "";
  } catch (e) {
    console.warn(`[SkyClans] couldn't place the island core for ${clan.name}: ${e}`);
  }
}

/** Which clan an Island Core entity belongs to (by tag, else by where it stands). */
export function clanOfCore(entity) {
  const id = entity.getDynamicProperty("skyclans:clan");
  const byTag = typeof id === "string" ? clanById(id) : undefined;
  return byTag ?? plotAt(entity.location.x, entity.location.z);
}

/** /is home and the Island Home tile. */
export function goHome(player) {
  const clan = clanOf(player);
  if (!clan) return player.sendMessage("§cYou're not in a clan. Create one first (/is create <name>).");
  return buildIsland(player, clan);
}

// ---- protection -----------------------------------------------------------------------
const isCreative = (p) => {
  try {
    return String(p.getGameMode()).toLowerCase() === "creative";
  } catch {
    return false;
  }
};

function nearSpawn(dimId, l) {
  const s = getSpawn();
  if ((s.dim ?? "minecraft:overworld") !== dimId) return false;
  return Math.abs(l.x - s.x) <= SPAWN_PROTECT && Math.abs(l.z - s.z) <= SPAWN_PROTECT;
}

/** Can this player change the block at l (in dimension dimId)? */
export function canBuild(player, dimId, l) {
  if (nearSpawn(dimId, l)) return isCreative(player); // spawn: creative only (admin tag doesn't count)
  if (isAdmin(player)) return true;
  if (dimId !== "minecraft:overworld" || !inIslandZone(l.x, l.z)) return true;
  const mine = clanOf(player);
  return !!mine && plotAt(l.x, l.z)?.id === mine.id;
}

// Items that place or change blocks when used on a block
const PLACES = /bucket|flint_and_steel|fire_charge|spawn_egg|bone_meal|boat|minecart|armor_stand|item_frame|painting|end_crystal/;
const isPlacing = (item) => {
  if (!item) return false;
  if (PLACES.test(item.typeId)) return true;
  try {
    return !!BlockTypes.get(item.typeId);
  } catch {
    return false;
  }
};

const FACE = {
  Up: { x: 0, y: 1, z: 0 }, Down: { x: 0, y: -1, z: 0 }, North: { x: 0, y: 0, z: -1 },
  South: { x: 0, y: 0, z: 1 }, East: { x: 1, y: 0, z: 0 }, West: { x: -1, y: 0, z: 0 },
};

const warned = new Map(); // player id -> tick (don't spam the message)
function deny(player, msg) {
  const now = system.currentTick;
  if ((warned.get(player.id) ?? -100) > now - 40) return;
  warned.set(player.id, now);
  system.run(() => player.sendMessage(`§c${msg}`));
}

export function registerIslands() {
  world.beforeEvents.playerBreakBlock.subscribe((ev) => {
    const { player, block } = ev;
    if (canBuild(player, block.dimension.id, block.location)) return;
    ev.cancel = true;
    deny(player, nearSpawn(block.dimension.id, block.location) ? "Spawn is protected." : "You can only build on your own island.");
  });

  world.beforeEvents.playerInteractWithBlock.subscribe((ev) => {
    const { player, block, itemStack, blockFace } = ev;
    const dimId = block.dimension.id;
    const l = block.location;
    const placing = isPlacing(itemStack);
    if (nearSpawn(dimId, l) && !isCreative(player)) {
      // at spawn: doors / buttons are fine, placing things isn't
      if (!placing) return;
      ev.cancel = true;
      return deny(player, "Spawn is protected.");
    }
    const f = FACE[blockFace] ?? FACE.Up;
    const target = { x: l.x + f.x, y: l.y + f.y, z: l.z + f.z };
    if (canBuild(player, dimId, l) && (!placing || canBuild(player, dimId, target))) return;
    ev.cancel = true;
    deny(player, "You can only build on your own island.");
  });

  // explosions only break blocks in the plot they started in, and never at spawn
  world.beforeEvents.explosion.subscribe((ev) => {
    const dimId = ev.dimension.id;
    let home;
    try {
      const s = ev.source?.location;
      home = s && dimId === "minecraft:overworld" && inIslandZone(s.x, s.z) ? plotAt(s.x, s.z)?.id ?? "none" : undefined;
    } catch {}
    const blocks = ev.getImpactedBlocks();
    const keep = blocks.filter((b) => {
      const l = b.location;
      if (nearSpawn(dimId, l)) return false;
      if (dimId !== "minecraft:overworld" || !inIslandZone(l.x, l.z)) return true;
      return home !== undefined && plotAt(l.x, l.z)?.id === home;
    });
    if (keep.length !== blocks.length) ev.setImpactedBlocks(keep);
  });
}
