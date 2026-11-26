import { world } from "@minecraft/server";
import { ActionFormData, MessageFormData, ModalFormData } from "@minecraft/server-ui";
import { SCREEN, fail, show, success, tilePages } from "../forms.js";
import { openMainMenu } from "./mainMenu.js";
import {
  MAX_MEMBERS, RANKS, can, clanById, clanOf, createClan, demote, deposit, disband, invite, invitesFor,
  join, kick, leave, membersOf, onlineMembers, promote, withdraw,
} from "../clans.js";
import { buildIsland } from "../islands.js";
import { addMoney, fmt, getBalance, takeMoney } from "../money.js";

const ART = "textures/ui/skyclans/";
const CARD = { owner: "member_owner", co: "member_co", member: "member_member" };

// Long names don't fit on a card on one line: "RotaryLy-\nnx6694"
const cardName = (name) => (name.length > 9 ? `${name.slice(0, 9)}-\n${name.slice(9)}` : name);
const isOnline = (id) => world.getAllPlayers().some((p) => p.id === id);
function joinedText(ms) {
  const days = Math.floor((Date.now() - ms) / 86400000);
  return days <= 0 ? "joined today" : days === 1 ? "joined yesterday" : `joined ${days} days ago`;
}

/** Tells every online member of a clan something. */
export function tellClan(clan, msg, exceptId) {
  for (const p of onlineMembers(clan)) if (p.id !== exceptId) p.sendMessage(msg);
}

// ---- Members (Chain of Command) -----------------------------------------------------------
export async function openMembersMenu(player, selectedId) {
  const clan = clanOf(player);
  if (!clan) return clanSetupMenu(player);
  const members = membersOf(clan);
  const me = members.find((m) => m.id === player.id);
  const sel = members.find((m) => m.id === selectedId) ?? me;
  const owner = members[0];
  const others = members.slice(1, MAX_MEMBERS);
  const canInvite = can(clan, player.id, "invite") && members.length < MAX_MEMBERS;

  // what the red / blue buttons do for the selected member
  let red, blue;
  if (sel.id === me.id) {
    red = me.rank === "owner" ? "disband" : "leave";
    blue = "bank";
  } else {
    const kickable = can(clan, me.id, "kick") && sel.rank !== "owner" && (sel.rank !== "co" || me.rank === "owner");
    red = kickable ? "kick" : undefined;
    if (sel.rank === "member" && can(clan, me.id, "promote")) blue = "promote";
    else if (sel.rank === "co" && me.rank === "owner") blue = "demote";
  }
  const RED_TEXT = { disband: "§lDISBAND CLAN", leave: "§lLEAVE CLAN", kick: "§lKICK" };
  const BLUE_TEXT = { bank: "§lCLAN BANK", promote: "§lPROMOTE", demote: "§lDEMOTE" };

  const online = isOnline(sel.id);
  const form = new ActionFormData()
    .title(SCREEN.members + `CLAN ${clan.name.toUpperCase()}`)
    .body(`${sel.name}\n§7${RANKS[sel.rank]} · ${joinedText(sel.joined)}\n${online ? "§aOnline" : "§8Offline"}`);

  // 0: owner
  form.button(`${cardName(owner.name)}\n${isOnline(owner.id) ? "§aOnline" : "§8Offline"}`, ART + CARD.owner);
  // 1-4: other members, then the Invite card, then hidden
  const slots = [];
  let inviteShown = false;
  for (let i = 0; i < MAX_MEMBERS - 1; i++) {
    const m = others[i];
    if (m) {
      form.button(`${cardName(m.name)}\n${isOnline(m.id) ? "§aOnline" : "§8Offline"}`, ART + CARD[m.rank]);
      slots.push({ member: m });
    } else if (canInvite && !inviteShown) {
      const free = MAX_MEMBERS - members.length;
      form.button(`Invite\n§7${free} open`, ART + "member_invite");
      slots.push({ invite: true });
      inviteShown = true;
    } else {
      form.button("");
      slots.push({});
    }
  }
  form.button(red ? RED_TEXT[red] : ""); // 5
  form.button(blue ? BLUE_TEXT[blue] : ""); // 6
  form.button("Back"); // 7

  const res = await show(player, form);
  if (!res || res.canceled || res.selection === undefined) return;
  const s = res.selection;
  const reopen = (id = sel.id) => openMembersMenu(player, id);

  if (s === 0) return reopen(owner.id);
  if (s >= 1 && s <= 4) {
    const slot = slots[s - 1];
    if (slot.member) return reopen(slot.member.id);
    if (slot.invite) return invitePicker(player);
    return reopen();
  }
  if (s === 7) return openMainMenu(player);
  if (s === 5 && red) return redAction(player, clan, sel, red);
  if (s === 6 && blue) {
    if (blue === "bank") return bankMenu(player, () => reopen());
    const err = blue === "promote" ? promote(player, sel.id) : demote(player, sel.id);
    if (err) fail(player, err);
    else {
      success(player, `${sel.name} is now ${blue === "promote" ? "a Co-owner" : "a Member"}.`);
      tellClan(clan, `§b[${clan.name}] §f${sel.name} §7was ${blue === "promote" ? "promoted to Co-owner" : "demoted to Member"}.`, player.id);
    }
    return reopen();
  }
  return reopen();
}

