import { system, world } from "@minecraft/server";
import { allClans, can, clanById, clanOf, onlineMembers, plotAt, saveClan, setRaidCheck } from "./clans.js";
import { fmt } from "./money.js";
import { raidLives, raidShieldHours } from "./islandUpgrades.js";
import { pref } from "./playerSettings.js";

// ============================================================================
//  RAIDS
//  - A clan's owner / co-owner buys a raid ($35K from the clan bank). A random
//    island is picked from the clans with someone online (not your own, not one
//    already in a raid, not one on the whitelist). A running shield halves the
//    chance of being picked.
//  - The picked clan gets 2 minutes to prepare, then the raid runs for up to
//    15 minutes. Raiders can teleport in as often as they like (Raid menu).
//  - The raiding clan shares its lives. A raider dying on the target island
//    loses one. Out of lives, or a forfeit = LOSS. Lives left at the end = WIN.
//  - WIN:  raiders take a % of the defenders' clan bank.
//    LOSS: defenders take a % of the raiders' clan bank.
//    The % goes down as the bank goes up (TAKE table), never more than TAKE_CAP.
//    The losing clan's insurance pays some of it back.
//  - During the raid (not the 2 minutes before) raiders can build, break, open
//    things and pick up spawners on the target island.
//  - Every raided island is whitelisted (can't be picked) for 12 hours, or for
//    the time left on its shield if that's longer.
//  The clan bank can't be withdrawn from (and the clan can't be disbanded) by
//  either clan while the raid is on.
//  Raids are saved in the world, so a restart part way through carries on.
// ============================================================================

export const RAID_PRICE = 35000;
export const PREP_MS = 2 * 60 * 1000;
export const RAID_MS = 15 * 60 * 1000;
export const WHITELIST_MS = 12 * 60 * 60 * 1000;
export const SHIELD_PER_HOUR = 10000;
const HOUR = 60 * 60 * 1000;

// % of the clan bank that changes hands, by bank size. Bigger bank = smaller %.
export const TAKE = [
  { under: 100000, pct: 20 },
  { under: 1000000, pct: 15 },
  { under: 10000000, pct: 10 },
  { under: 50000000, pct: 5 },
  { under: Infinity, pct: 2 },
];
export const TAKE_CAP = 2500000;

// Insurance tiers: bought in order from the clan bank, kept forever.
// Pays back pct% of what the clan loses in a raid, up to cap.
export const INSURANCE = [
  { id: "basic", name: "BASIC", colour: "§f", pct: 10, cap: 100000, price: 50000 },
  { id: "silver", name: "SILVER", colour: "§7", pct: 15, cap: 500000, price: 250000 },
  { id: "gold", name: "GOLD", colour: "§6", pct: 20, cap: 1500000, price: 1000000 },
  { id: "diamond", name: "DIAMOND", colour: "§b", pct: 25, cap: 3000000, price: 5000000 },
];

const KEY = "skyclans:raids";
const AREA = "skyclans_raid_";
let raids = [];

const load = () => {
  try {
    raids = JSON.parse(String(world.getDynamicProperty(KEY) ?? "[]"));
  } catch {
    raids = [];
  }
};
const save = () => world.setDynamicProperty(KEY, JSON.stringify(raids));
const overworld = () => world.getDimension("minecraft:overworld");

// ---- small helpers ---------------------------------------------------------------------
export function takeAmount(bank) {
  if (!(bank > 0)) return 0;
  const pct = TAKE.find((t) => bank < t.under).pct;
  return Math.min(TAKE_CAP, Math.floor((bank * pct) / 100));
}
export const takePct = (bank) => TAKE.find((t) => Math.max(0, bank) < t.under).pct;

export const insuranceLevel = (clan) => clan?.insurance ?? 0; // 0 = none, 1 = Basic ... 4 = Diamond
export const insuranceTier = (clan) => INSURANCE[insuranceLevel(clan) - 1];

