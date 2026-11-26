import { system, world } from "@minecraft/server";
import { openMainMenu } from "./menus/mainMenu.js";
import { registerSpawners } from "./spawners.js";
import { registerSidebar } from "./sidebar.js";
import { registerPlayerSettings } from "./playerSettings.js";
import { addMoney, fmt } from "./money.js";
import { getStartingMoney } from "./serverSettings.js";
import { crateMenu, crateOfKey } from "./crates.js";
import { registerCommands } from "./commands.js";

registerSpawners();
registerSidebar();
registerPlayerSettings();
registerCommands(); // all the /commands are in commands.js

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
