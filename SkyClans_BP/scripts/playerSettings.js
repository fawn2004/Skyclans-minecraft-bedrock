import { system, world } from "@minecraft/server";

// ============================================================================
//  PLAYER SETTINGS - the four levers in Main menu > Settings.
//  Saved per player (dynamic property "skyclans:pref:<id>").
// ============================================================================

// Order = position on the Settings screen (top-left, top-right, bottom-left, bottom-right).
export const SETTINGS = [
  { id: "chunks", name: "Chunk Borders", desc: "Outline the chunk you are standing in.", art: "chunks", def: false },
  { id: "fullbright", name: "Full Bright", desc: "See clearly at night without torches.", art: "bright", def: false },
  { id: "raidAlert", name: "Raid Alert Sound", desc: "Warning sounds when a raid starts or ends.", art: "alert", def: true },
  { id: "coords", name: "Coordinates", desc: "Show X / Y / Z and facing on the action bar.", art: "coords", def: false },
];

export function pref(player, id) {
  const raw = player.getDynamicProperty(`skyclans:pref:${id}`);
  if (raw === undefined) return SETTINGS.find((s) => s.id === id)?.def ?? false;
  return raw === true;
}

export function setPref(player, id, on) {
  player.setDynamicProperty(`skyclans:pref:${id}`, !!on);
  if (id === "fullbright" && !on) {
    try {
      player.removeEffect("night_vision");
    } catch {}
  }
  if (id === "coords" && !on) {
    try {
      player.onScreenDisplay.setActionBar(" ");
    } catch {}
  }
}

// ---- chunk borders: glowing lines only that player sees ------------------------
function drawBorders(player) {
  const l = player.location;
  const x0 = Math.floor(l.x / 16) * 16, z0 = Math.floor(l.z / 16) * 16;
  const x1 = x0 + 16, z1 = z0 + 16;
  const y = Math.floor(l.y);
  const show = (x, yy, z) => {
    try {
      player.spawnParticle("minecraft:endrod", { x, y: yy, z });
    } catch {}
  };
  for (const yy of [y + 0.1, y + 1.6]) {
    for (let i = 0; i <= 16; i++) {
      show(x0 + i, yy, z0);
      show(x0 + i, yy, z1);
      show(x0, yy, z0 + i);
      show(x1, yy, z0 + i);
    }
  }
  for (let dy = -6; dy <= 8; dy++) {
    show(x0, y + dy, z0);
    show(x1, y + dy, z0);
    show(x0, y + dy, z1);
    show(x1, y + dy, z1);
  }
}

// ---- coordinates on the action bar -------------------------------------------------
const DIRS = ["S", "SW", "W", "NW", "N", "NE", "E", "SE"];

function showCoords(player) {
  const l = player.location;
  let facing = "";
  try {
    const yaw = ((player.getRotation().y % 360) + 360) % 360;
    facing = `  §7(${DIRS[Math.round(yaw / 45) % 8]})`;
  } catch {}
  const chunk = pref(player, "chunks") ? `   §bChunk §f${Math.floor(l.x / 16)}§7, §f${Math.floor(l.z / 16)}` : "";
  try {
    player.onScreenDisplay.setActionBar(`§7X §f${Math.floor(l.x)}  §7Y §f${Math.floor(l.y)}  §7Z §f${Math.floor(l.z)}${facing}${chunk}`);
  } catch {}
}

// ---- full bright: night vision that never runs out -----------------------------------
function fullBright(player) {
  try {
    const e = player.getEffect("night_vision");
    if (!e || e.duration < 300) player.addEffect("night_vision", 600, { amplifier: 0, showParticles: false });
  } catch {}
}

/** Raid alert: call this when raiders start bridging (raids aren't built yet). */
export function raidAlert(player) {
  if (!pref(player, "raidAlert")) return;
  try {
    player.playSound("raid.horn");
  } catch {}
}

export function registerPlayerSettings() {
  world.afterEvents.worldLoad.subscribe(() => {
    system.runInterval(() => {
      for (const p of world.getAllPlayers()) {
        try {
          if (pref(p, "chunks")) drawBorders(p);
          if (pref(p, "coords")) showCoords(p);
        } catch {}
      }
    }, 15);
    system.runInterval(() => {
      for (const p of world.getAllPlayers()) {
        try {
          if (pref(p, "fullbright")) fullBright(p);
        } catch {}
      }
    }, 100);
  });
}
