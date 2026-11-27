import { CommandPermissionLevel, CustomCommandParamType, CustomCommandStatus, system, world } from "@minecraft/server";
import { openMainMenu, goToSpawn } from "./menus/mainMenu.js";
import { openAdminMenu } from "./menus/adminMenu.js";
import { openShopMenu, quickSell } from "./menus/shopMenu.js";
import { openSettingsMenu } from "./menus/settingsMenu.js";
import { kitsMenu } from "./kits.js";
import { CRATES, cratesMenu, giveKeys } from "./crates.js";
import { isAdmin } from "./spawners.js";
import { pref, setPref } from "./playerSettings.js";
import { addMoney, fmt, fmtExact, getBalance, setBalance, takeMoney, topBalances } from "./money.js";
import { getSpawn, setSpawnHere } from "./serverSettings.js";
import { RANKS, clanOf, invite, membersOf, onlineMembers, promote, demote, setHome, transfer, deposit, withdraw } from "./clans.js";
import { goHome } from "./islands.js";
import { openCoreMenu } from "./menus/coreMenu.js";
import { NPC_TYPES, removeNearestNpc, spawnNpc } from "./npcs.js";
import { bankMenu, clanSetupMenu, confirmKick, confirmLeaveOrDisband, createClanForm, joinByName, openMembersMenu, tellClan } from "./menus/membersMenu.js";

// ============================================================================
//  COMMANDS
//  Players:  /spawn /menu /shop /sell <hand|all> /bal /baltop /pay /kits
//            /crates /settings /coords
//            /is <create|home|sethome|invite|join|leave|kick|promote|demote|transfer|
//                 info|members|bank|deposit|withdraw|disband> [name]
//            /deposit <amount>  /withdraw <amount>   (clan bank)
//  Admins (players with the "admin" tag - /tag <name> add admin):
//            /admin /eco /givekey /setspawn /broadcast /npc <type|remove>
//  Typed without the "skyclans:" part, e.g. /spawn. Cheats don't need to be on.
// ============================================================================

const OK = { status: CustomCommandStatus.Success };
const failed = (message) => ({ status: CustomCommandStatus.Failure, message });
const asPlayer = (origin) => (origin.sourceEntity?.typeId === "minecraft:player" ? origin.sourceEntity : undefined);
const NOT_ADMIN = "You need the admin tag for that (/tag <name> add admin).";

// Command callbacks can't change the world or open menus directly,
// so the real work runs on the next tick.
const later = (fn) =>
  system.run(() => {
    try {
      const r = fn();
      if (r?.catch) r.catch((e) => console.warn(`[SkyClans] command error: ${e}`));
    } catch (e) {
      console.warn(`[SkyClans] command error: ${e}`);
    }
  });

/** A command only players can run. fn(player, ...args) */
const playerOnly = (fn) => (origin, ...args) => {
  const p = asPlayer(origin);
  if (!p) return failed("Only players can use this.");
  later(() => fn(p, ...args));
  return OK;
};

/** An admin command. Players need the admin tag; command blocks / the console can always run it.
 *  fn(player | undefined, ...args) */
const adminOnly = (fn) => (origin, ...args) => {
  const p = asPlayer(origin);
  if (p && !isAdmin(p)) return failed(NOT_ADMIN);
  later(() => fn(p, ...args));
  return OK;
};

const tell = (p, msg) => (p ? p.sendMessage(msg) : console.warn(`[SkyClans] ${msg}`));

