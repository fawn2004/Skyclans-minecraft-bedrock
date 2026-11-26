import { world } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import { SPAWNERS } from "../spawnerConfig.js";
import { fail, show, success, tilePages } from "../forms.js";
import { giveSpawner } from "../spawners.js";
import { giveKitMenu } from "../kits.js";
import { addMoney, fmt, getBalance, setBalance } from "../money.js";
import { getSpawn, getStartingMoney, setSidebarEnabled, setSpawnHere, setStartingMoney, sidebarEnabled } from "../serverSettings.js";
import { clearSidebars } from "../sidebar.js";

const ICON = "textures/ui/skyclans/";
const toAdmin = (player) => () => openAdminMenu(player);

// /admin (operators only).
export function openAdminMenu(player) {
  const sp = getSpawn();
  const sidebarOn = sidebarEnabled();
  return tilePages(player, {
    title: "ADMIN",
    body: "§7Operators only",
    tiles: [
      { text: "Money\n§7Give / take / set", icon: "textures/items/gold_ingot", onClick: () => moneyPlayers(player) },
      { text: "Give Spawner\n§7For testing", icon: "textures/blocks/mob_spawner", onClick: () => giveSpawnerMenu(player) },
      { text: "Give Kit\n§7For testing", icon: "textures/items/diamond_chestplate", onClick: () => giveKitMenu(player, toAdmin(player)) },
      {
        text: `Set Spawn Here\n§7Now ${sp.x} ${sp.y} ${sp.z}`,
        icon: "textures/items/compass_item",
        onClick: () => {
          setSpawnHere(player);
          const s = getSpawn();
          success(player, `Spawn set to ${s.x} ${s.y} ${s.z} (${s.dim.replace("minecraft:", "")}).`);
          return openAdminMenu(player);
        },
      },
      {
        text: `Starting Money\n§a${fmt(getStartingMoney())}`,
        icon: "textures/items/emerald",
        onClick: () => startingMoney(player),
      },
      {
        text: `Sidebar\n${sidebarOn ? "§aON" : "§cOFF"} §7for everyone`,
        icon: "textures/items/paper",
        onClick: () => {
          setSidebarEnabled(!sidebarOn);
          if (sidebarOn) clearSidebars();
          success(player, `Sidebar turned ${sidebarOn ? "off" : "on"} for everyone.`);
          return openAdminMenu(player);
        },
      },
      {
        text: "Menu Item\n§7Give yourself one",
        icon: "textures/items/skyclans_menu",
        onClick: () => {
          player.runCommand("give @s skyclans:menu");
          return openAdminMenu(player);
        },
      },
    ],
  });
}

// ---- money -----------------------------------------------------------------------
function moneyPlayers(player) {
  const players = world.getAllPlayers().sort((a, b) => a.name.localeCompare(b.name));
  return tilePages(player, {
    title: "MONEY",
    body: "§7Pick an online player",
    tiles: players.map((p) => ({
      text: `${p.name}\n§a${fmt(getBalance(p))}`,
      icon: ICON + "face",
      onClick: () => moneyEdit(player, p),
    })),
    back: toAdmin(player),
  });
}

async function moneyEdit(admin, target) {
  const form = new ModalFormData()
    .title(`Money: ${target.name}`)
    .dropdown(`Balance: ${fmt(getBalance(target))}\n\nWhat to do`, ["Give", "Take", "Set to"], { defaultValueIndex: 0 })
    .textField("Amount", "e.g. 50000");
  const res = await show(admin, form);
  if (!res || res.canceled) return moneyPlayers(admin);
  const [action, raw] = res.formValues ?? [];
  const amount = Math.floor(Number(String(raw ?? "").replace(/[,$\s]/g, "")));
  if (!Number.isFinite(amount) || amount < 0) {
    fail(admin, "That's not a valid amount.");
    return moneyEdit(admin, target);
  }
  if (!target.isValid) {
    fail(admin, `${target.name} left the game.`);
    return moneyPlayers(admin);
  }
  if (action === 0) addMoney(target, amount);
  else if (action === 1) setBalance(target, getBalance(target) - amount);
  else setBalance(target, amount);
  success(admin, `${target.name} now has ${fmt(getBalance(target))}.`);
  if (target.id !== admin.id) target.sendMessage(`§b[SkyClans] §7An admin changed your balance to §a${fmt(getBalance(target))}§7.`);
  return moneyPlayers(admin);
}

async function startingMoney(player) {
  const res = await show(
    player,
    new ModalFormData().title("Starting Money").textField(`New players get this once.\nNow: ${fmt(getStartingMoney())}`, "e.g. 1000")
  );
  if (res && !res.canceled) {
    const n = Math.floor(Number(String(res.formValues?.[0] ?? "").replace(/[,$\s]/g, "")));
    if (Number.isFinite(n) && n >= 0) {
      setStartingMoney(n);
      success(player, `Starting money set to ${fmt(n)}.`);
    } else fail(player, "That's not a valid amount.");
  }
  return openAdminMenu(player);
}

// ---- give spawner ----------------------------------------------------------------
function giveSpawnerMenu(player, page = 0) {
  return tilePages(
    player,
    {
      title: "GIVE SPAWNER",
      body: "§7Tap one to get 1 spawner",
      tiles: SPAWNERS.map((s, i) => ({
        text: `${s.name}\n§7Spawner`,
        icon: s.icon,
        onClick: () => {
          giveSpawner(player, s.mob, 1);
          success(player, `Gave you 1 ${s.name} Spawner.`);
          return giveSpawnerMenu(player, Math.floor(i / 9));
        },
      })),
      back: toAdmin(player),
    },
    page
  );
}
