import { world } from "@minecraft/server";

// ============================================================================
//  CLANS - who's in which clan, ranks, invites, the clan bank, and island plots.
//
//  Each clan is saved in a world dynamic property "skyclans:clan:<id>" (JSON):
//    { id, name, created, bank,
//      members: { <playerId>: { name, rank: "owner"|"co"|"member", joined } },
//      island:  { index, cx, cz, size, built, home: { x, y, z } } }
//  Each player remembers their clan id ("skyclans:clan" on the player); it's
//  double-checked against the clan's member list, so kicks / disbands made while
//  someone was offline still count.
// ============================================================================

export const MAX_MEMBERS = 5;

// Island plots: centres go diagonally 10000/10000, 10700/10700, 11400/11400 ...
// SPACING 700 = biggest size (300) + a 400 block gap, so even maxed-out islands stay well apart.
export const ISLAND = {
  first: 10000,
  spacing: 700,
  size: 150, // every island is 150 x 150 (no size upgrades)
  y: 64, // height of the island's grass
};

export const RANKS = { owner: "Owner", co: "Co-owner", member: "Member" };

// What each rank can do (matches the WHO CAN DO WHAT table on the Members screen)
const CAN = {
  invite: ["owner", "co"],
  kick: ["owner", "co"],
  promote: ["owner", "co"],
  withdraw: ["owner", "co"],
  transfer: ["owner"],
  deposit: ["owner", "co", "member"],
  sethome: ["owner", "co"],
};

const PREFIX = "skyclans:clan:";
const clans = new Map(); // id -> clan

function save(c) {
  clans.set(c.id, c);
  world.setDynamicProperty(PREFIX + c.id, JSON.stringify(c));
}

/** Saves a clan after changing it elsewhere (upgrades, upkeep, island jobs). */
export const saveClan = save;

export function loadClans() {
  clans.clear();
  for (const key of world.getDynamicPropertyIds()) {
    if (!key.startsWith(PREFIX)) continue;
    try {
      const c = JSON.parse(String(world.getDynamicProperty(key)));
      clans.set(c.id, c);
    } catch {}
  }
}

export const allClans = () => [...clans.values()];
export const clanById = (id) => clans.get(id);
export const clanByName = (name) => allClans().find((c) => c.name.toLowerCase() === String(name).trim().toLowerCase());

/** The player's clan, or undefined. */
export function clanOf(player) {
  const id = player.getDynamicProperty("skyclans:clan");
  const c = typeof id === "string" ? clans.get(id) : undefined;
  if (c && c.members[player.id]) {
    if (c.members[player.id].name !== player.name) {
      c.members[player.id].name = player.name; // name changed
      save(c);
    }
    return c;
  }
  if (id !== undefined) player.setDynamicProperty("skyclans:clan", undefined); // stale (kicked / disbanded)
  return undefined;
}

export const rankOf = (clan, playerId) => clan?.members[playerId]?.rank;
export const can = (clan, playerId, action) => CAN[action]?.includes(rankOf(clan, playerId)) ?? false;
export const memberCount = (clan) => Object.keys(clan.members).length;

/** Members sorted owner, co-owners, members (oldest first). [{ id, name, rank, joined }] */
export function membersOf(clan) {
  const order = { owner: 0, co: 1, member: 2 };
  return Object.entries(clan.members)
    .map(([id, m]) => ({ id, ...m }))
    .sort((a, b) => order[a.rank] - order[b.rank] || a.joined - b.joined);
}

export function onlineMembers(clan) {
  return world.getAllPlayers().filter((p) => clan.members[p.id]);
}

// ---- island plots --------------------------------------------------------------------
function nextIslandIndex() {
  const n = Number(world.getDynamicProperty("skyclans:nextIsland") ?? 0);
  world.setDynamicProperty("skyclans:nextIsland", n + 1);
  return n;
}

export const islandCentre = (index) => ISLAND.first + index * ISLAND.spacing;

/** The clan whose plot contains x,z (inside its current size), or undefined. */
export function plotAt(x, z) {
  // checks each island's own saved centre, so islands made with an older spacing still work
  for (const c of clans.values()) {
    const is = c.island;
    if (!is) continue;
    const half = is.size / 2;
    if (x >= is.cx - half && x < is.cx + half && z >= is.cz - half && z < is.cz + half) return c;
  }
  return undefined;
}

/** True for anywhere in the island area (plots and the gaps between them). */
export const inIslandZone = (x, z) => x >= ISLAND.first - 250 && z >= ISLAND.first - 250;

// ---- clan actions (each returns an error message, or undefined if it worked) -----------
const NAME_OK = /^[A-Za-z0-9 ]{3,16}$/;

/** -> { clan } or { error } */
export function createClan(player, name) {
  name = String(name ?? "").trim().replace(/\s+/g, " ");
  if (clanOf(player)) return { error: "You're already in a clan." };
  if (!NAME_OK.test(name)) return { error: "Clan names are 3-16 letters, numbers or spaces." };
  if (clanByName(name)) return { error: `There's already a clan called ${name}.` };
  const index = nextIslandIndex();
  const centre = islandCentre(index);
  const id = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  const clan = {
    id,
    name,
    created: Date.now(),
    bank: 0,
    members: { [player.id]: { name: player.name, rank: "owner", joined: Date.now() } },
    island: { index, cx: centre, cz: centre, size: ISLAND.size, built: false, home: { x: centre, y: ISLAND.y + 1, z: centre + 3 } }, // in front of the core
  };
  save(clan);
  player.setDynamicProperty("skyclans:clan", id);
  return { clan };
}

export function markIslandBuilt(clan) {
  clan.island.built = true;
  save(clan);
}

