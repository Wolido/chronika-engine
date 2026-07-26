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
    name: "",            // LLM fills
    accessory_type: accessoryType,
    rarity,
    tier,
    value,
    description: "",     // LLM fills
    legendary_effect: legendaryEffect,
  };

  return {
    success: true,
    accessory,
  };
}
