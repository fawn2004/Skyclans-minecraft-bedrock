import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { NAV, SCREEN, fail, show, success, tilePages } from "../forms.js";
import { can, clanOf } from "../clans.js";
import { fmt } from "../money.js";
import { raidLives, raidShieldHours } from "../islandUpgrades.js";
import {
  RAID_PRICE, SHIELD_PER_HOUR, buyRaid, forfeitRaid, raidOf, raidStats, shieldLeft, shieldRoom, takeAmount, takePct,
  teleportToRaid, timeLeft, topUpShield, whitelistLeft,
} from "../raids.js";
import { openMainMenu } from "./mainMenu.js";

// ============================================================================
//  RAID DISPATCH - buy a raid, see the raid you're in, top up the shield.
//  Button numbers must match tools/make_layouts.py (Raid Dispatch):
//   0-2 card bars, 3-5 card box text, 6-8 card descriptions,
//   9-11 wins / losses / streak, 12-13 squad row, 14 lives + bank, 15 back.
//  The raid rules are in raids.js.
// ============================================================================

const BAR = "textures/ui/skyclans/bar_";

function cardName(name) {
  return name.length > 9 ? `${name.slice(0, 9)}-\n${name.slice(9)}` : name;
}

/** What each card shows for this player's clan right now. */
function cards(player, clan) {
  if (!clan) {
    const need = { bar: "§0§lNEED A CLAN", colour: "red", inner: "", desc: "§7Make or join a clan\nfirst (Members)." };
    return [need, { ...need, inner: "§7No clan yet." }, need];
  }
  const r = raidOf(clan.id);
  const now = Date.now();
  const boss = can(clan, player.id, "withdraw");
  const out = [];

  // 0: buy a raid / teleport
  if (!r) {
    out.push({
      bar: `§0§lBUY · ${fmt(RAID_PRICE)}`,
      colour: "gold",
      inner: "",
      desc: `§7A random online clan.\n§f2 min§7 for them to\n§7prepare, then §f15 min\n§7to raid.${boss ? "" : "\n§8Owner / co-owner buys."}`,
    });
  } else if (r.attacker === clan.id) {
    out.push({
      bar: r.live ? "§0§lTELEPORT" : `§0§lIN ${timeLeft(r.startAt - now)}`,
      colour: "gold",
      inner: "",
      desc: r.live ? "§7Tap to teleport onto\n§7their island. As\n§7many times as you\n§7like." : "§7They're getting ready.\n§7Tap Teleport once\n§7the raid starts.",
    });
  } else {
    out.push({ bar: "§0§lDEFEND!", colour: "red", inner: "", desc: `§f${r.attackerName}\n§7is raiding you!\n§7Kill raiders to take\n§7their lives.` });
  }

  // 1: status / forfeit
  if (!r) {
    const risk = takeAmount(clan.bank);
    out.push({
      bar: "§0§lREFRESH",
      colour: "gold",
      inner: `§7No raid running.\n\n§fLives §c${raidLives(clan)}\n§8Shared by the\n§8whole clan.`,
      desc: `§7Win: take part of\n§7their bank.\n§7Lose: they take §c${takePct(clan.bank)}%\n§7of yours (§c${fmt(risk)}§7).`,
    });
  } else {
    const attacking = r.attacker === clan.id;
    const time = r.live ? `§7Ends in §f${timeLeft(r.endAt - now)}` : `§7Starts §f${timeLeft(r.startAt - now)}`;
    out.push({
      bar: attacking && boss ? "§0§lFORFEIT" : "§0§lREFRESH",
      colour: attacking && boss ? "red" : "gold",
      inner: attacking
        ? `§fRAIDING\n§c${r.defenderName}\n\n${time}\n§7Lives §c${r.lives}§7/${r.maxLives}`
        : `§cUNDER ATTACK\n§fby ${r.attackerName}\n\n${time}\n§7Their lives §c${r.lives}`,
      desc: attacking
        ? "§7Win: keep a life\n§7until the end.\n§7Lose: out of lives\n§7or forfeit."
        : "§7Survive the clock or\n§7kill all their lives\n§7to win their money.",
    });
  }

  // 2: shield
  const wl = whitelistLeft(clan), sh = shieldLeft(clan);
  if (wl > 0) {
    out.push({ bar: "§0§lWHITELISTED", colour: "gold", inner: "", desc: `§aWhitelisted §f${timeLeft(wl)}\n§7Nobody can raid you.\n§8Shield top-ups are\n§8locked until then.` });
  } else {
    out.push({
      bar: `§0§lTOP UP · ${fmt(SHIELD_PER_HOUR)}/H`,
      colour: "red",
      inner: "",
      desc: `§7Shield §f${sh > 0 ? timeLeft(sh) : "off"}§7 / ${raidShieldHours(clan)}h\n§7Halves the chance\n§7of being picked, then\n§7whitelists you.`,
    });
  }
  return out;
}

