import { ActionFormData } from "@minecraft/server-ui";
import { SCREEN, comingSoon, show } from "../forms.js";
import { openMainMenu } from "./mainMenu.js";

const ART = "textures/ui/skyclans/tier_";

const TIERS = [
  { id: "basic", name: "BASIC", colour: "§f", pct: 10, price: "$50K", desc: "A small cushion for new clans." },
  { id: "silver", name: "SILVER", colour: "§7", pct: 25, price: "$250K" },
  { id: "gold", name: "GOLD", colour: "§6", pct: 50, price: "$1M" },
  { id: "diamond", name: "DIAMOND", colour: "§b", pct: 75, price: "$5M" },
];

// Placeholder: Basic is the next unlock, the rest are locked. Buying comes later.
export async function openInsuranceMenu(player) {
  const unlocked = 0; // how many tiers the clan owns (none yet)
  const form = new ActionFormData().title(SCREEN.insurance + "NO CLAN YET").body("No claims yet");

  const state = (i) => (i === unlocked ? "next" : "locked");

  // 0-3: the cards
  TIERS.forEach((t, i) => {
    const desc = state(i) === "next" ? t.desc : `Unlock ${TIERS[i - 1].name[0]}${TIERS[i - 1].name.slice(1).toLowerCase()} first.`;
    const name = state(i) === "next" ? `§l${t.colour}${t.name}` : `§l§8${t.name}`;
    form.button(`${name}\n\n§r§l§3${t.pct}%\n\n§r§7${desc}`, `${ART}${t.id}_${state(i)}`);
  });
  // 4-7: line at the top of each card
  TIERS.forEach((t, i) => form.button(state(i) === "next" ? "§6NEXT UNLOCK" : "§8LOCKED"));
  // 8-11: text on each card's bar
  TIERS.forEach((t, i) => form.button(state(i) === "next" ? `§0§lBUY · ${t.price}` : `§8§lLOCKED · ${t.price}`));
  // 12: back arrow
  form.button("Back");

  const res = await show(player, form);
  if (!res || res.canceled || res.selection === undefined) return;

  if (res.selection === 12) return openMainMenu(player);
  if (res.selection < 4) {
    const t = TIERS[res.selection];
    if (state(res.selection) === "locked") player.sendMessage(`§b[SkyClans] §7${t.name} is locked - unlock the tier before it first.`);
    else comingSoon(player, `Buying ${t.name} insurance`);
  }
  return openInsuranceMenu(player);
}
