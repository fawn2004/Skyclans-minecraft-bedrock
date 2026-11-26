import { SPAWNERS } from "../spawnerConfig.js";
import { comingSoon, success, tilePages } from "../forms.js";
import { giveSpawner } from "../spawners.js";

const ICON = "textures/ui/skyclans/";

// /admin (operators only). More tools get added here as features are built.
export function openAdminMenu(player) {
  return tilePages(player, {
    title: "ADMIN",
    body: "§7Operators only",
    tiles: [
      { text: "Give Spawner\n§7For testing", icon: "textures/blocks/mob_spawner", onClick: () => giveSpawnerMenu(player) },
      { text: "Settings\n§7Coming soon", icon: ICON + "head_settings", onClick: () => (comingSoon(player, "Admin settings"), openAdminMenu(player)) },
    ],
  });
}

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
      back: () => openAdminMenu(player),
    },
    page
  );
}
