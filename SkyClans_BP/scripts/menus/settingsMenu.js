import { ActionFormData } from "@minecraft/server-ui";
import { SCREEN, show } from "../forms.js";
import { SETTINGS, pref, setPref } from "../playerSettings.js";
import { openMainMenu } from "./mainMenu.js";

const CARD = "textures/ui/skyclans/card_";

// Tap a card to flip its lever. The settings themselves run in playerSettings.js.
export async function openSettingsMenu(player) {
  const form = new ActionFormData().title(SCREEN.settings + "ONLY YOU SEE THESE").body("Tap a card to switch it");
  for (const s of SETTINGS) {
    const on = pref(player, s.id);
    form.button(`${s.name}\n§7${s.desc}\n${on ? "§aON" : "§8OFF"}`, `${CARD}${s.art}_${on ? "on" : "off"}`);
  }
  form.button("Back"); // button 4 = the back arrow next to the X

  const res = await show(player, form);
  if (!res || res.canceled || res.selection === undefined) return;
  if (res.selection === SETTINGS.length) return openMainMenu(player);

  const s = SETTINGS[res.selection];
  const on = !pref(player, s.id);
  setPref(player, s.id, on);
  player.playSound(on ? "random.click" : "random.click", { pitch: on ? 1.2 : 0.8 });
  return openSettingsMenu(player);
}
