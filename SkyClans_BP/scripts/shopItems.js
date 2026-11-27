// ============================================================================
//  SHOP ITEMS - everything the Sky Shop sells (spawners and kits are separate).
//  Each line:  item("Name", "game id", price for ONE, "icon picture")
//  Add  , 12  after the icon to set a sell price; otherwise it sells for half
//  the buy price. Edit freely - the shop picks changes up after /reload.
// ============================================================================

const B = "textures/blocks/";
const I = "textures/items/";

export const item = (name, id, price, icon, sell) => ({
  name,
  id: id.includes(":") ? id : `minecraft:${id}`,
  price,
  icon,
  ...(sell !== undefined ? { sell } : {}),
});

// ---- Blocks > Wood ----------------------------------------------------------------
export const WOOD = [
  item("Oak Log", "oak_log", 8, B + "log_oak"),
  item("Spruce Log", "spruce_log", 8, B + "log_spruce"),
  item("Birch Log", "birch_log", 8, B + "log_birch"),
  item("Jungle Log", "jungle_log", 8, B + "log_jungle"),
  item("Acacia Log", "acacia_log", 8, B + "log_acacia"),
  item("Dark Oak Log", "dark_oak_log", 8, B + "log_big_oak"),
  item("Mangrove Log", "mangrove_log", 10, B + "mangrove_log_side"),
  item("Poplar Log", "poplar_log", 10, B + "poplar_log_side"),
  item("Cherry Log", "cherry_log", 10, B + "cherry_log_side"),
  item("Pale Oak Log", "pale_oak_log", 10, B + "pale_oak_log_side"),
  item("Crimson Stem", "crimson_stem", 12, B + "huge_fungus/crimson_log_side"),
  item("Warped Stem", "warped_stem", 12, B + "huge_fungus/warped_stem_side"),
  item("Oak Leaves", "oak_leaves", 3, B + "leaves_oak_carried"),
  item("Spruce Leaves", "spruce_leaves", 3, B + "leaves_spruce_carried"),
  item("Birch Leaves", "birch_leaves", 3, B + "leaves_birch_carried"),
  item("Acacia Leaves", "acacia_leaves", 3, B + "leaves_acacia_carried"),
  item("Azalea Leaves", "azalea_leaves", 5, B + "azalea_leaves"),
  item("Flowering Azalea Leaves", "azalea_leaves_flowered", 6, B + "azalea_leaves_flowers"),
];

// ---- Blocks > Lights ----------------------------------------------------------------
export const LIGHTS = [
  item("Glowstone", "glowstone", 40, B + "glowstone"),
  item("Sea Lantern", "sea_lantern", 60, B + "sea_lantern"),
  item("Pearlescent Froglight", "pearlescent_froglight", 80, B + "pearlescent_froglight_side"),
  item("Verdant Froglight", "verdant_froglight", 80, B + "verdant_froglight_side"),
  item("Ochre Froglight", "ochre_froglight", 80, B + "ochre_froglight_side"),
  item("Lantern", "lantern", 50, I + "lantern"),
  item("Soul Lantern", "soul_lantern", 55, I + "soul_lantern"),
];