export function registerCommands() {
  system.beforeEvents.startup.subscribe(({ customCommandRegistry: reg }) => {
    const any = CommandPermissionLevel.Any; // everyone can type it; admin ones check the tag
    const cmd = (name, description, fn, mandatoryParameters, optionalParameters) =>
      reg.registerCommand({ name: `skyclans:${name}`, description, permissionLevel: any, cheatsRequired: false, mandatoryParameters, optionalParameters }, fn);
    const P = CustomCommandParamType;

    reg.registerEnum("skyclans:sellmode", ["hand", "all"]);
    reg.registerEnum("skyclans:ecoaction", ["give", "take", "set"]);
    reg.registerEnum("skyclans:crate", Object.keys(CRATES));

    // ---- players ------------------------------------------------------------------
    cmd("spawn", "Teleport to spawn", playerOnly((p) => goToSpawn(p)));
    cmd("menu", "Open the SkyClans menu", playerOnly((p) => openMainMenu(p)));
    cmd("shop", "Open the Sky Shop", playerOnly((p) => openShopMenu(p)));
    cmd("kits", "Open the kits", playerOnly((p) => kitsMenu(p)));
    cmd("crates", "See your crate keys and open crates", playerOnly((p) => cratesMenu(p)));
    cmd("settings", "Open your settings", playerOnly((p) => openSettingsMenu(p)));
    cmd(
      "coords",
      "Turn the coordinates display on or off",
      playerOnly((p) => {
        const on = !pref(p, "coords");
        setPref(p, "coords", on);
        p.sendMessage(`§b[SkyClans] §7Coordinates ${on ? "§aon" : "§coff"}§7.`);
      })
    );
    cmd(
      "sell",
      "Sell what you're holding, or everything the shop buys",
      playerOnly((p, mode) => quickSell(p, mode)),
      [{ name: "skyclans:sellmode", type: P.Enum }]
    );
    cmd("bal", "Show your balance", (origin) => {
      const p = asPlayer(origin);
      if (!p) return failed("Only players have a balance.");
      return { ...OK, message: `§7Balance: §a${fmt(getBalance(p))} §8(${fmtExact(getBalance(p))})` };
    });
    cmd("baltop", "The richest players", (origin) => {
      const lines = topBalances(10).map((t, i) => `§e#${i + 1} §f${t.name} §7- §a${fmt(t.balance)}`);
      return { ...OK, message: ["§b§lRichest players", ...(lines.length ? lines : ["§7Nobody has money yet."])].join("\n") };
    });
    cmd(
      "pay",
      "Send money to another player",
      (origin, targets, amount) => {
        const p = asPlayer(origin);
        if (!p) return failed("Only players can pay.");
        if (!Array.isArray(targets) || targets.length !== 1) return failed("Pick one player.");
        const target = targets[0];
        if (target.id === p.id) return failed("You can't pay yourself.");
        if (!(amount > 0)) return failed("The amount must be more than 0.");
        later(() => {
          if (!target.isValid) return p.sendMessage(`§c${target.name} isn't online.`);
          if (!takeMoney(p, amount)) return p.sendMessage(`§cYou only have ${fmt(getBalance(p))}.`);
          addMoney(target, amount);
          p.sendMessage(`§a✔ Sent ${fmt(amount)} to ${target.name}.`);
          target.sendMessage(`§a✔ ${p.name} sent you ${fmt(amount)}.`);
        });
        return OK;
      },
      [
        { name: "player", type: P.PlayerSelector },
        { name: "amount", type: P.Integer },
      ]
    );

    // ---- clan bank: /deposit <amount>  /withdraw <amount> ----------------------------------
    cmd("deposit", "Put money in your clan bank", playerOnly((p, n) => bankMove(p, "deposit", n)), [{ name: "amount", type: P.Integer }]);
    cmd("withdraw", "Take money out of your clan bank (owner / co-owner)", playerOnly((p, n) => bankMove(p, "withdraw", n)), [{ name: "amount", type: P.Integer }]);

    // ---- islands & clans: /is <action> [name or amount] ------------------------------------
    reg.registerEnum("skyclans:isaction", IS_ACTIONS);
    cmd(
      "is",
      "Your clan and island: /is home, /is invite <player>, /is create <name> ...",
      playerOnly((p, action, ...words) => isCommand(p, action, words.filter((w) => w !== undefined).join(" ").trim())),
      [{ name: "skyclans:isaction", type: P.Enum }],
      Array.from({ length: 6 }, (_, i) => ({ name: i ? `word${i + 1}` : "name", type: P.String }))
    );

    // ---- admins ("admin" tag) ---------------------------------------------------------
    cmd(
      "admin",
      "Open the SkyClans admin menu (admin tag)",
      adminOnly((p) => (p ? openAdminMenu(p) : undefined))
    );
    cmd(
      "eco",
      "Give, take or set a player's money (admin tag)",
      adminOnly((p, action, targets, amount) => {
        if (!(amount >= 0)) return tell(p, "§cThe amount can't be negative.");
        for (const t of targets ?? []) {
          if (action === "give") addMoney(t, amount);
          else if (action === "take") setBalance(t, getBalance(t) - amount);
          else setBalance(t, amount);
          tell(p, `§a✔ ${t.name} now has ${fmt(getBalance(t))}.`);
          if (t.id !== p?.id) t.sendMessage(`§b[SkyClans] §7Your balance is now §a${fmt(getBalance(t))}§7.`);
        }
      }),
      [
        { name: "skyclans:ecoaction", type: P.Enum },
        { name: "player", type: P.PlayerSelector },
        { name: "amount", type: P.Integer },
      ]
    );
    cmd(
      "givekey",
      "Give crate keys (admin tag)",
      adminOnly((p, targets, crate, amount) => {
        const n = Math.max(1, Math.min(640, amount ?? 1));
        for (const t of targets ?? []) {
          giveKeys(t, crate, n);
          tell(p, `§a✔ Gave ${t.name} ${n} ${CRATES[crate].name} key${n === 1 ? "" : "s"}.`);
          if (t.id !== p?.id) t.sendMessage(`§b[SkyClans] §7You got §f${n} ${CRATES[crate].name} key${n === 1 ? "" : "s"}§7!`);
        }
      }),
      [
        { name: "player", type: P.PlayerSelector },
        { name: "skyclans:crate", type: P.Enum },
      ],
      [{ name: "amount", type: P.Integer }]
    );
    reg.registerEnum("skyclans:npctype", [...Object.keys(NPC_TYPES), "remove"]);
    cmd(
      "npc",
      "Place a shop NPC where you stand, or remove the nearest (admin tag)",
      adminOnly((p, type) => {
        if (!p) return;
        if (type === "remove") {
          const gone = removeNearestNpc(p);
          return p.sendMessage(gone ? `§a✔ Removed the ${gone} NPC.` : "§cNo shop NPC within 4 blocks.");
        }
        spawnNpc(p, type);
        p.sendMessage(`§a✔ Placed the ${type} NPC. §7Step back - it faces the way you were looking.`);
      }),
      [{ name: "skyclans:npctype", type: P.Enum }]
    );
    cmd(
      "setspawn",
      "Set spawn where you're standing (admin tag)",
      adminOnly((p) => {
        if (!p) return;
        setSpawnHere(p);
        const s = getSpawn();
        p.sendMessage(`§a✔ Spawn set to ${s.x} ${s.y} ${s.z}.`);
      })
    );
    cmd(
      "broadcast",
      "Send an announcement to everyone (admin tag)",
      adminOnly((p, ...words) => {
        const text = words.filter((w) => w !== undefined).join(" ").trim();
        if (!text) return;
        world.sendMessage(`§6§l[ANNOUNCEMENT] §r§f${text}`);
      }),
      [{ name: "message", type: P.String }],
      // Bedrock allows 8 parameters per command: message + 7 more words (or put the message in "quotes")
      Array.from({ length: 7 }, (_, i) => ({ name: `word${i + 2}`, type: P.String }))
    );
  });
}

