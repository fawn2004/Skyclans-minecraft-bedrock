import { world } from "@minecraft/server";
import { openShopCategory } from "./menus/shopMenu.js";

// ============================================================================
//  SHOP NPCs - one entity ("skyclans:npc"), seven looks (variants).
//  Tap (or hit) one to open its shop category. They can't be hurt or pushed.
//  Admins place them with /npc <type> and remove the nearest with /npc remove.
// ============================================================================

export const NPC_ID = "skyclans:npc";

// type -> floating name + the shop category it opens (names match shopMenu.js)
export const NPC_TYPES = {
  spawner: { name: "§d§lSpawner Shop", category: "Spawners" },
  kits: { name: "§9§lKit Shop", category: "Kits" },
  ores: { name: "§b§lOre Shop", category: "Ores" },
  farming: { name: "§a§lFarming Shop", category: "Farming" },
  blocks: { name: "§6§lBlock Shop", category: "Blocks" },
  redstone: { name: "§c§lRedstone Shop", category: "Redstone" },
  food: { name: "§e§lFood Shop", category: "Food" },
};

const nameTag = (type) => `${NPC_TYPES[type].name}\n§r§7Tap to §f[§aBuy§f]`;

/** Places an NPC where the player stands, facing them. -> the entity */
export function spawnNpc(player, type) {
  const l = player.location;
  const pos = { x: Math.floor(l.x) + 0.5, y: Math.floor(l.y), z: Math.floor(l.z) + 0.5 };
  const npc = player.dimension.spawnEntity(NPC_ID, pos, { spawnEvent: `skyclans:as_${type}` });
  npc.setDynamicProperty("skyclans:npc", type);
  npc.nameTag = nameTag(type);
  // face the way the player is looking (so it faces you when you step back)
  try {
    npc.setRotation({ x: 0, y: player.getRotation().y + 180 });
  } catch {}
  return npc;
}

/** Removes the closest NPC within 4 blocks. -> its type, or undefined */
export function removeNearestNpc(player) {
  const near = player.dimension.getEntities({ type: NPC_ID, location: player.location, maxDistance: 4, closest: 1 });
  const npc = near[0];
  if (!npc) return undefined;
  const type = npc.getDynamicProperty("skyclans:npc");
  npc.remove();
  return typeof type === "string" ? type : "npc";
}

function tapped(player, entity) {
  if (entity?.typeId !== NPC_ID || player?.typeId !== "minecraft:player") return;
  const type = entity.getDynamicProperty("skyclans:npc");
  const info = NPC_TYPES[type];
  if (!info) return;
  entity.nameTag = nameTag(type); // keep the name right if it was ever changed
  openShopCategory(player, info.category)?.catch?.((e) => console.warn(`[SkyClans] npc shop error: ${e}`));
}

export function registerNpcs() {
  world.afterEvents.playerInteractWithEntity.subscribe(({ player, target }) => tapped(player, target));
  world.afterEvents.entityHitEntity.subscribe(({ damagingEntity, hitEntity }) => tapped(damagingEntity, hitEntity));
}
