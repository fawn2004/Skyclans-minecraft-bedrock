import { system } from "@minecraft/server";
import { ActionFormData, FormCancelationReason } from "@minecraft/server-ui";

// Start a form title with one of these to pick its SkyClans layout
// (resource pack ui/server_form.json). Must match the markers there.
export const SCREEN = {
  main: "§s§c§1",
  settings: "§s§c§2",
  members: "§s§c§3",
  insurance: "§s§c§4",
  raid: "§s§c§5",
  list: "§s§c§6", // simple tile grid (Sky Shop, admin menu)
  spawner: "§s§c§7", // info panel + tiles (spawner menu, kit details, crate prizes)
  crate: "§s§c§8", // crate opening: spinning reel
  core: "§s§c§9", // Island Core terminal
};

export const NAV = "textures/ui/skyclans/nav_";

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

export function success(player, msg) {
  player.sendMessage(`§a✔ §a${msg}`);
  player.playSound("random.orb", { pitch: 1.2 });
}

export function fail(player, msg) {
  player.sendMessage(`§c✘ §c${msg}`);
  player.playSound("note.bass", { pitch: 0.7 });
}

const PER_PAGE = 9; // 9 tiles + Back / Prev / Next = 12 (the list layout's 3 rows)

/**
 * A page of tiles in the simple list layout, with Back / Prev / Next added.
 *   opts: { title, body?, tiles: [{ text, icon?, onClick? }], back? }
 * Tapping a tile runs its onClick; Back runs opts.back (or just closes).
 */
export async function tilePages(player, opts, page = 0) {
  const pages = Math.max(1, Math.ceil(opts.tiles.length / PER_PAGE));
  page = Math.min(Math.max(0, page), pages - 1);
  const shown = opts.tiles.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);

  let body = opts.body ?? "";
  if (pages > 1) body += `${body ? "   " : ""}§7Page §f${page + 1}/${pages}`;
  const form = new ActionFormData().title(SCREEN.list + "§l§f" + opts.title).body(body);
  for (const t of shown) form.button(t.text, t.icon);

  const nav = [{ text: "§7Back", icon: NAV + "back", go: opts.back }];
  if (page > 0) nav.push({ text: "§ePrev", icon: NAV + "prev", go: () => tilePages(player, opts, page - 1) });
  if (page < pages - 1) nav.push({ text: "§eNext", icon: NAV + "next", go: () => tilePages(player, opts, page + 1) });
  for (const n of nav) form.button(n.text, n.icon);

  const res = await show(player, form);
  if (!res || res.canceled || res.selection === undefined) return;
  if (res.selection >= shown.length) return nav[res.selection - shown.length]?.go?.();
  return shown[res.selection].onClick?.();
}