/** Moves money between the player's wallet and their clan bank. */
function bankMove(p, action, n) {
  const clan = clanOf(p);
  if (!clan) return fail(p, "You're not in a clan.");
  const err = action === "deposit" ? deposit(p, n, takeMoney) : withdraw(p, n, addMoney);
  if (err) return fail(p, err);
  ok(p, `${action === "deposit" ? "Deposited" : "Withdrew"} ${fmt(n)}. Clan bank: ${fmt(clanOf(p).bank)}.`);
  tellClan(clan, `§b[${clan.name}] §f${p.name} §7${action === "deposit" ? "deposited" : "withdrew"} §a${fmt(n)}§7.`, p.id);
}

// ---- /is --------------------------------------------------------------------------------
const IS_ACTIONS = [
  "create", "home", "sethome", "invite", "join", "leave", "kick", "promote", "demote",
  "transfer", "info", "members", "bank", "deposit", "withdraw", "disband", "core",
];

const fail = (p, msg) => p.sendMessage(`§c✘ ${msg}`);
const ok = (p, msg) => p.sendMessage(`§a✔ ${msg}`);
const amountOf = (text) => Math.floor(Number(String(text).replace(/[,$\s]/g, "")));

/** A member of the player's clan by name (online or not). */
function memberByName(clan, name) {
  return membersOf(clan).find((m) => m.name.toLowerCase() === name.toLowerCase());
}

