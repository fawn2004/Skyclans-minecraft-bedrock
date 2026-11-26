import { world } from "@minecraft/server";

// ============================================================================
//  MONEY - every player's wallet.
//  Saved on the player (dynamic property "skyclans:money"), so it only changes
//  while they're online. Whole dollars only.
// ============================================================================

const KEY = "skyclans:money";

export function getBalance(player) {
  return Number(player.getDynamicProperty(KEY) ?? 0);
}

export function setBalance(player, amount) {
  player.setDynamicProperty(KEY, Math.max(0, Math.floor(amount)));
}

export function addMoney(player, amount) {
  setBalance(player, getBalance(player) + amount);
}

/** Takes money if they have enough. -> true if paid */
export function takeMoney(player, amount) {
  const have = getBalance(player);
  if (have < amount) return false;
  setBalance(player, have - amount);
  return true;
}

/** Money as shown everywhere: short, e.g. $950, $5K, $12.5K, $100K, $1.5M, $5M, $2.4B */
export function fmt(n) {
  return fmtShort(n);
}

/** Exact amount with commas, e.g. $1,234,567 (used where the exact number matters, like /bal) */
export function fmtExact(n) {
  return "$" + String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** $950, $12.5K, $2.4M, $1.2B (rounded down to one decimal, so you never see more than you have) */
export function fmtShort(n) {
  const units = [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ];
  for (const [size, unit] of units) {
    if (n >= size) return "$" + (Math.floor((n / size) * 10) / 10).toString() + unit;
  }
  return "$" + Math.floor(n);
}

/** Online player by name (case doesn't matter). */
export function findPlayer(name) {
  const lower = name.toLowerCase();
  return world.getAllPlayers().find((p) => p.name.toLowerCase() === lower);
}