// ---- Blocks > Blocks ----------------------------------------------------------------
export const BLOCKS = [
  item("Grass Block", "grass_block", 6, B + "grass_side_carried"),
  item("Podzol", "podzol", 10, B + "dirt_podzol_side"),
  item("Dirt", "dirt", 2, B + "dirt"),
  item("Coarse Dirt", "coarse_dirt", 3, B + "coarse_dirt"),
  item("Rooted Dirt", "dirt_with_roots", 5, B + "dirt_with_roots"),
  item("Stone Bricks", "stone_bricks", 4, B + "stonebrick"),
  item("Mossy Stone Bricks", "mossy_stone_bricks", 8, B + "stonebrick_mossy"),
  item("Cracked Stone Bricks", "cracked_stone_bricks", 6, B + "stonebrick_cracked"),
  item("Chiseled Stone Bricks", "chiseled_stone_bricks", 8, B + "stonebrick_carved"),
  item("Stone", "stone", 3, B + "stone"),
  item("Granite", "granite", 3, B + "stone_granite"),
  item("Diorite", "diorite", 3, B + "stone_diorite"),
  item("Andesite", "andesite", 3, B + "stone_andesite"),
  item("Blackstone", "blackstone", 6, B + "blackstone"),
  item("Deepslate", "deepslate", 5, B + "deepslate/deepslate"),
  item("Tuff", "tuff", 5, B + "tuff"),
  item("Basalt", "basalt", 6, B + "basalt_side"),
  item("Smooth Basalt", "smooth_basalt", 8, B + "smooth_basalt"),
  item("Cinnabar", "cinnabar", 15, B + "cinnabar"),
  item("Smooth Stone", "smooth_stone", 5, B + "stone_slab_top"),
  item("Packed Mud", "packed_mud", 5, B + "packed_mud"),
  item("Sulfur", "sulfur", 15, B + "sulfur"),
  item("Potent Sulfur", "potent_sulfur", 30, B + "potent_sulfur"),
  item("Ice", "ice", 10, B + "ice"),
  item("Blue Ice", "blue_ice", 60, B + "blue_ice"),
  item("Obsidian", "obsidian", 50, B + "obsidian"),
  item("Mud Bricks", "mud_bricks", 5, B + "mud_bricks"),
  item("Block of Resin", "resin_block", 25, B + "resin_block"),
  item("Moss Block", "moss_block", 8, B + "moss_block"),
  item("Sand", "sand", 3, B + "sand"),
  item("Gravel", "gravel", 3, B + "gravel"),
  item("Mud", "mud", 3, B + "mud"),
  item("Clay", "clay", 8, B + "clay"),
  item("Chiseled Resin Bricks", "chiseled_resin_bricks", 30, B + "chiseled_resin_bricks"),
  item("Pale Moss Block", "pale_moss_block", 10, B + "pale_moss_block"),
];

// ---- Blocks > Coloured Blocks (one section per type) ----------------------------------
// [name, id prefix, picture name used by the game's textures]
const COLOURS = [
  ["White", "white", "white"],
  ["Orange", "orange", "orange"],
  ["Magenta", "magenta", "magenta"],
  ["Light Blue", "light_blue", "light_blue"],
  ["Yellow", "yellow", "yellow"],
  ["Lime", "lime", "lime"],
  ["Pink", "pink", "pink"],
  ["Gray", "gray", "gray"],
  ["Light Gray", "light_gray", "silver"],
  ["Cyan", "cyan", "cyan"],
  ["Purple", "purple", "purple"],
  ["Blue", "blue", "blue"],
  ["Brown", "brown", "brown"],
  ["Green", "green", "green"],
  ["Red", "red", "red"],
  ["Black", "black", "black"],
];
export const WOOL = COLOURS.map(([n, id, tex]) => item(`${n} Wool`, `${id}_wool`, 15, `${B}wool_colored_${tex}`));
export const TERRACOTTA = [
  item("Terracotta", "hardened_clay", 10, B + "hardened_clay"),
  ...COLOURS.map(([n, id, tex]) => item(`${n} Terracotta`, `${id}_terracotta`, 10, `${B}hardened_clay_stained_${tex}`)),
];
export const CONCRETE_POWDER = COLOURS.map(([n, id, tex]) => item(`${n} Concrete Powder`, `${id}_concrete_powder`, 12, `${B}concrete_powder_${tex}`));
export const CONCRETE = COLOURS.map(([n, id, tex]) => item(`${n} Concrete`, `${id}_concrete`, 15, `${B}concrete_${tex}`));