function isCommand(p, action, text) {
  const clan = clanOf(p);
  const needClan = () => {
    fail(p, "You're not in a clan. /is create <name> to start one.");
    return false;
  };
  switch (action) {
    case "create":
      return createClanForm(p, text || undefined);
    case "home":
      return clan ? goHome(p) : clanSetupMenu(p);
    case "join":
      if (!text) return clanSetupMenu(p);
      return joinByName(p, text);
    case "members":
      return openMembersMenu(p);
    case "core":
      return clan ? openCoreMenu(p, clan) : needClan();
    case "bank":
      return clan ? bankMenu(p) : needClan();
    case "leave":
    case "disband":
      return confirmLeaveOrDisband(p);
    case "kick":
      if (!clan) return needClan();
      if (!text) return fail(p, "Who? /is kick <name>");
      return confirmKick(p, text);
  }
  if (!clan) return needClan();
  let err;
  switch (action) {
    case "sethome":
      err = setHome(p);
      if (!err) ok(p, "Island home set here.");
      break;
    case "invite": {
      const target = world.getAllPlayers().find((x) => x.name.toLowerCase() === text.toLowerCase());
      if (!target) return fail(p, text ? `${text} isn't online.` : "Who? /is invite <name>");
      err = invite(p, target);
      if (!err) {
        ok(p, `Invited ${target.name}.`);
        target.sendMessage(`§b[SkyClans] §f${p.name} §7invited you to §f${clan.name}§7. Type §f/is join ${clan.name} §7(5 minutes).`);
      }
      break;
    }
    case "promote":
    case "demote":
    case "transfer": {
      const m = memberByName(clan, text);
      if (!m) return fail(p, text ? `${text} isn't in your clan.` : `Who? /is ${action} <name>`);
      err = action === "promote" ? promote(p, m.id) : action === "demote" ? demote(p, m.id) : transfer(p, m.id);
      if (!err) {
        const what = action === "transfer" ? "is now the clan owner" : action === "promote" ? "was promoted to Co-owner" : "was demoted to Member";
        ok(p, `${m.name} ${what}.`);
        tellClan(clan, `§b[${clan.name}] §f${m.name} §7${what}.`, p.id);
      }
      break;
    }
    case "deposit":
    case "withdraw": {
      // Bedrock won't put a plain number in the /is text slot, so with no amount
      // this opens the clan bank; /deposit <amount> and /withdraw <amount> take numbers.
      const n = amountOf(text);
      if (!(n > 0)) return bankMenu(p);
      return bankMove(p, action, n);
    }
    case "info": {
      const lines = membersOf(clan).map((m) => `§7- §f${m.name} §8(${RANKS[m.rank]})`);
      p.sendMessage(
        [
          `§b§l${clan.name}`,
          `§7Island: §f${clan.island.cx}, ${clan.island.cz} §8(${clan.island.size}x${clan.island.size})`,
          `§7Bank: §e${fmt(clan.bank)}   §7Online: §f${onlineMembers(clan).length}/${membersOf(clan).length}`,
          ...lines,
        ].join("\n")
      );
      return;
    }
  }
  if (err) fail(p, err);
}
