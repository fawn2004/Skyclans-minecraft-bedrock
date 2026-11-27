import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { NAV, SCREEN, fail, show, success } from "../forms.js";
import { can, clanOf } from "../clans.js";
import { fmt } from "../money.js";
import { clanSpawnerCount } from "../spawners.js";
import {
  MODULES, UPKEEP_PER_LEVEL, buyUpgrade, wallProgress, coreLevel, levelOf, nextChargeIn, totalLevels, upkeepPaid, upkeepPerHour,
} from "../islandUpgrades.js";
import { bankMenu } from "./membersMenu.js";

// ============================================================================
//  CORE TERMINAL - opened by tapping your Island Core (or /is core).
//  Layout: resource pack ui/sc_core.json (button numbers listed there).
//  Upgrades and upkeep live in islandUpgrades.js.
// ============================================================================

const ICON = "textures/ui/skyclans/";
const TABS = ["Modules", "Upkeep", "Raid Log"];
// button numbers - must match tools/make_layouts.py (Core Terminal)
const N = MODULES.length; // 0..N-1 upgrade buttons, N..2N-1 cards
const DEPOSIT = 2 * N + 3, TAB0 = 2 * N + 4;

const pips = (level, max) => `§b${"|".repeat(level)}§8${"|".repeat(Math.max(0, max - level))}`;

