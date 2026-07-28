import { generateAccessorySeed } from "./legendary-gen.ts";

export interface GenerateAccessoryInput {
  accessory_type?: string;  // ring/amulet/trinket/charm (random if omitted)
  min_rarity?: string;
  max_rarity?: string;
  tier?: number;
}

export interface GeneratedAccessory {
  name: string;
  accessory_type: string;
  rarity: string;
  tier: number;
  value: number;
  description: string;
  legendary_effect?: {
    effect_name: string;
    trigger: string;
    effect_type: string;
    magnitude: number;
    description: string;
  };
}

export interface GenerateAccessoryResult {
  success: boolean;
  accessory: GeneratedAccessory;
  appropriateness_warnings?: string[];
}

const RARITIES = ["common", "uncommon", "rare", "legendary"];
const ACCESSORY_TYPES = ["ring", "amulet", "trinket", "charm"];

// Rarity weights by tier (index 0 = tier 1):
// tier 1-2: 60/30/8/2, tier 3: 20/40/30/10, tier 4-5: 5/20/40/35
const RARITY_WEIGHTS_BY_TIER: number[][] = [
  [60, 30, 8, 2],
  [60, 30, 8, 2],
  [20, 40, 30, 10],
  [5, 20, 40, 35],
  [5, 20, 40, 35],
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rollBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function rollRarity(minRarity: string, maxRarity: string, tier?: number): string {
  const minIdx = RARITIES.indexOf(minRarity);
  const maxIdx = RARITIES.indexOf(maxRarity);
  if (minIdx === -1) throw new Error(`Invalid min_rarity: "${minRarity}". Must be one of: ${RARITIES.join(", ")}`);
  if (maxIdx === -1) throw new Error(`Invalid max_rarity: "${maxRarity}". Must be one of: ${RARITIES.join(", ")}`);
  if (minIdx > maxIdx) throw new Error(`min_rarity "${minRarity}" cannot exceed max_rarity "${maxRarity}"`);
  const weights = RARITY_WEIGHTS_BY_TIER[Math.min(Math.max((tier ?? 1) - 1, 0), RARITY_WEIGHTS_BY_TIER.length - 1)];
  let total = 0;
  for (let i = minIdx; i <= maxIdx; i++) total += weights[i];
  let roll = Math.random() * total;
  for (let i = minIdx; i <= maxIdx; i++) {
    roll -= weights[i];
    if (roll < 0) return RARITIES[i];
  }
  return RARITIES[maxIdx];
}

export function generateAccessory(input: GenerateAccessoryInput): GenerateAccessoryResult {
  const accessoryType = input.accessory_type || pick(ACCESSORY_TYPES);
  const minRarity = input.min_rarity || "common";
  const maxRarity = input.max_rarity || "legendary";

  const rarity = rollRarity(minRarity, maxRarity, input.tier);
  const tier = input.tier || (RARITIES.indexOf(rarity) + 1);
  const value = (RARITIES.indexOf(rarity) + 1) * rollBetween(10, 30);

  // Legendary effect — no inappropriate trigger/effect combos known for accessories
  let legendaryEffect: GeneratedAccessory["legendary_effect"];
  if (rarity === "legendary") {
    const seed = generateAccessorySeed();
    const mag = Math.round((seed.magnitude_min + Math.random() * (seed.magnitude_max - seed.magnitude_min)) * 10) / 10;
    legendaryEffect = {
      effect_name: "",   // LLM fills
      trigger: seed.trigger,
      effect_type: seed.effect_type,
      magnitude: mag,
      description: "",   // LLM fills
    };
  }

  const accessory: GeneratedAccessory = {
    name: generateAccessoryName(accessoryType, rarity),
    accessory_type: accessoryType,
    rarity,
    tier,
    value,
    description: `一个${rarity === "common" ? "" : rarity === "uncommon" ? "精良的" : rarity === "rare" ? "稀有的" : "传说的"}${accessoryType}饰品。`,
    legendary_effect: legendaryEffect,
  };

  return {
    success: true,
    accessory,
  };
}

// ── 饰品命名池 ──
const ACCESSORY_NOUNS: Record<string, string[]> = {
  ring: ["戒指", "指环", "环"],
  amulet: ["项链", "吊坠", "护符", "挂链"],
  trinket: ["徽章", "勋章", "硬币", "钥匙", "齿轮"],
  charm: ["符咒", "护身符", "坠饰", "骨雕", "水晶"],
};

const ACCESSORY_RARITY_PREFIXES: Record<string, string[]> = {
  common: ["褪色的", "磨损的", "普通的", "简陋的"],
  uncommon: ["闪亮的", "完好的", "精致的", "古老的"],
  rare: ["神秘的", "战前科技", "能量", "暗金"],
  legendary: ["永恒", "灵魂", "命运", "虚空", "神谕"],
};

function generateAccessoryName(accessoryType: string, rarity: string): string {
  const nouns = ACCESSORY_NOUNS[accessoryType] || ["饰品"];
  const prefixes = ACCESSORY_RARITY_PREFIXES[rarity] || [""];
  const hash = accessoryType.length + rarity.length;
  const noun = nouns[hash % nouns.length];
  const prefix = prefixes[hash % prefixes.length];
  return prefix ? `${prefix}${noun}` : noun;
}
