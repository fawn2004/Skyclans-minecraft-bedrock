import { CommandPermissionLevel, CustomCommandStatus, system, world } from "@minecraft/server";
import { openMainMenu } from "./menus/mainMenu.js";
import { openAdminMenu } from "./menus/adminMenu.js";
import { registerSpawners } from "./spawners.js";

registerSpawners();

const MENU_ITEM = "skyclans:menu";

// Using the SkyClans Menu item opens the main menu.
world.afterEvents.itemUse.subscribe(({ source, itemStack }) => {
  if (itemStack?.typeId !== MENU_ITEM) return;
  openMainMenu(source).catch((e) => console.warn(`[SkyClans] main menu error: ${e}`));
});

// New players get the menu item once, the first time they join.
world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  if (!initialSpawn || player.getDynamicProperty("skyclans:gotMenu")) return;
  system.runTimeout(() => {
    if (!player.isValid) return;
    player.runCommand(`give @s ${MENU_ITEM}`);
    player.setDynamicProperty("skyclans:gotMenu", true);
  }, 20);
});

// /admin  (operators only) -> admin menu
system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
  customCommandRegistry.registerCommand(
    {
      name: "skyclans:admin",
      description: "Open the SkyClans admin menu",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      cheatsRequired: false,
    },
    (origin) => {
      const player = origin.sourceEntity;
      if (player?.typeId !== "minecraft:player") {
        return { status: CustomCommandStatus.Failure, message: "Only players can open the admin menu." };
      }
      // commands can't open forms directly, so do it on the next tick
      system.run(() => openAdminMenu(player).catch((e) => console.warn(`[SkyClans] admin menu error: ${e}`)));
      return { status: CustomCommandStatus.Success };
    }
  );
});
