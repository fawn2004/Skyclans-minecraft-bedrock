import { world } from "@minecraft/server";

// ============================================================================
//  SERVER SETTINGS - changed in game from /admin, saved in the world.
// ============================================================================

const DEFAULTS = {
  startingMoney: 1000, // given to each new player once
  sidebar: true, // sidebar on the right for everyone
  spawn: { x: 0, y: 0, z: 0, dim: "minecraft:overworld" }, // where the Spawn button sends you
};

function read(key) {
  const raw = world.getDynamicProperty(`skyclans:cfg:${key}`);
  if (raw === undefined) return DEFAULTS[key];
  try {
    return JSON.parse(String(raw));
  } catch {
    return DEFAULTS[key];
  }
}

function write(key, value) {
  world.setDynamicProperty(`skyclans:cfg:${key}`, JSON.stringify(value));
}

export const getStartingMoney = () => Number(read("startingMoney"));
export const setStartingMoney = (n) => write("startingMoney", Math.max(0, Math.floor(n)));

export const sidebarEnabled = () => read("sidebar") === true;
export const setSidebarEnabled = (on) => write("sidebar", !!on);

export const getSpawn = () => read("spawn");
export function setSpawnHere(player) {
  const l = player.location;
  write("spawn", { x: Math.floor(l.x), y: Math.floor(l.y), z: Math.floor(l.z), dim: player.dimension.id });
}
