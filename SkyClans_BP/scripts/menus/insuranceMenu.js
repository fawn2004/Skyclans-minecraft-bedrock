import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { SCREEN, fail, show, success } from "../forms.js";
import { can, clanOf } from "../clans.js";
import { fmt } from "../money.js";
import { INSURANCE, buyInsurance, insuranceLevel, raidStats } from "../raids.js";
import { openMainMenu } from "./mainMenu.js";

// ============================================================================
//  INSURANCE - bought in order (Basic -> Silver -> Gold -> Diamond) from the
//  clan bank and kept forever. When the clan loses money in a raid, its best
//  tier pays back a % of it, up to that tier's cap. Tiers are in raids.js.
//  Layout: ui/sc_insurance.json (0-3 cards, 4-7 top lines, 8-11 bars, 12 back).
// ============================================================================

const ART = "textures/ui/skyclans/tier_";

export async function openInsuranceMenu(player) {
  const clan = clanOf(player);
  const owned = insuranceLevel(clan); // tiers 0..owned-1 are owned, tier `owned` is next
  const st = clan ? raidStats(clan) : undefined;
  const body = !clan ? "Join a clan first" : st.claims ? `${st.claims} claim${st.claims > 1 ? "s" : ""} · ${fmt(st.paidOut)} paid back` : "No claims yet";
  const form = new ActionFormData().title(SCREEN.insurance + (clan ? clan.name.toUpperCase() : "NO CLAN YET")).body(body);

  const state = (i) => (i < owned ? "owned" : i === owned && clan ? "next" : "locked");
  const lower = (s) => s[0] + s.slice(1).toLowerCase();

  // 0-3: the cards
  INSURANCE.forEach((t, i) => {
    const s = state(i);
    const desc =
      s === "locked"
        ? clan ? `Unlock ${lower(INSURANCE[i - 1].name)} first.` : "Join a clan first."
        : `Pays back ${t.pct}% of raid losses, up to ${fmt(t.cap)}.`;
    const name = s === "locked" ? `§l§8${t.name}` : `§l${t.colour}${t.name}`;
    form.button(`${name}\n\n§r§l§3${t.pct}%\n\n§r§7${desc}`, `${ART}${t.id}_${s === "locked" ? "locked" : "next"}`);
  });
  // 4-7: line at the top of each card
  INSURANCE.forEach((t, i) => form.button({ owned: "§aOWNED", next: "§6NEXT UNLOCK", locked: "§8LOCKED" }[state(i)]));
  // 8-11: text on each card's bar
  INSURANCE.forEach((t, i) =>
    form.button({ owned: "§0§lOWNED", next: `§0§lBUY · ${fmt(t.price)}`, locked: `§8§lLOCKED · ${fmt(t.price)}` }[state(i)])
  );
  // 12: back arrow
  form.button("Back");

  const res = await show(player, form);
  if (!res || res.canceled || res.selection === undefined) return;
  const s = res.selection;
  if (s === 12) return openMainMenu(player);
  const i = s < 4 ? s : s >= 8 && s < 12 ? s - 8 : s - 4;
  const t = INSURANCE[i];
  if (!clan) fail(player, "You need a clan for insurance.");
  else if (state(i) === "owned") player.sendMessage(`§b[SkyClans] §7Your clan already has ${t.name} insurance.`);
  else if (state(i) === "locked") player.sendMessage(`§b[SkyClans] §7${t.name} is locked - buy ${lower(INSURANCE[i - 1].name)} first.`);
  else return confirmBuy(player, clan, t);
  return openInsuranceMenu(player);
}

async function confirmBuy(player, clan, t) {
  if (!can(clan, player.id, "withdraw")) {
    fail(player, "Only the owner and co-owners can buy insurance.");
    return openInsuranceMenu(player);
  }
  const res = await show(
    player,
    new MessageFormData()
      .title(`Buy ${t.name} insurance?`)
      .body(
        `Cost: ${fmt(t.price)} from the clan bank (it has ${fmt(clan.bank)}).\n\n` +
          `When your clan loses money in a raid, insurance pays back ${t.pct}% of it, up to ${fmt(t.cap)} per raid.\n\n` +
          `It's yours for good - no need to buy it again.`
      )
      .button1("§aBuy")
      .button2("Cancel")
  );
  if (res && !res.canceled && res.selection === 0) {
    const err = buyInsurance(player);
    if (err) fail(player, err);
    else success(player, `${t.name} insurance bought!`);
  }
  return openInsuranceMenu(player);
}
