import { ActionFormData } from "@minecraft/server-ui";
import { SCREEN, show } from "../forms.js";
import { openMainMenu } from "./mainMenu.js";

const CARD = "textures/ui/skyclans/card_";

// Order = position on screen: top-left, top-right, bottom-left, bottom-right.
// "art" picks the card picture; later the lever will flip by using _on / _off.
const SETTINGS = [
  { name: "Chunk Borders", desc: "Outline the chunk you are standing in.", art: "chunks" },
  { name: "Full Bright", desc: "See clearly at night without torches.", art: "bright" },
  { name: "Raid Alert Sound", desc: "Warning sound when raiders start bridging.", art: "alert" },
  { name: "Coordinates", desc: "Show X / Y / Z and facing on the action bar.", art: "coords" },
];

export async function openSettingsMenu(player) {
  const form = new ActionFormData().title(SCREEN.settings + "ONLY YOU SEE THESE").body("Pull a lever to switch it");
  for (const s of SETTINGS) {
    // Placeholder: every setting shows COMING SOON with the lever off.
    form.button(`${s.name}\n§7${s.desc}\n§8COMING SOON`, `${CARD}${s.art}_off`);
  }
  form.button("Back"); // button 4 = the back arrow next to the X

  const res = await show(player, form);
  if (!res || res.canceled || res.selection === undefined) return;

  if (res.selection === SETTINGS.length) return openMainMenu(player);

  player.sendMessage(`§b[SkyClans] §f${SETTINGS[res.selection].name} §7- coming soon`);
  return openSettingsMenu(player);
}