export async function openRaidMenu(player) {
  const clan = clanOf(player);
  const r = clan && raidOf(clan.id);
  const list = cards(player, clan);
  const st = clan ? raidStats(clan) : { wins: 0, losses: 0, streak: 0 };

  const form = new ActionFormData().title(SCREEN.raid + `${clan ? clan.name.toUpperCase() : "NO CLAN YET"}  ·  WAR TABLE`).body("");
  for (const c of list) form.button(c.bar, BAR + c.colour); // 0-2 action bars
  for (const c of list) form.button(c.inner); // 3-5 box text
  for (const c of list) form.button(c.desc); // 6-8 descriptions
  form.button(`Wins §a${st.wins}`).button(`Losses §c${st.losses}`).button(`Streak §e${st.streak}`); // 9-11
  const state = !r ? "§aREADY" : r.attacker === clan.id ? (r.live ? "§cRAIDING" : "§eSOON") : "§cDEFEND";
  form.button(cardName(player.name)).button(state); // 12-13 squad
  form.button(`${r && r.attacker === clan.id ? r.lives : clan ? raidLives(clan) : 0}\n§e${fmt(clan?.bank ?? 0)}`); // 14
  form.button("Back"); // 15

  const res = await show(player, form);
  if (!res || res.canceled || res.selection === undefined) return;
  const s = res.selection;
  const again = () => openRaidMenu(player);
  if (s === 15) return openMainMenu(player);
  if (!clan) {
    fail(player, "You need a clan first: /is create <name> or ask for an invite.");
    return again();
  }

  if (s === 0) {
    if (!r) return confirmBuy(player, clan);
    if (r.attacker === clan.id) {
      const err = teleportToRaid(player);
      if (err) fail(player, err);
      return err ? again() : undefined;
    }
    player.sendMessage(`§c⚔ §f${r.attackerName} §7is raiding your island - defend it!`);
    return again();
  }
  if (s === 1) {
    if (r && r.attacker === clan.id && can(clan, player.id, "withdraw")) return confirmForfeit(player, r);
    return again();
  }
  if (s === 2) {
    if (whitelistLeft(clan) > 0) {
      fail(player, `Whitelisted for ${timeLeft(whitelistLeft(clan))} - the shield can't be topped up until then.`);
      return again();
    }
    return shieldMenu(player, again);
  }
  return again();
}

async function confirmBuy(player, clan) {
  if (!can(clan, player.id, "withdraw")) {
    fail(player, "Only the owner and co-owners can buy raids.");
    return openRaidMenu(player);
  }
  const res = await show(
    player,
    new MessageFormData()
      .title("Buy a raid?")
      .body(
        `Cost: ${fmt(RAID_PRICE)} from the clan bank (it has ${fmt(clan.bank)}).\n\n` +
          `A random online clan is picked. They get 2 minutes to prepare, then you have 15 minutes.\n\n` +
          `Your clan shares ${raidLives(clan)} lives. Anyone dying on their island loses one.\n\n` +
          `WIN (lives left at the end): you take part of their clan bank.\n` +
          `LOSE (out of lives or forfeit): they take ${takePct(clan.bank)}% of yours (${fmt(takeAmount(clan.bank))} right now).`
      )
      .button1("§c§lRAID!")
      .button2("Cancel")
  );
  if (res && !res.canceled && res.selection === 0) {
    const err = buyRaid(player);
    if (err) fail(player, err);
  }
  return openRaidMenu(player);
}

async function confirmForfeit(player, r) {
  const clan = clanOf(player);
  const res = await show(
    player,
    new MessageFormData()
      .title("Forfeit the raid?")
      .body(`Forfeiting counts as a LOSS.\n\n${r.defenderName} will take ${fmt(takeAmount(clan?.bank ?? 0))} from your clan bank.`)
      .button1("§c§lForfeit")
      .button2("Keep raiding")
  );
  if (res && !res.canceled && res.selection === 0) {
    const err = forfeitRaid(player);
    if (err) fail(player, err);
  }
  return openRaidMenu(player);
}

function shieldMenu(player, back) {
  const clan = clanOf(player);
  if (!clan) return back();
  const room = shieldRoom(clan);
  const options = [...new Set([1, 3, 6, room])].filter((h) => h > 0 && h <= room).sort((a, b) => a - b);
  return tilePages(player, {
    title: "RAID SHIELD",
    body:
      `§7Shield §f${shieldLeft(clan) > 0 ? timeLeft(shieldLeft(clan)) : "off"}§7 / ${raidShieldHours(clan)}h   ` +
      `§7Clan bank §e${fmt(clan.bank)}`,
    tiles: options.length
      ? options.map((h) => ({
          text: `${h === room && h > 6 ? "Fill" : `+${h}h`}\n§e${fmt(h * SHIELD_PER_HOUR)}`,
          icon: "textures/ui/skyclans/head_insurance",
          onClick: () => {
            const err = topUpShield(player, h);
            if (err) fail(player, err);
            else success(player, `Shield topped up by ${h}h.`);
            return shieldMenu(player, back);
          },
        }))
      : [{ text: "§aShield full\n§7Upgrade at the Core", icon: "textures/ui/skyclans/head_insurance", onClick: back }],
    back,
  });
}