// ---- Redstone --------------------------------------------------------------------------
export const REDSTONE = [
  item("Observer", "observer", 60, B + "observer_front"),
  item("Repeater", "repeater", 25, I + "repeater"),
  item("Comparator", "comparator", 50, I + "comparator"),
  item("Hopper", "hopper", 150, I + "hopper"),
  item("Dropper", "dropper", 40, B + "dropper_front_horizontal"),
  item("Dispenser", "dispenser", 60, B + "dispenser_front_horizontal"),
  item("Crafter", "crafter", 250, B + "crafter_north"),
  item("Piston", "piston", 50, B + "piston_side"),
  item("Sticky Piston", "sticky_piston", 80, B + "piston_top_sticky"),
  item("Redstone", "redstone", 10, I + "redstone_dust"),
  item("Redstone Torch", "redstone_torch", 12, B + "redstone_torch_on"),
  item("Lever", "lever", 5, B + "lever"),
  item("Button", "stone_button", 3, B + "stone"),
  item("Pressure Plate", "stone_pressure_plate", 5, B + "stone"),
];

// ---- Food ------------------------------------------------------------------------------
export const FOOD = [
  item("Enchanted Golden Apple", "enchanted_golden_apple", 25000, I + "apple_golden"),
  item("Golden Apple", "golden_apple", 500, I + "apple_golden"),
  item("Apple", "apple", 10, I + "apple"),
  item("Golden Carrot", "golden_carrot", 60, I + "carrot_golden"),
  item("Cooked Chicken", "cooked_chicken", 12, I + "chicken_cooked"),
  item("Cooked Porkchop", "cooked_porkchop", 15, I + "porkchop_cooked"),
  item("Steak", "cooked_beef", 15, I + "beef_cooked"),
  item("Cooked Mutton", "cooked_mutton", 12, I + "mutton_cooked"),
  item("Cooked Rabbit", "cooked_rabbit", 12, I + "rabbit_cooked"),
  item("Cooked Cod", "cooked_cod", 10, I + "fish_cooked"),
  item("Cooked Salmon", "cooked_salmon", 12, I + "fish_salmon_cooked"),
  item("Bread", "bread", 8, I + "bread"),
];

// ---- Farming ---------------------------------------------------------------------------
export const FARMING = [
  item("Potato", "potato", 10, I + "potato"),
  item("Carrot", "carrot", 10, I + "carrot"),
  item("Sweet Berries", "sweet_berries", 15, I + "sweet_berries"),
  item("Sugar Cane", "sugar_cane", 20, I + "reeds"),
  item("Bamboo", "bamboo", 15, I + "bamboo"),
  item("Wheat Seeds", "wheat_seeds", 5, I + "seeds_wheat"),
  item("Pumpkin Seeds", "pumpkin_seeds", 25, I + "seeds_pumpkin"),
  item("Melon Seeds", "melon_seeds", 25, I + "seeds_melon"),
  item("Beetroot Seeds", "beetroot_seeds", 10, I + "seeds_beetroot"),
];

// ---- Ores ------------------------------------------------------------------------------
export const ORES = [
  item("Coal", "coal", 25, I + "coal"),
  item("Copper Ingot", "copper_ingot", 40, I + "copper_ingot"),
  item("Iron Ingot", "iron_ingot", 150, I + "iron_ingot"),
  item("Lapis Lazuli", "lapis_lazuli", 60, I + "dye_powder_blue_new"),
  item("Gold Ingot", "gold_ingot", 250, I + "gold_ingot"),
  item("Emerald", "emerald", 1500, I + "emerald"),
  item("Diamond", "diamond", 2500, I + "diamond"),
];

// ============================================================================
//  SELL LIST - the ONLY things the shop buys from players (Sell hand / Sell all).
//  sell(name, id, price for ONE, icon). Cents are fine (0.5 = 50 cents).
//  Rules these prices follow (keep to them when editing):
//   - anything the shop also SELLS: sell price x 3 (the biggest Sell Multiplier)
//     must stay below its buy price, so buying to sell back never makes money
//   - glowstone dust x 4 (most a block drops) x 3 stays below the glowstone block price
// ============================================================================
export const sell = (name, id, price, icon) => ({ name, id: id.includes(":") ? id : `minecraft:${id}`, sell: price, icon });

