import { ActionFormData } from "@minecraft/server-ui";
import { SCREEN, comingSoon, show } from "../forms.js";
import { openMainMenu } from "./mainMenu.js";

const BAR = "textures/ui/skyclans/bar_";

// Button numbers must match tools/make_layouts.py (Raid Dispatch).
const RAIDS = [
  {
    name: "Normal raid",
    bar: "§0§lBUY · $30K",
    colour: "gold",
    inner: "",
    desc: "Random clan. Could be loaded, could be empty. No info.",
  },
  {
    name: "Intel raid",
    bar: "§0§lSCOUT · FREE",
    colour: "gold",
    inner: "Scouting is free, once a minute.\n\nTap to get a hint about a target.",
    desc: "See the hint, then deploy or walk away.",
  },
  {
    name: "Cheap raid",
    bar: "§0§lBUY · $15K",
    colour: "red",
    inner: "§fUNPAID UPKEEP\n§c0 §7islands can't pay their core tax right now",
    desc: "Half price. Random pick from the exposed islands.",
  },
];

function cardName(name) {
  return name.length > 9 ? `${name.slice(0, 9)}-\n${name.slice(9)}` : name;
}

// Placeholder data until clans and raids exist.
export async function openRaidMenu(player) {
  const form = new ActionFormData().title(SCREEN.raid + "NO CLAN YET  ·  WAR TABLE").body("");

  for (const r of RAIDS) form.button(r.bar, BAR + r.colour); // 0-2 action bars
  for (const r of RAIDS) form.button(r.inner); // 3-5 box text
  for (const r of RAIDS) form.button(`§7${r.desc}`); // 6-8 descriptions
  form.button("Wins §a0").button("Losses §c0").button("Streak §e0"); // 9-11
  form.button(cardName(player.name)).button("§aREADY"); // 12-13 squad
  form.button("3\n§e$0"); // 14 lives each / clan bank
  form.button("Back"); // 15

  const res = await show(player, form);
  if (!res || res.canceled || res.selection === undefined) return;
  if (res.selection === 15) return openMainMenu(player);
  if (res.selection <= 2) comingSoon(player, RAIDS[res.selection].name);
  return openRaidMenu(player);
}
