import { system, world } from "@minecraft/server";
import { openMainMenu } from "./menus/mainMenu.js";
import { registerSpawners } from "./spawners.js";
import { registerSidebar } from "./sidebar.js";
import { registerPlayerSettings } from "./playerSettings.js";
import { addMoney, fmt } from "./money.js";
import { getStartingMoney } from "./serverSettings.js";
import { crateMenu, crateOfKey } from "./crates.js";
import { registerCommands } from "./commands.js";
import { loadClans } from "./clans.js";
import { CORE_ID, clanOfCore, registerIslands } from "./islands.js";
import { openCoreMenu } from "./menus/coreMenu.js";

registerSpawners();
registerSidebar();
registerPlayerSettings();
registerCommands(); // all the /commands are in commands.js
registerIslands(); // island protection
world.afterEvents.worldLoad.subscribe(() => loadClans());

const MENU_ITEM = "skyclans:menu";

// Using the SkyClans Menu item opens the main menu; using a crate key opens its crate.
world.afterEvents.itemUse.subscribe(({ source, itemStack }) => {
  if (itemStack?.typeId === MENU_ITEM) {
    openMainMenu(source).catch((e) => console.warn(`[SkyClans] main menu error: ${e}`));
    return;
  }
  const crate = crateOfKey(itemStack?.typeId);
  if (crate) crateMenu(source, crate).catch((e) => console.warn(`[SkyClans] crate error: ${e}`));
});

// Tapping (or hitting) an Island Core opens the Core Terminal.
function coreTapped(player, entity) {
  if (entity?.typeId !== CORE_ID || player?.typeId !== "minecraft:player") return;
  const clan = clanOfCore(entity);
  if (!clan) return player.sendMessage("§7This Island Core doesn't belong to a clan any more.");
  openCoreMenu(player, clan).catch((e) => console.warn(`[SkyClans] core menu error: ${e}`));
}
world.afterEvents.playerInteractWithEntity.subscribe(({ player, target }) => coreTapped(player, target));
world.afterEvents.entityHitEntity.subscribe(({ damagingEntity, hitEntity }) => coreTapped(damagingEntity, hitEntity));

// New players get the menu item and the starting money, once.
world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  if (!initialSpawn || player.getDynamicProperty("skyclans:gotMenu")) return;
  system.runTimeout(() => {
    if (!player.isValid) return;
    player.runCommand(`give @s ${MENU_ITEM}`);
    player.setDynamicProperty("skyclans:gotMenu", true);
    const start = getStartingMoney();
    if (start > 0) {
      addMoney(player, start);
      player.sendMessage(`§b[SkyClans] §7Welcome! You got §a${fmt(start)} §7to start.`);
    }
  }, 20);
});
