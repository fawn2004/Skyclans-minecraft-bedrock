import { ActionFormData } from "@minecraft/server-ui";
import { SCREEN, comingSoon, show } from "../forms.js";
import { clanOf } from "../clans.js";
import { fmt } from "../money.js";

// ============================================================================
//  CORE TERMINAL - opened by tapping your Island Core.
//  Layout: resource pack ui/sc_core.json (button numbers listed there).
//  Everything is a placeholder for now: every button says "coming soon".
// ============================================================================

const ICON = "textures/ui/skyclans/";

// The 8 core modules. level / max / description / price are placeholders until upgrades exist.
const MODULES = [
  { name: "Island Size", max: 3, desc: "Border 100 x 100", price: 250000, icon: ICON + "icon_expand" },
  { name: "Sell Multiplier", max: 8, desc: "Sell prices x1.00", price: 200000, icon: ICON + "coin" },
  { name: "Island Fly", max: 1, desc: "Fly anywhere on your island", price: 250000, icon: "textures/items/feather" },
  { name: "Spawner Cap", max: 8, desc: "Up to 10 spawners", price: 200000, icon: "textures/blocks/mob_spawner" },
  { name: "Crop Growth", max: 8, desc: "Crops grow x1.00 faster", price: 50000, icon: "textures/items/wheat" },
  { name: "Raid Shield Length", max: 4, desc: "Immune 12h after a raid", price: 100000, icon: ICON + "head_insurance" },
  { name: "Defence Time", max: 4, desc: "Raiders get 600s to bridge to you", price: 100000, icon: "textures/items/clock_item" },
  { name: "Extra Raid Life", max: 2, desc: "Your raiders get 3 lives", price: 250000, icon: ICON + "icon_heart" },
];
const TABS = ["Modules", "Upkeep", "Raid Log", "Insurance", "Settings"];
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
  for (let i = 0; i < 8; i++) form.button(""); // 0-7 upgrade buttons (look fixed in the layout)
  for (const m of MODULES) {
    form.button(`§f${m.name} §8${0}/${m.max}\n${pips(0, m.max)}\n§7${m.desc}\n§e${fmt(m.price)}`, m.icon); // 8-15
  }
  form.button(`§fClan bank §e${fmt(clan.bank)}`); // 16
  form.button("§a§lSHIELD ONLINE"); // 17 (placeholder until shields exist)
  form.button("§fISLAND CORE §8- §fLEVEL 1"); // 18
  form.button("§0§lDEPOSIT TO BANK", ICON + "bar_gold"); // 19
  for (let i = 0; i < TABS.length; i++) form.button(""); // 20-24 tabs (text fixed in the layout)

  const res = await show(player, form);
  if (!res || res.canceled || res.selection === undefined) return;
  const s = res.selection;
  if (s < 8) comingSoon(player, `${MODULES[s].name} upgrade`);
  else if (s === 19) comingSoon(player, "Deposit from the core (use /deposit for now)");
  else if (s >= 20 && s <= 24) comingSoon(player, `${TABS[s - 20]} tab`);
  return openCoreMenu(player, clan);
}
