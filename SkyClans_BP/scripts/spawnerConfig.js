// ============================================================================
//  SPAWNERS - which mobs, prices and how they behave.
//  Same values as the Skyblock Economy spawners.
// ============================================================================

const HEAD = "textures/items/heads/";

// { mob, name, price }  - mob = vanilla entity name (without "minecraft:")
export const SPAWNERS = [
  { mob: "pig", name: "Pig", price: 15000 },
  { mob: "chicken", name: "Chicken", price: 15000 },
  { mob: "sheep", name: "Sheep", price: 15000 },
  { mob: "rabbit", name: "Rabbit", price: 15000 },
  { mob: "cow", name: "Cow", price: 20000 },
  { mob: "zombie", name: "Zombie", price: 25000 },
  { mob: "skeleton", name: "Skeleton", price: 30000 },
  { mob: "spider", name: "Spider", price: 30000 },
  { mob: "creeper", name: "Creeper", price: 45000 },
  { mob: "slime", name: "Slime", price: 50000 },
  { mob: "witch", name: "Witch", price: 60000 },
  { mob: "magma_cube", name: "Magma Cube", price: 60000 },
  { mob: "zombie_pigman", name: "Zombified Piglin", price: 80000 },
  { mob: "blaze", name: "Blaze", price: 100000 },
  { mob: "ghast", name: "Ghast", price: 150000 },
  { mob: "wither_skeleton", name: "Wither Skeleton", price: 200000 },
  { mob: "iron_golem", name: "Iron Golem", price: 250000 },
].map((s) => ({ icon: HEAD + s.mob, ...s }));

// Mobs from spawners can drop an "Enchanted <Mob> Head". Adding heads (in the
// spawner menu) puts them on that mob's head balance, which pays for upgrades
// of that mob's spawners. Upgrade cost = cost x stack size.
export const SPAWNER_SETTINGS = {
  maxStack: 16, // spawners that can be stacked into one block
  mobsPerSpawn: 1, // mobs spawned per spawner in the stack, each cycle
  activationRange: 24, // a player must be this close for a spawner to run
  stackMobs: true, // merge spawned mobs into one mob with a counter
  maxMobStack: 0, // most mobs one stacked mob can hold (0 = no limit)
  freezeMobs: true, // spawner mobs stand still (and don't burn in daylight)
  harmlessMobs: true, // spawner mobs can't hurt anyone: no melee, no shooting/throwing, creepers never explode
  mergeRadius: 8, // how close a stacked mob must be to the spawner to merge
  maxLooseMobs: 12, // if stackMobs is false: most loose mobs per spawner
  costTimesStack: true, // upgrade cost x stack size (stops upgrade-then-stack tricks)

  // Level 1 is what a new spawner starts at.
  //   interval   = seconds between spawns
  //   headChance = % chance a killed mob drops an enchanted head
  //   cost       = heads needed to reach this level (x the stack size)
  levels: [
    { interval: 20, headChance: 10, cost: 0 },
    { interval: 18, headChance: 11, cost: 5 },
    { interval: 16, headChance: 12, cost: 10 },
    { interval: 14, headChance: 13.5, cost: 20 },
    { interval: 12, headChance: 15, cost: 35 },
    { interval: 10, headChance: 16.5, cost: 55 },
    { interval: 9, headChance: 18, cost: 80 },
    { interval: 8, headChance: 20, cost: 110 },
    { interval: 7, headChance: 22.5, cost: 150 },
    { interval: 6, headChance: 25, cost: 200 },
  ],
};
