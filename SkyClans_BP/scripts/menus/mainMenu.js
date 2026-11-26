import { world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { SCREEN, comingSoon, show } from "../forms.js";
import { openSettingsMenu } from "./settingsMenu.js";

const TILE = "textures/ui/skyclans/tile_";

// Order here = order on screen (3 per row).
// Each "open" is a placeholder for now - it gets replaced as each menu is built.
const TILES = [
  { name: "Island Home", sub: "Teleport home", art: "home", open: (p) => comingSoon(p, "Island Home") },
  { name: "Raids", sub: "Attack islands", art: "raids", open: (p) => comingSoon(p, "Raids") },
  { name: "Sky Shop", sub: "Buy & sell", art: "shop", open: (p) => comingSoon(p, "Sky Shop") },
  { name: "Insurance", sub: "No cover yet", art: "insurance", open: (p) => comingSoon(p, "Insurance") },
  { name: "Members", sub: "Your clan", art: "members", open: (p) => comingSoon(p, "Members") },
  { name: "Settings", sub: "Your options", art: "settings", open: (p) => openSettingsMenu(p) },
];

export async function openMainMenu(player) {
  const online = world.getPlayers().length;
  // Placeholder header info until clans exist.
  const clanLine = `NO CLAN  ·  ${online} ONLINE`;
  const stats = "Bank §e$0 §7 Wallet §a$0 §7 Shield §cOFF";

  const form = new ActionFormData().title(SCREEN.main + clanLine).body(stats);
  for (const t of TILES) form.button(`${t.name}\n§7${t.sub}`, TILE + t.art);

  const res = await show(player, form);
  if (!res || res.canceled || res.selection === undefined) return;
  await TILES[res.selection]?.open(player);
}