async function confirm(player, title, body, yes) {
  const res = await show(player, new MessageFormData().title(title).body(body).button1(yes).button2("Cancel"));
  return res && !res.canceled && res.selection === 0;
}

async function redAction(player, clan, sel, action) {
  if (action === "kick") {
    if (!(await confirm(player, "Kick member", `Kick ${sel.name} from ${clan.name}?`, "§cKick"))) return openMembersMenu(player, sel.id);
    const err = kick(player, sel.id);
    if (err) return fail(player, err), openMembersMenu(player);
    success(player, `${sel.name} was kicked.`);
    world.getAllPlayers().find((p) => p.id === sel.id)?.sendMessage(`§cYou were kicked from ${clan.name}.`);
    tellClan(clan, `§b[${clan.name}] §f${sel.name} §7was kicked.`, player.id);
    return openMembersMenu(player);
  }
  if (action === "leave") {
    if (!(await confirm(player, "Leave clan", `Leave ${clan.name}? You'll lose access to its island and bank.`, "§cLeave"))) return openMembersMenu(player);
    const err = leave(player);
    if (err) return fail(player, err);
    success(player, `You left ${clan.name}.`);
    tellClan(clan, `§b[${clan.name}] §f${player.name} §7left the clan.`);
    return;
  }
  // disband
  if (!(await confirm(player, "Disband clan", `Disband ${clan.name} for good?\n\nEveryone is removed and the clan bank (${fmt(clan.bank)}) is lost.`, "§cDisband")))
    return openMembersMenu(player);
  const members = onlineMembers(clan);
  const err = disband(player);
  if (err) return fail(player, err);
  for (const p of members) p.sendMessage(`§c${clan.name} was disbanded.`);
}

/** /is disband and /is leave: same confirm as the Members screen buttons. */
export function confirmLeaveOrDisband(player) {
  const clan = clanOf(player);
  if (!clan) return fail(player, "You're not in a clan.");
  const me = membersOf(clan).find((m) => m.id === player.id);
  return redAction(player, clan, me, me.rank === "owner" ? "disband" : "leave");
}

/** /is kick <name>: confirm, then kick. */
export function confirmKick(player, name) {
  const clan = clanOf(player);
  if (!clan) return fail(player, "You're not in a clan.");
  const m = membersOf(clan).find((x) => x.name.toLowerCase() === name.toLowerCase());
  if (!m) return fail(player, `${name} isn't in your clan.`);
  return redAction(player, clan, m, "kick");
}