// invites: target player id -> [{ clanId, from, until }]
const invites = new Map();
const INVITE_MS = 5 * 60 * 1000;

export function invitesFor(playerId) {
  const now = Date.now();
  const list = (invites.get(playerId) ?? []).filter((i) => i.until > now && clans.has(i.clanId));
  invites.set(playerId, list);
  return list;
}

export function invite(player, target) {
  const clan = clanOf(player);
  if (!clan) return "You're not in a clan.";
  if (!can(clan, player.id, "invite")) return "Only the owner and co-owners can invite.";
  if (target.id === player.id) return "You can't invite yourself.";
  if (clanOf(target)) return `${target.name} is already in a clan.`;
  if (memberCount(clan) >= MAX_MEMBERS) return `Your clan is full (${MAX_MEMBERS} max).`;
  const list = invitesFor(target.id).filter((i) => i.clanId !== clan.id);
  list.push({ clanId: clan.id, from: player.name, until: Date.now() + INVITE_MS });
  invites.set(target.id, list);
}

export function join(player, clanName) {
  if (clanOf(player)) return "You're already in a clan.";
  const clan = clanByName(clanName);
  if (!clan) return `There's no clan called ${clanName}.`;
  if (!invitesFor(player.id).some((i) => i.clanId === clan.id)) return `You don't have an invite from ${clan.name}.`;
  if (memberCount(clan) >= MAX_MEMBERS) return `${clan.name} is full.`;
  clan.members[player.id] = { name: player.name, rank: "member", joined: Date.now() };
  save(clan);
  player.setDynamicProperty("skyclans:clan", clan.id);
  invites.delete(player.id);
}

export function leave(player) {
  const clan = clanOf(player);
  if (!clan) return "You're not in a clan.";
  if (rankOf(clan, player.id) === "owner") return "Owners can't leave - make someone else owner (/is transfer) or disband the clan.";
  delete clan.members[player.id];
  save(clan);
  player.setDynamicProperty("skyclans:clan", undefined);
}

export function kick(player, targetId) {
  const clan = clanOf(player);
  if (!clan) return "You're not in a clan.";
  const target = clan.members[targetId];
  if (!target) return "They're not in your clan.";
  if (targetId === player.id) return "You can't kick yourself - leave instead.";
  if (!can(clan, player.id, "kick")) return "Only the owner and co-owners can kick.";
  if (target.rank === "owner") return "You can't kick the owner.";
  if (target.rank === "co" && rankOf(clan, player.id) !== "owner") return "Only the owner can kick a co-owner.";
  delete clan.members[targetId];
  save(clan);
}

export function promote(player, targetId) {
  const clan = clanOf(player);
  if (!clan) return "You're not in a clan.";
  const target = clan.members[targetId];
  if (!target) return "They're not in your clan.";
  if (!can(clan, player.id, "promote")) return "Only the owner and co-owners can promote.";
  if (target.rank !== "member") return `${target.name} is already ${RANKS[target.rank]}.`;
  target.rank = "co";
  save(clan);
}

export function demote(player, targetId) {
  const clan = clanOf(player);
  if (!clan) return "You're not in a clan.";
  const target = clan.members[targetId];
  if (!target) return "They're not in your clan.";
  if (rankOf(clan, player.id) !== "owner") return "Only the owner can demote.";
  if (target.rank !== "co") return `${target.name} isn't a co-owner.`;
  target.rank = "member";
  save(clan);
}

export function transfer(player, targetId) {
  const clan = clanOf(player);
  if (!clan) return "You're not in a clan.";
  const target = clan.members[targetId];
  if (!target) return "They're not in your clan.";
  if (!can(clan, player.id, "transfer")) return "Only the owner can hand over the clan.";
  if (targetId === player.id) return "You're already the owner.";
  clan.members[player.id].rank = "co";
  target.rank = "owner";
  save(clan);
}

/** Deletes the clan. The island stays where it is (its plot isn't reused). */
export function disband(player) {
  const clan = clanOf(player);
  if (!clan) return "You're not in a clan.";
  if (rankOf(clan, player.id) !== "owner") return "Only the owner can disband the clan.";
  clans.delete(clan.id);
  world.setDynamicProperty(PREFIX + clan.id, undefined);
  for (const p of onlineMembers(clan)) p.setDynamicProperty("skyclans:clan", undefined);
}

export function setHome(player) {
  const clan = clanOf(player);
  if (!clan) return "You're not in a clan.";
  if (!can(clan, player.id, "sethome")) return "Only the owner and co-owners can set the island home.";
  const l = player.location;
  if (player.dimension.id !== "minecraft:overworld" || plotAt(l.x, l.z)?.id !== clan.id) return "Stand on your island to set its home.";
  clan.island.home = { x: Math.floor(l.x), y: Math.floor(l.y), z: Math.floor(l.z) };
  save(clan);
}

// ---- clan bank ----------------------------------------------------------------------------
export function deposit(player, amount, takeMoney) {
  const clan = clanOf(player);
  if (!clan) return "You're not in a clan.";
  if (!(amount > 0)) return "The amount must be more than 0.";
  if (!takeMoney(player, amount)) return "You don't have that much.";
  clan.bank += amount;
  save(clan);
}

export function withdraw(player, amount, addMoney) {
  const clan = clanOf(player);
  if (!clan) return "You're not in a clan.";
  if (!can(clan, player.id, "withdraw")) return "Only the owner and co-owners can withdraw.";
  if (!(amount > 0)) return "The amount must be more than 0.";
  if (clan.bank < amount) return "The clan bank doesn't have that much.";
  clan.bank -= amount;
  save(clan);
  addMoney(player, amount);
}