export const raidStats = (clan) => (clan.raidStats ??= { wins: 0, losses: 0, streak: 0, claims: 0, paidOut: 0 });

/** The raid a clan is in (attacking or defending), or undefined. */
export const raidOf = (clanId) => raids.find((r) => r.attacker === clanId || r.defender === clanId);

export const whitelistLeft = (clan) => Math.max(0, (clan?.whitelistUntil ?? 0) - Date.now());
export const shieldLeft = (clan) => Math.max(0, (clan?.shieldUntil ?? 0) - Date.now());
export const shieldMaxMs = (clan) => raidShieldHours(clan) * HOUR;

export function timeLeft(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function tell(clan, msg, sound) {
  for (const p of onlineMembers(clan)) {
    try {
      p.sendMessage(msg);
      if (sound && pref(p, "raidAlert")) p.playSound(sound); // Settings > Raid Alert Sound
    } catch {}
  }
}

function logRaid(clan, text) {
  const d = new Date();
  const when = `${d.getDate()}/${d.getMonth() + 1} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  (clan.raidLog ??= []).push({ when, text });
  if (clan.raidLog.length > 20) clan.raidLog.splice(0, clan.raidLog.length - 20);
}

// ---- who can be raided -------------------------------------------------------------------
function targets(attacker) {
  return allClans().filter(
    (c) => c.id !== attacker.id && c.island?.built && onlineMembers(c).length > 0 && !raidOf(c.id) && whitelistLeft(c) === 0
  );
}

function pickTarget(attacker) {
  const list = targets(attacker).map((c) => ({ c, w: shieldLeft(c) > 0 ? 0.5 : 1 }));
  let roll = Math.random() * list.reduce((n, t) => n + t.w, 0);
  for (const t of list) if ((roll -= t.w) < 0) return t.c;
  return list.at(-1)?.c;
}

// ---- buying a raid -------------------------------------------------------------------------
/** Returns an error message, or undefined if the raid was started. */
export function buyRaid(player) {
  const clan = clanOf(player);
  if (!clan) return "You need a clan to raid.";
  if (!can(clan, player.id, "withdraw")) return "Only the owner and co-owners can buy raids.";
  if (!clan.island?.built) return "Your clan needs an island first (/is home).";
  if (raidOf(clan.id)) return "Your clan is already in a raid.";
  if (clan.bank < RAID_PRICE) return `A raid costs ${fmt(RAID_PRICE)} from the clan bank (it has ${fmt(clan.bank)}).`;
  const target = pickTarget(clan);
  if (!target) return "No islands can be raided right now (nobody else is online, or they're all whitelisted). You weren't charged.";

  clan.bank -= RAID_PRICE;
  saveClan(clan);
  const now = Date.now();
  raids.push({
    attacker: clan.id,
    defender: target.id,
    attackerName: clan.name,
    defenderName: target.name,
    startAt: now + PREP_MS,
    endAt: now + PREP_MS + RAID_MS,
    lives: raidLives(clan),
    maxLives: raidLives(clan),
    live: false,
  });
  save();
  tell(clan, `§c§l⚔ RAID BOUGHT §r§7by ${player.name}! Target: §f${target.name}§7. You can teleport in §f2:00§7. Lives: §c${raidLives(clan)}`, "mob.wither.spawn");
  tell(target, `§c§l⚠ YOUR ISLAND IS BEING RAIDED §r§7by §f${clan.name}§7! Raiders arrive in §f2:00§7 - get ready.`, "mob.wither.spawn");
  return undefined;
}

// ---- during the raid ----------------------------------------------------------------------
const isLive = (r) => r.live && Date.now() < r.endAt;

/** Can this player build / break / open things at this plot because of a raid? */
export function raidAccess(player, plotClan) {
  if (!plotClan) return false;
  const mine = clanOf(player);
  if (!mine) return false;
  return raids.some((r) => r.attacker === mine.id && r.defender === plotClan.id && isLive(r));
}

/** Can this player pick up the spawner standing at x,z (raiders, during a live raid)? */
export function raidCanPickSpawner(player, dimId, x, z) {
  return dimId === "minecraft:overworld" && raidAccess(player, plotAt(x, z));
}

/** A safe spot on the defenders' island: walk in from a random point near the
 *  edge towards the centre until there's ground. Falls back to their island home. */
function raidSpot(defender) {
  const { cx, cz, size } = defender.island;
  const dim = overworld();
  const angle = Math.random() * Math.PI * 2;
  for (let r = size / 2 - 6; r >= 0; r -= 2) {
    const x = Math.floor(cx + Math.cos(angle) * r), z = Math.floor(cz + Math.sin(angle) * r);
    try {
      const top = dim.getTopmostBlock({ x, z });
      if (!top || top.isLiquid || top.typeId === "minecraft:barrier" || top.typeId === "minecraft:air") continue;
      return { x: x + 0.5, y: top.location.y + 1, z: z + 0.5 };
    } catch {
      break; // not loaded
    }
  }
  const h = defender.island.home;
  return { x: h.x + 0.5, y: h.y, z: h.z + 0.5 };
}

/** Raid menu "Teleport" button. Returns an error message or undefined. */
export function teleportToRaid(player) {
  const clan = clanOf(player);
  const r = clan && raids.find((x) => x.attacker === clan.id);
  if (!r) return "Your clan isn't raiding anyone.";
  if (!r.live) return `The raid starts in ${timeLeft(r.startAt - Date.now())}.`;
  const def = clanById(r.defender);
  if (!def) return "That island is gone.";
  player.teleport(raidSpot(def), { dimension: overworld() });
  player.sendMessage(`§c⚔ §7Raiding §f${def.name}§7. Lives left: §c${r.lives}§7/${r.maxLives}`);
}

/** Raid menu "Forfeit" button (owner / co-owner of the raiding clan). */
export function forfeitRaid(player) {
  const clan = clanOf(player);
  const r = clan && raids.find((x) => x.attacker === clan.id);
  if (!r) return "Your clan isn't raiding anyone.";
  if (!can(clan, player.id, "withdraw")) return "Only the owner and co-owners can forfeit.";
  finish(r, false, `${player.name} forfeited`);
}

function goLive(r, attacker, defender) {
  r.live = true;
  save();
  try {
    overworld().runCommand(`tickingarea add circle ${defender.island.cx} 64 ${defender.island.cz} 4 ${AREA}${defender.island.index} true`);
  } catch {}
  tell(attacker, `§c§l⚔ THE RAID HAS STARTED! §r§7Open the Raid menu and tap §fTeleport§7. You have §f15:00§7 and §c${r.lives} §7lives.`, "raid.horn");
  tell(defender, `§c§l⚔ THE RAID HAS STARTED! §r§f${attacker.name} §7can now break into your island. Hold out for §f15:00§7!`, "raid.horn");
  // raiders online now are sent in straight away
  for (const p of onlineMembers(attacker)) {
    try {
      p.teleport(raidSpot(defender), { dimension: overworld() });
    } catch {}
  }
}

/** Ends a raid. win = the raiders won. */
function finish(r, win, why) {
  raids = raids.filter((x) => x !== r);
  save();
  const attacker = clanById(r.attacker), defender = clanById(r.defender);
  try {
    overworld().runCommand(`tickingarea remove ${AREA}${defender?.island?.index}`);
  } catch {}
  if (!attacker || !defender) {
    if (attacker) tell(attacker, "§7The raid was called off - the other clan is gone.");
    if (defender) tell(defender, "§7The raid was called off - the raiding clan is gone.");
    return;
  }

  // money: the loser pays the winner
  const loser = win ? defender : attacker, winner = win ? attacker : defender;
  const amount = Math.min(loser.bank, takeAmount(loser.bank));
  loser.bank -= amount;
  winner.bank += amount;

  // the loser's insurance pays some back
  const tier = insuranceTier(loser);
  const payout = tier ? Math.min(tier.cap, Math.floor((amount * tier.pct) / 100)) : 0;
  if (payout > 0) {
    loser.bank += payout;
    const st = raidStats(loser);
    st.claims += 1;
    st.paidOut += payout;
  }

  // stats (for the raiding clan) and the whitelist (for the raided island)
  const st = raidStats(attacker);
  if (win) {
    st.wins += 1;
    st.streak = Math.max(0, st.streak) + 1;
  } else {
    st.losses += 1;
    st.streak = 0;
  }
  defender.whitelistUntil = Math.max(Date.now() + WHITELIST_MS, defender.shieldUntil ?? 0);
  defender.shieldUntil = 0; // the shield's time became whitelist time

  const money = amount > 0 ? ` §e${fmt(amount)}` : " §7nothing (empty bank)";
  const reason = why ? ` §8(${why})` : "";
  logRaid(attacker, win ? `§aWon §7vs ${defender.name} §a+${fmt(amount)}` : `§cLost §7vs ${defender.name} §c-${fmt(amount)}${why ? ` §8(${why})` : ""}`);
  logRaid(defender, win ? `§cRaided §7by ${attacker.name} §c-${fmt(amount)}` : `§aDefended §7vs ${attacker.name} §a+${fmt(amount)}`);
  saveClan(attacker);
  saveClan(defender);

  if (win) {
    tell(attacker, `§a§l⚔ RAID WON! §r§7You took${money} §7from §f${defender.name}§7.`, "random.totem");
    tell(defender, `§c§l⚔ RAID LOST. §r§f${attacker.name} §7took${money} §7from your clan bank.`, "mob.wither.death");
  } else {
    tell(attacker, `§c§l⚔ RAID LOST.${reason} §r§f${defender.name} §7took${money} §7from your clan bank.`, "mob.wither.death");
    tell(defender, `§a§l⚔ RAID DEFENDED! §r§7You took${money} §7from §f${attacker.name}§7.`, "random.totem");
  }
  if (payout > 0) tell(loser, `§b🛡 Insurance §7(${tier.name}) paid back §a${fmt(payout)}§7.`);
  tell(defender, `§7Your island is whitelisted for §f${timeLeft(whitelistLeft(defender))} §7- nobody can raid it until then.`);
  world.sendMessage(
    win
      ? `§c⚔ §f${attacker.name} §7raided §f${defender.name} §7and won${money}§7!`
      : `§c⚔ §f${defender.name} §7held off a raid from §f${attacker.name}§7!`
  );
}

/** Raider deaths on the target island cost the clan a life. */
function onDeath({ deadEntity }) {
  if (deadEntity?.typeId !== "minecraft:player") return;
  let l, dimId;
  try {
    l = deadEntity.location;
    dimId = deadEntity.dimension.id;
  } catch {
    return;
  }
  const mine = clanOf(deadEntity);
  const r = mine && raids.find((x) => x.attacker === mine.id && isLive(x));
  if (!r || dimId !== "minecraft:overworld" || plotAt(l.x, l.z)?.id !== r.defender) return;
  r.lives -= 1;
  save();
  const attacker = clanById(r.attacker), defender = clanById(r.defender);
  if (r.lives <= 0) return finish(r, false, "out of lives");
  if (attacker) tell(attacker, `§c☠ ${deadEntity.name} died! §7Lives left: §c${r.lives}§7/${r.maxLives}`, "note.bass");
  if (defender) tell(defender, `§a☠ ${deadEntity.name} §7(raider) died! §7They have §c${r.lives} §7lives left.`);
}

/** Every second: start raids whose 2 minutes are up, end raids whose 15 minutes are up. */
function tick() {
  const now = Date.now();
  for (const r of [...raids]) {
    const attacker = clanById(r.attacker), defender = clanById(r.defender);
    if (!attacker || !defender) {
      finish(r, false);
      continue;
    }
    if (!r.live && now >= r.startAt) goLive(r, attacker, defender);
    else if (r.live && now >= r.endAt) finish(r, true);
  }
}

// ---- shield -------------------------------------------------------------------------------
/** Adds hours to the clan's shield. Returns an error message or undefined. */
export function topUpShield(player, hours) {
  const clan = clanOf(player);
  if (!clan) return "You're not in a clan.";
  if (!can(clan, player.id, "withdraw")) return "Only the owner and co-owners can top up the shield.";
  if (whitelistLeft(clan) > 0) return "Your island is whitelisted - the shield can't be topped up until that runs out.";
  const room = Math.floor((shieldMaxMs(clan) - shieldLeft(clan)) / HOUR);
  if (room <= 0) return `The shield is full (${raidShieldHours(clan)}h max - upgrade Raid Shield Length at the Island Core for more).`;
  hours = Math.min(hours, room);
  const cost = hours * SHIELD_PER_HOUR;
  if (clan.bank < cost) return `That costs ${fmt(cost)} from the clan bank (it has ${fmt(clan.bank)}).`;
  clan.bank -= cost;
  clan.shieldUntil = Date.now() + shieldLeft(clan) + hours * HOUR;
  saveClan(clan);
  tell(clan, `§b🛡 ${player.name} §7added §f${hours}h §7to the raid shield (${fmt(cost)}). Shield: §f${timeLeft(shieldLeft(clan))}`);
}
/** Whole hours that can still be added to the shield. */
export const shieldRoom = (clan) => Math.max(0, Math.floor((shieldMaxMs(clan) - shieldLeft(clan)) / HOUR));

// ---- insurance ----------------------------------------------------------------------------
export function buyInsurance(player) {
  const clan = clanOf(player);
  if (!clan) return "You need a clan for insurance.";
  if (!can(clan, player.id, "withdraw")) return "Only the owner and co-owners can buy insurance.";
  const next = INSURANCE[insuranceLevel(clan)];
  if (!next) return "Your clan already has the best insurance.";
  if (clan.bank < next.price) return `${next.name} costs ${fmt(next.price)} from the clan bank (it has ${fmt(clan.bank)}).`;
  clan.bank -= next.price;
  clan.insurance = insuranceLevel(clan) + 1;
  saveClan(clan);
  tell(clan, `§b🛡 ${player.name} §7bought §f${next.name} §7insurance: §a${next.pct}% §7of raid losses back, up to §a${fmt(next.cap)}§7.`, "random.levelup");
}

// ---- sidebar lines -------------------------------------------------------------------------
export function raidSidebar(player) {
  const clan = clanOf(player);
  if (!clan) return [];
  const r = raidOf(clan.id);
  const now = Date.now();
  if (r) {
    const attacking = r.attacker === clan.id;
    const vs = attacking ? r.defenderName : r.attackerName;
    const head = attacking ? `§c⚔ Raiding §f${vs}` : `§c⚠ Raided by §f${vs}`;
    const time = r.live ? `§7Ends in §f${timeLeft(r.endAt - now)}` : `§7Starts in §f${timeLeft(r.startAt - now)}`;
    return [head, time, `§7Raider lives: §c${r.lives}§7/${r.maxLives}`];
  }
  if (whitelistLeft(clan) > 0) return [`§a🛡 Whitelisted §f${timeLeft(whitelistLeft(clan))}`];
  if (shieldLeft(clan) > 0) return [`§b🛡 Shield §f${timeLeft(shieldLeft(clan))}`];
  return [];
}

export function registerRaids() {
  setRaidCheck((clanId) => !!raidOf(clanId));
  world.afterEvents.worldLoad.subscribe(() => {
    load();
    system.runInterval(tick, 20);
  });
  world.afterEvents.entityDie.subscribe(onDeath);
}
