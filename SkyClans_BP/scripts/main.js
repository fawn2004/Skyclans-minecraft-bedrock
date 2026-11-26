import { CommandPermissionLevel, CustomCommandParamType, CustomCommandStatus, system, world } from "@minecraft/server";
import { openMainMenu } from "./menus/mainMenu.js";
import { openAdminMenu } from "./menus/adminMenu.js";
import { registerSpawners } from "./spawners.js";
import { registerSidebar } from "./sidebar.js";
import { registerPlayerSettings } from "./playerSettings.js";
import { addMoney, fmt, fmtExact, getBalance, takeMoney } from "./money.js";
import { getStartingMoney } from "./serverSettings.js";
import { crateMenu, crateOfKey } from "./crates.js";

registerSpawners();
registerSidebar();
registerPlayerSettings();

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

// ---- commands ----------------------------------------------------------------------
// Command callbacks can't change the world directly, so the work runs on the next tick.
const later = (fn) => system.run(fn);
const asPlayer = (origin) => (origin.sourceEntity?.typeId === "minecraft:player" ? origin.sourceEntity : undefined);
const failed = (message) => ({ status: CustomCommandStatus.Failure, message });

system.beforeEvents.startup.subscribe(({ customCommandRegistry: reg }) => {
  // /admin  (operators only) -> admin menu
  reg.registerCommand(
    { name: "skyclans:admin", description: "Open the SkyClans admin menu", permissionLevel: CommandPermissionLevel.GameDirectors, cheatsRequired: false },
    (origin) => {
      const player = asPlayer(origin);
      if (!player) return failed("Only players can open the admin menu.");
      later(() => openAdminMenu(player).catch((e) => console.warn(`[SkyClans] admin menu error: ${e}`)));
      return { status: CustomCommandStatus.Success };
    }
  );

  // /bal  -> your balance
  reg.registerCommand(
    { name: "skyclans:bal", description: "Show your SkyClans balance", permissionLevel: CommandPermissionLevel.Any, cheatsRequired: false },
    (origin) => {
      const player = asPlayer(origin);
      if (!player) return failed("Only players have a balance.");
      return { status: CustomCommandStatus.Success, message: `§7Balance: §a${fmt(getBalance(player))} §8(${fmtExact(getBalance(player))})` };
    }
  );

  // /pay <player> <amount>
  reg.registerCommand(
    {
      name: "skyclans:pay",
      description: "Send money to another player",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
      mandatoryParameters: [
        { name: "player", type: CustomCommandParamType.PlayerSelector },
        { name: "amount", type: CustomCommandParamType.Integer },
      ],
    },
    (origin, targets, amount) => {
      const player = asPlayer(origin);
      if (!player) return failed("Only players can pay.");
      if (!Array.isArray(targets) || targets.length !== 1) return failed("Pick one player.");
      const target = targets[0];
      if (target.id === player.id) return failed("You can't pay yourself.");
      if (!(amount > 0)) return failed("The amount must be more than 0.");
      later(() => {
        if (!target.isValid) return player.sendMessage(`§c${target.name} isn't online.`);
        if (!takeMoney(player, amount)) {
          return player.sendMessage(`§cYou only have ${fmt(getBalance(player))}.`);
        }
        addMoney(target, amount);
        player.sendMessage(`§a✔ Sent ${fmt(amount)} to ${target.name}.`);
        target.sendMessage(`§a✔ ${player.name} sent you ${fmt(amount)}.`);
      });
      return { status: CustomCommandStatus.Success };
    }
  );
});