export const SELL = {
  Ores: [
    sell("Coal", "coal", 5, I + "coal"),
    sell("Raw Copper", "raw_copper", 5, I + "raw_copper"),
    sell("Copper Ingot", "copper_ingot", 8, I + "copper_ingot"),
    sell("Raw Iron", "raw_iron", 15, I + "raw_iron"),
    sell("Iron Ingot", "iron_ingot", 20, I + "iron_ingot"),
    sell("Raw Gold", "raw_gold", 30, I + "raw_gold"),
    sell("Gold Ingot", "gold_ingot", 40, I + "gold_ingot"),
    sell("Lapis Lazuli", "lapis_lazuli", 8, I + "dye_powder_blue_new"),
    sell("Redstone", "redstone", 2, I + "redstone_dust"),
    sell("Emerald", "emerald", 200, I + "emerald"),
    sell("Diamond", "diamond", 300, I + "diamond"),
  ],
  Farming: [
    sell("Wheat", "wheat", 2, I + "wheat"),
    sell("Beetroot", "beetroot", 2, I + "beetroot"),
    sell("Potato", "potato", 1, I + "potato"),
    sell("Carrot", "carrot", 1, I + "carrot"),
    sell("Sugar Cane", "sugar_cane", 2, I + "reeds"),
    sell("Bamboo", "bamboo", 0.5, I + "bamboo"),
    sell("Melon", "melon_block", 4, B + "melon_side"),
    sell("Melon Slice", "melon_slice", 0.5, I + "melon"),
    sell("Pumpkin", "pumpkin", 4, B + "pumpkin_side"),
    sell("Sweet Berries", "sweet_berries", 1, I + "sweet_berries"),
  ],
  "Mob Drops": [
    sell("Raw Chicken", "chicken", 2, I + "chicken_raw"),
    sell("Raw Porkchop", "porkchop", 3, I + "porkchop_raw"),
    sell("Raw Beef", "beef", 3, I + "beef_raw"),
    sell("Raw Mutton", "mutton", 2, I + "mutton_raw"),
    sell("Raw Rabbit", "rabbit", 2, I + "rabbit_raw"),
    sell("Egg", "egg", 1, I + "egg"),
    sell("Leather", "leather", 4, I + "leather"),
    sell("Feather", "feather", 1, I + "feather"),
    ...COLOURS.map(([n, id, tex]) => sell(`${n} Wool`, `${id}_wool`, 2, `${B}wool_colored_${tex}`)),
    sell("Rabbit's Foot", "rabbit_foot", 25, I + "rabbit_foot"),
    sell("Rabbit Hide", "rabbit_hide", 3, I + "rabbit_hide"),
    sell("Rotten Flesh", "rotten_flesh", 1, I + "rotten_flesh"),
    sell("Bone", "bone", 2, I + "bone"),
    sell("Arrow", "arrow", 1, I + "arrow"),
    sell("Spider Eye", "spider_eye", 4, I + "spider_eye"),
    sell("String", "string", 2, I + "string"),
    sell("Gunpowder", "gunpowder", 5, I + "gunpowder"),
    sell("Slimeball", "slime_ball", 6, I + "slimeball"),
    sell("Sugar", "sugar", 1, I + "sugar"),
    sell("Glowstone Dust", "glowstone_dust", 2, I + "glowstone_dust"),
    sell("Wither Skeleton Skull", "wither_skeleton_skull", 1500, I + "skull_wither"),
    sell("Blaze Rod", "blaze_rod", 40, I + "blaze_rod"),
  ],
  Blocks: [
    sell("Dirt", "dirt", 0.5, B + "dirt"),
    sell("Cobblestone", "cobblestone", 0.5, B + "cobblestone"),
    sell("Stone", "stone", 0.5, B + "stone"),
    sell("Granite", "granite", 0.5, B + "stone_granite"),
    sell("Diorite", "diorite", 0.5, B + "stone_diorite"),
    sell("Andesite", "andesite", 0.5, B + "stone_andesite"),
  ],
  // every log / stem the shop sells: 2 (8-buy logs) or 3 (10-12-buy logs)
  Wood: WOOD.filter((w) => !w.id.endsWith("leaves") && !w.id.includes("leaves")).map((w) =>
    sell(w.name, w.id, Math.ceil(w.price / 3) - 1, w.icon)
  ),
};
