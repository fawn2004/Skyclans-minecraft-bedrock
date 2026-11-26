import { world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { SCREEN, comingSoon, show } from "../forms.js";
import { fmtShort, getBalance } from "../money.js";
import { getSpawn } from "../serverSettings.js";
import { openSettingsMenu } from "./settingsMenu.js";
import { openMembersMenu } from "./membersMenu.js";
import { openInsuranceMenu } from "./insuranceMenu.js";
import { openRaidMenu } from "./raidMenu.js";
import { openShopMenu } from "./shopMenu.js";

const TILE = "textures/ui/skyclans/tile_";

// Order here = order on screen (3 per row).
// Each "open" is a placeholder for now - it gets replaced as each menu is built.
const TILES = [
  { name: "Island Home", sub: "Teleport home", art: "home", open: (p) => comingSoon(p, "Island Home") },
  { name: "Raids", sub: "Attack islands", art: "raids", open: (p) => openRaidMenu(p) },
  { name: "Sky Shop", sub: "Buy & sell", art: "shop", open: (p) => openShopMenu(p) },
  { name: "Insurance", sub: "No cover yet", art: "insurance", open: (p) => openInsuranceMenu(p) },
  { name: "Members", sub: "Your clan", art: "members", open: (p) => openMembersMenu(p) },
  { name: "Settings", sub: "Your options", art: "settings", open: (p) => openSettingsMenu(p) },
];

export async function openMainMenu(player) {
  const online = world.getPlayers().length;
  // Clan info is a placeholder until clans exist.
  const clanLine = `NO CLAN  ·  ${online} ONLINE`;
  const stats = `Bank §e$0 §7 Wallet §a${fmtShort(getBalance(player))} §7 Shield §cOFF`;

  const form = new ActionFormData().title(SCREEN.main + clanLine).body(stats);
  for (const t of TILES) form.button(`${t.name}\n§7${t.sub}`, TILE + t.art);
  form.button("Spawn"); // button 6: the Spawn button under the stat chip

  const res = await show(player, form);
  if (!res || res.canceled || res.selection === undefined) return;
  if (res.selection === TILES.length) return goToSpawn(player);
  await TILES[res.selection]?.open(player);
}

// Spawn point: 0 0 0 until an admin uses /admin > Set Spawn Here.
function goToSpawn(player) {
  const s = getSpawn();
  // +0.5 puts you in the middle of the block instead of on its corner
  player.teleport({ x: s.x + 0.5, y: s.y, z: s.z + 0.5 }, { dimension: world.getDimension(s.dim ?? "minecraft:overworld") });
  player.sendMessage("§b[SkyClans] §7Teleported to spawn.");
}