function invitePicker(player) {
  const clan = clanOf(player);
  const candidates = world.getAllPlayers().filter((p) => p.id !== player.id && !clanOf(p));
  return tilePages(player, {
    title: "INVITE",
    body: candidates.length ? "§7Online players without a clan" : "§7Nobody online is free to invite",
    tiles: candidates.map((p) => ({
      text: `${p.name}\n§7Tap to invite`,
      icon: ART + "face",
      onClick: () => {
        const err = invite(player, p);
        if (err) fail(player, err);
        else {
          success(player, `Invited ${p.name}.`);
          p.sendMessage(`§b[SkyClans] §f${player.name} §7invited you to §f${clan.name}§7. Type §f/is join ${clan.name} §7or open Members in the menu. (5 minutes)`);
        }
        return openMembersMenu(player);
      },
    })),
    back: () => openMembersMenu(player),
  });
}

// ---- no clan yet: create one or accept an invite ----------------------------------------------
export function clanSetupMenu(player) {
  const invites = invitesFor(player.id);
  return tilePages(player, {
    title: "CLANS",
    body: "§7You're not in a clan yet",
    tiles: [
      { text: "Create clan\n§7Get your island", icon: ART + "tile_home", onClick: () => createClanForm(player) },
      ...invites.map((i) => {
        const c = clanById(i.clanId);
        return {
          text: `Join ${c.name}\n§7from ${i.from}`,
          icon: ART + "member_invite",
          onClick: () => joinByName(player, c.name),
        };
      }),
    ],
    back: () => openMainMenu(player),
  });
}

export async function createClanForm(player, presetName) {
  let name = presetName;
  if (!name) {
    const res = await show(player, new ModalFormData().title("Create a clan").textField("Clan name (3-16 letters, numbers or spaces)", "e.g. Nightfall"));
    if (!res || res.canceled) return;
    name = String(res.formValues?.[0] ?? "");
  }
  const { clan, error } = createClan(player, name);
  if (error) return fail(player, error);
  success(player, `Clan ${clan.name} created! Your island is at ${clan.island.cx}, ${clan.island.cz}.`);
  return buildIsland(player, clan);
}

/** Joins a clan by name (needs an invite). */
export function joinByName(player, name) {
  const err = join(player, name);
  if (err) return fail(player, err);
  const clan = clanOf(player);
  success(player, `You joined ${clan.name}! Use /is home to go to your island.`);
  tellClan(clan, `§b[${clan.name}] §f${player.name} §7joined the clan.`, player.id);
}

// ---- clan bank -------------------------------------------------------------------------------
export async function bankMenu(player, back) {
  const clan = clanOf(player);
  if (!clan) return fail(player, "You're not in a clan.");
  const canTake = can(clan, player.id, "withdraw");
  const actions = canTake ? ["Deposit", "Withdraw"] : ["Deposit"];
  const res = await show(
    player,
    new ModalFormData()
      .title(`${clan.name} bank`)
      .dropdown(`Clan bank: ${fmt(clan.bank)}\nYour wallet: ${fmt(getBalance(player))}\n\nWhat to do`, actions, { defaultValueIndex: 0 })
      .textField("Amount", "e.g. 5000")
  );
  if (res && !res.canceled) {
    const [a, raw] = res.formValues ?? [];
    const amount = Math.floor(Number(String(raw ?? "").replace(/[,$\s]/g, "")));
    const isDeposit = actions[a] === "Deposit";
    const err = isDeposit ? deposit(player, amount, takeMoney) : withdraw(player, amount, addMoney);
    if (err) fail(player, err);
    else {
      success(player, `${isDeposit ? "Deposited" : "Withdrew"} ${fmt(amount)}. Clan bank: ${fmt(clanOf(player).bank)}.`);
      tellClan(clan, `§b[${clan.name}] §f${player.name} §7${isDeposit ? "deposited" : "withdrew"} §a${fmt(amount)}§7.`, player.id);
    }
  }
  return back?.();
}
