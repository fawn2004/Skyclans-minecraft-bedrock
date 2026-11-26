import { system } from "@minecraft/server";
import { FormCancelationReason } from "@minecraft/server-ui";

// A form title starting with this uses the SkyClans layout (resource pack ui/server_form.json).
export const MENU_MARKER = "§s§c";

/**
 * Shows a form, waiting a moment if the player is busy (e.g. chat still open
 * after typing a command). Resolves to the response, or undefined.
 */
export async function show(player, form) {
  for (let tries = 0; tries < 20; tries++) {
    if (!player.isValid) return undefined;
    const res = await form.show(player);
    if (res.cancelationReason !== FormCancelationReason.UserBusy) return res;
    await system.waitTicks(5);
  }
  return undefined;
}

export function comingSoon(player, name) {
  player.sendMessage(`§b[SkyClans] §f${name} §7- coming soon`);
}
