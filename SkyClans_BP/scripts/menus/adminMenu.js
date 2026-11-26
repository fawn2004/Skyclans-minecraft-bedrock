import { ActionFormData } from "@minecraft/server-ui";
import { show } from "../forms.js";

// Placeholder: proves /admin works. The real admin menu gets built later.
export async function openAdminMenu(player) {
  const form = new ActionFormData()
    .title("SkyClans Admin")
    .body("The admin menu will be built here.\n\n/admin is working.")
    .button("Close");
  await show(player, form);
}
