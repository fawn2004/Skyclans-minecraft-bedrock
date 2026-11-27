import { world } from "@minecraft/server";
import { SPAWNERS } from "./spawnerConfig.js";
import { CRATES, giveKeys } from "./crates.js";

// ============================================================================
//  CRATE KEY DROPS
//  Killing one of the Spawner Shop mobs (from a spawner or not) has a small
//  chance of giving the killer a crate key. Only kills by a player count
//  (arrows too). At most one key per kill; rarest checked first.
//  "1 in N" = the chance per kill. Kept rare so keys don't become a money farm.
// ============================================================================

const ODDS = [
  { crate: "legendary", oneIn: 5000 },
  { crate: "rare", oneIn: 2000 },
  { crate: "common", oneIn: 500 },
];

const MOBS = new Set(SPAWNERS.map((s) => `minecraft:${s.mob}`));

function onKill({ deadEntity, damageSource }) {
  let type, killer;
  try {
    type = deadEntity.typeId;
    killer = damageSource?.damagingEntity;
  } catch {
    return;
  }
  if (!MOBS.has(type) || killer?.typeId !== "minecraft:player") return;

  for (const { crate, oneIn } of ODDS) {
    if (Math.random() * oneIn >= 1) continue;
    const name = CRATES[crate].name;
    try {
      giveKeys(killer, crate, 1);
      killer.sendMessage(`§b[SkyClans] §fYou found a ${CRATES[crate].colour}§l${name} Key§r§f!`);
      killer.playSound(crate === "legendary" ? "random.totem" : "random.levelup");
      if (crate === "legendary") world.sendMessage(`§6§l✦ §r§f${killer.name} §7found a §6§lLegendary Key§r§7!`);
    } catch {}
    return; // one key per kill at most
  }
}

export function registerKeyDrops() {
  world.afterEvents.entityDie.subscribe(onKill);
}