function timeText(ms) {
  const m = Math.ceil(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
}

function cardText(clan, m) {
  const lvl = levelOf(clan, m.id);
  const max = m.prices.length;
  let effect = m.effect(lvl);
  if (m.id === "spawners") effect = `${clanSpawnerCount(clan)} / ${10 + lvl * 5} spawners`;
  const moving = m.id === "size" ? wallProgress(clan) : undefined;
  if (moving !== undefined && !clan.island.wallJob?.repair) effect = `§eBorder moving ${moving}%`;
  const bottom = lvl >= max ? "§aMAXED" : `§e${fmt(m.prices[lvl])}`;
  return `§f${m.name} §8${lvl}/${max}\n${pips(lvl, max)}\n§7${effect}\n${bottom}`;
}

/** Upkeep lines for the left panel. */
function upkeepLines(clan) {
  const cost = upkeepPerHour(clan);
  if (cost === 0) return ["§7Upkeep §aFree", "§8Upgrades cost", `§8${fmt(UPKEEP_PER_LEVEL)} / hr per level`].join("\n");
  const hours = Math.floor(clan.bank / cost);
  const segs = Math.min(10, Math.ceil((hours / 24) * 10));
  return [
    `§7Upkeep §f${fmt(cost)} / hr`,
    upkeepPaid(clan) ? `§7Next charge §f${timeText(nextChargeIn(clan))}` : "§cUNPAID - upgrades paused",
    `§7Bank covers ${hours >= 24 ? "§a" : hours >= 6 ? "§e" : "§c"}${hours} hours`,
    "",
    `§a${"|".repeat(segs)}§8${"|".repeat(10 - segs)}`,
  ].join("\n");
}

/** Opens the terminal for the clan whose core was tapped. */
export async function openCoreMenu(player, clan) {
  const mine = clanOf(player);
  if (!mine || mine.id !== clan.id) {
    player.sendMessage(`§b[SkyClans] §7This is the Island Core of §f${clan.name}§7.`);
    return;
  }
  clan = mine; // fresh copy

  const form = new ActionFormData().title(`${SCREEN.core}Clan ${clan.name}`).body(upkeepLines(clan));
  // upgrade buttons: look fixed in the layout; empty text = maxed = button hidden
  for (const m of MODULES) form.button(levelOf(clan, m.id) >= m.prices.length ? "" : "upgrade");
  for (const m of MODULES) form.button(cardText(clan, m), m.icon); // cards
  form.button(`§fClan bank §e${fmt(clan.bank)}`); // bank
  form.button(upkeepPaid(clan) ? "§a§lUPKEEP PAID" : "§c§lUPKEEP UNPAID"); // status chip
  form.button(`§fISLAND CORE §8- §fLEVEL ${coreLevel(clan)}`); // left panel title
  form.button("§0§lDEPOSIT TO BANK", ICON + "bar_gold"); // deposit
  for (let i = 0; i < TABS.length; i++) form.button(""); // tabs (text fixed in the layout)

  const res = await show(player, form);
  if (!res || res.canceled || res.selection === undefined) return;
  const s = res.selection;
  const back = () => openCoreMenu(player, clan);
  if (s < N) return upgradeConfirm(player, MODULES[s], back);
  if (s === DEPOSIT) return bankMenu(player, back);
  if (s === TAB0 + 1) return upkeepTab(player, clan, back);
  if (s === TAB0 + 2) return raidLogTab(player, clan, back);
  return back(); // Modules tab = this page
}

async function upgradeConfirm(player, m, back) {
  const clan = clanOf(player);
  if (!clan) return;
  const lvl = levelOf(clan, m.id);
  if (lvl >= m.prices.length) {
    fail(player, `${m.name} is already maxed.`);
    return back();
  }
  if (!can(clan, player.id, "withdraw")) {
    fail(player, "Only the owner and co-owners can buy upgrades.");
    return back();
  }
  const price = m.prices[lvl];
  const res = await show(
    player,
    new MessageFormData()
      .title(`Upgrade ${m.name}`)
      .body(
        `${m.name}: level ${lvl} -> ${lvl + 1}\n\nNow: ${m.effect(lvl)}\nAfter: ${m.effect(lvl + 1)}\n\n` +
          `Cost: ${fmt(price)} from the clan bank (it has ${fmt(clan.bank)})\n` +
          `Upkeep goes up by ${fmt(UPKEEP_PER_LEVEL)} / hr.`
      )
      .button1("§aUpgrade")
      .button2("Cancel")
  );
  if (res && !res.canceled && res.selection === 0) {
    const err = buyUpgrade(player, m.id);
    if (err) fail(player, err);
    else {
      success(player, `${m.name} is now level ${lvl + 1}!`);
      player.playSound("random.levelup");
      if (m.id === "size") player.sendMessage("§7Moving your island border... this can take a minute.");
    }
  }
  return back();
}

async function upkeepTab(player, clan, back) {
  const cost = upkeepPerHour(clan);
  const info = [
    `§7Upgrade levels §f${totalLevels(clan)}`,
    `§7Upkeep §f${fmt(cost)} / hr`,
    `§8(${fmt(UPKEEP_PER_LEVEL)} per level)`,
    "",
    cost === 0 ? "§aNothing to pay yet." : upkeepPaid(clan) ? `§aPaid. §7Next charge in §f${timeText(nextChargeIn(clan))}` : "§cUnpaid! Upgrades are paused.",
    `§7Clan bank §e${fmt(clan.bank)}`,
    cost ? `§7That covers §f${Math.floor(clan.bank / cost)} hours` : "",
    "",
    "§8Upkeep comes out of the clan",
    "§8bank every hour. If the bank",
    "§8can't pay, upgrades pause",
    "§8until it can.",
  ].join("\n");
  const form = new ActionFormData()
    .title(`${SCREEN.spawner}§l§fUPKEEP`)
    .body(info)
    .button("§0§lDeposit\n§8To clan bank", ICON + "coin")
    .button("§7Back", NAV + "back");
  const res = await show(player, form);
  if (!res || res.canceled) return;
  if (res.selection === 0) return bankMenu(player, () => upkeepTab(player, clanOf(player) ?? clan, back));
  return back();
}

async function raidLogTab(player, clan, back) {
  const log = clan.raidLog ?? [];
  const info = log.length
    ? log.slice(-12).reverse().map((r) => `§7${r.when} §f${r.text}`).join("\n")
    : "§7No raids yet.\n\n§8Raids on your island and the\n§8raids your clan sends will\n§8show up here once raids\n§8are added.";
  const form = new ActionFormData().title(`${SCREEN.spawner}§l§fRAID LOG`).body(info).button("§7Back", NAV + "back");
  const res = await show(player, form);
  if (res && !res.canceled) return back();
}
