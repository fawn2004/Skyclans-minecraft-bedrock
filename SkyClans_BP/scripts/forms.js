import { system } from "@minecraft/server";
import { FormCancelationReason } from "@minecraft/server-ui";

// Start a form title with one of these to pick its SkyClans layout
// (resource pack ui/server_form.json). Must match the markers there.
export const SCREEN = {
  main: "§s§c§1",
  settings: "§s§c§2",
  members: "§s§c§3",
  insurance: "§s§c§4",
  raid: "§s§c§5",
  shop: "§s§c§6",
};

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
