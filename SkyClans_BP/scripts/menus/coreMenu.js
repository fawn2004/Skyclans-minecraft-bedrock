import { ActionFormData } from "@minecraft/server-ui";
import { SCREEN, comingSoon, show } from "../forms.js";
import { clanOf } from "../clans.js";
import { fmt } from "../money.js";
import { clanSpawnerCount, spawnerCap } from "../spawners.js";

// ============================================================================
//  CORE TERMINAL - opened by tapping your Island Core.
//  Layout: resource pack ui/sc_core.json (button numbers listed there).
//  Everything is a placeholder for now: every button says "coming soon".
// ============================================================================

const ICON = "textures/ui/skyclans/";

// The 6 core modules. level / max / description / price are placeholders until upgrades exist.
const MODULES = [
  { name: "Island Size", max: 3, desc: "Border 100 x 100", price: 250000, icon: ICON + "icon_expand" },
  { name: "Sell Multiplier", max: 8, desc: "Sell prices x1.00", price: 200000, icon: ICON + "coin" },
  { name: "Island Fly", max: 1, desc: "Fly anywhere on your island", price: 250000, icon: "textures/items/feather" },
  { name: "Spawner Cap", max: 8, desc: (clan) => `${clanSpawnerCount(clan)} / ${spawnerCap(clan)} spawners`, price: 200000, icon: "textures/blocks/mob_spawner" },
  { name: "Raid Shield Length", max: 4, desc: "Immune 12h after a raid", price: 100000, icon: ICON + "head_insurance" },
  { name: "Extra Raid Life", max: 2, desc: "Your raiders get 3 lives", price: 250000, icon: ICON + "icon_heart" },
];
const TABS = ["Modules", "Upkeep", "Raid Log"];
// button numbers - must match tools/make_layouts.py (Core Terminal)
const N = MODULES.length; // 0..N-1 upgrade buttons, N..2N-1 cards
const DEPOSIT = 2 * N + 3, TAB0 = 2 * N + 4;
const UPKEEP_PER_HOUR = 10000; // placeholder

const pips = (level, max) => `§b${"|".repeat(level)}§8${"|".repeat(Math.max(0, max - level))}`;

/** Opens the terminal for the clan whose core was tapped. */
export async function openCoreMenu(player, clan) {
  const mine = clanOf(player);
  if (!mine || mine.id !== clan.id) {
    player.sendMessage(`§b[SkyClans] §7This is the Island Core of §f${clan.name}§7.`);
    return;
  }
  const hours = Math.floor(clan.bank / UPKEEP_PER_HOUR);
  const body = [
    `§7Upkeep §f${fmt(UPKEEP_PER_HOUR)} / hr`,
    "§7Next charge §8coming soon",
    `§7Bank covers ${hours >= 24 ? "§a" : hours >= 6 ? "§e" : "§c"}${hours} hours`,
    "",
    `§a${"|".repeat(Math.min(10, Math.ceil(hours / 24 * 10)))}§8${"|".repeat(Math.max(0, 10 - Math.ceil(hours / 24 * 10)))}`,
  ].join("\n");

  const form = new ActionFormData().title(`${SCREEN.core}Clan ${clan.name}`).body(body);
  for (let i = 0; i < N; i++) form.button(""); // upgrade buttons (look fixed in the layout)
  for (const m of MODULES) {
    const desc = typeof m.desc === "function" ? m.desc(clan) : m.desc;
    form.button(`§f${m.name} §8${0}/${m.max}\n${pips(0, m.max)}\n§7${desc}\n§e${fmt(m.price)}`, m.icon); // cards
  }
  form.button(`§fClan bank §e${fmt(clan.bank)}`); // bank
  form.button("§a§lSHIELD ONLINE"); // shield chip (placeholder until shields exist)
  form.button("§fISLAND CORE §8- §fLEVEL 1"); // left panel title
  form.button("§0§lDEPOSIT TO BANK", ICON + "bar_gold"); // deposit
  for (let i = 0; i < TABS.length; i++) form.button(""); // tabs (text fixed in the layout)

  const res = await show(player, form);
  if (!res || res.canceled || res.selection === undefined) return;
  const s = res.selection;
  if (s < N) comingSoon(player, `${MODULES[s].name} upgrade`);
  else if (s === DEPOSIT) comingSoon(player, "Deposit from the core (use /deposit for now)");
  else if (s >= TAB0 && s < TAB0 + TABS.length) comingSoon(player, `${TABS[s - TAB0]} tab`);
  return openCoreMenu(player, clan);
}
