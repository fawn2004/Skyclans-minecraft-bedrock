import { system, world } from "@minecraft/server";
import { fmt, getBalance } from "./money.js";
import { sidebarEnabled } from "./serverSettings.js";
import { ownedSpawnerCount, totalHeads } from "./spawners.js";
import { clanOf } from "./clans.js";

// ============================================================================
//  SIDEBAR - the panel on the right of the screen, different for each player.
//  It's sent as a title starting with MARK; the resource pack
//  (ui/hud_screen.json) draws those titles as the sidebar instead of a big title.
//  Admins can turn it off for everyone (/admin > Sidebar).
// ============================================================================

const MARK = "§s§c§s§b";
const REFRESH = 40; // ticks (2 seconds)
const group = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

function lines(player, online) {
  const bar = "§8- - - - - - - - - - - -";
  const clan = clanOf(player);
  return [
    "§b§lSKY§fCLANS",
    bar,
    `§f${player.name}`,
    clan ? `§7Clan: §b${clan.name}` : "§7Clan: §8None yet",
    clan ? `§7Clan bank: §e${fmt(clan.bank)}` : "",
    "",
    `§7Balance: §a${fmt(getBalance(player))}`,
    `§7Spawners: §b${group(ownedSpawnerCount(player.id))}`,
    `§7Heads: §d${group(totalHeads(player))}`,
    "",
    `§7Online: §f${online}`,
    bar,
  ]
    .filter((l, i, a) => l !== "" || a[i - 1] !== "")
    .join("\n");
}

function refresh() {
  const players = world.getAllPlayers();
  const on = sidebarEnabled();
  for (const p of players) {
    try {
      if (!on) continue;
      p.onScreenDisplay.setTitle(MARK + lines(p, players.length), {
        fadeInDuration: 0,
        stayDuration: REFRESH * 3,
        fadeOutDuration: 0,
      });
    } catch {}
  }
}

/** Removes the sidebar straight away (used when an admin turns it off). */
export function clearSidebars() {
  for (const p of world.getAllPlayers()) {
    try {
      p.runCommand("title @s clear");
    } catch {}
  }
}

export function registerSidebar() {
  world.afterEvents.worldLoad.subscribe(() => system.runInterval(refresh, REFRESH));
}
