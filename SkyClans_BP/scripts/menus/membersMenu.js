import { ActionFormData } from "@minecraft/server-ui";
import { SCREEN, comingSoon, show } from "../forms.js";
import { openMainMenu } from "./mainMenu.js";

const ART = "textures/ui/skyclans/";

// Long names don't fit on the card on one line, so split them like "RotaryLy-\nnx6694".
function cardName(name) {
  return name.length > 9 ? `${name.slice(0, 9)}-\n${name.slice(9)}` : name;
}

// Placeholder until clans exist: shows you as the owner with an empty invite slot.
export async function openMembersMenu(player) {
  const form = new ActionFormData()
    .title(SCREEN.members + "NO CLAN YET")
    .body(`${player.name}\n§7Owner · preview`)
    .button(`${cardName(player.name)}\n§aOnline`, ART + "member_owner") // 0 owner card
    .button("Invite\n§7Coming soon", ART + "member_invite") // 1 invite card
    .button("§lDISBAND CLAN") // 2 red button
    .button("Back"); // 3 back arrow

  const res = await show(player, form);
  if (!res || res.canceled || res.selection === undefined) return;

  switch (res.selection) {
    case 0:
      player.sendMessage("§b[SkyClans] §7That's you - the clan owner.");
      return openMembersMenu(player);
    case 1:
      comingSoon(player, "Invite");
      return openMembersMenu(player);
    case 2:
      comingSoon(player, "Disband clan");
      return openMembersMenu(player);
    case 3:
      return openMainMenu(player);
  }
}
