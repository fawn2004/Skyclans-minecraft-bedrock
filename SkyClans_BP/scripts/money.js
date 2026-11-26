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
  const bal = Math.max(0, Math.floor(amount));
  player.setDynamicProperty(KEY, bal);
  rememberBalance(player, bal);
}

// ---- balance top (/baltop) --------------------------------------------------------
// The richest players are also kept in one world property, so /baltop can show
// players who are offline. Only the top TOP_KEEP are stored.
const TOP_KEY = "skyclans:baltop";
const TOP_KEEP = 50;

function readTop() {
  try {
    return JSON.parse(String(world.getDynamicProperty(TOP_KEY) ?? "{}"));
  } catch {
    return {};
  }
}

function rememberBalance(player, bal) {
  const top = readTop(); // id -> [name, balance]
  top[player.id] = [player.name, bal];
  const kept = Object.entries(top)
    .sort((a, b) => b[1][1] - a[1][1])
    .slice(0, TOP_KEEP);
  world.setDynamicProperty(TOP_KEY, JSON.stringify(Object.fromEntries(kept)));
}

/** [{ name, balance }] richest first (online players use their live balance). */
export function topBalances(count = 10) {
  const top = readTop();
  for (const p of world.getAllPlayers()) top[p.id] = [p.name, getBalance(p)];
  return Object.values(top)
    .map(([name, balance]) => ({ name, balance }))
    .sort((a, b) => b.balance - a.balance)
    .slice(0, count);
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
