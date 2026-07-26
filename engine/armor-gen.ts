import { generateArmorSeed } from "./legendary-gen.ts";

export interface GenerateArmorInput {
  slot?: string;           // head/chest/legs (random if omitted)
  min_rarity?: string;
  max_rarity?: string;
  tier?: number;
}

export interface GeneratedArmor {
  name: string;
  slot: string;
  defense: number;
  rarity: string;
  tier: number;
  weight: number;
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

export interface GenerateArmorResult {
  success: boolean;
  armor: GeneratedArmor;
  appropriateness_warnings?: string[];
}

const RARITIES = ["common", "uncommon", "rare", "legendary"];
const ARMOR_SLOTS = ["head", "chest", "legs"];

// Defense ranges by rarity
const DEFENSE_BY_RARITY: Record<string, { min: number; max: number }> = {
  common: { min: 3, max: 8 },
  uncommon: { min: 8, max: 15 },
  rare: { min: 15, max: 25 },
  legendary: { min: 26, max: 38 },
};

// Rarity weights by tier (index 0 = tier 1):
// tier 1-2: 60/30/8/2, tier 3: 20/40/30/10, tier 4-5: 5/20/40/35
const RARITY_WEIGHTS_BY_TIER: number[][] = [
  [60, 30, 8, 2],
  [60, 30, 8, 2],
  [20, 40, 30, 10],
  [5, 20, 40, 35],
  [5, 20, 40, 35],
];

// Weight (kg) ranges by slot
const WEIGHT_BY_SLOT: Record<string, { min: number; max: number }> = {
  head: { min: 1, max: 2 },
  chest: { min: 3, max: 6 },
  legs: { min: 2, max: 4 },
};

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

function checkArmorWarnings(trigger: string, defense: number): string[] {
  const warnings: string[] = [];
  if (trigger === "on_dodged" && defense > 20) {
    warnings.push("闪避类触发器对重甲意义不大");
  }
  return warnings;
}

export function generateArmor(input: GenerateArmorInput): GenerateArmorResult {
  const slot = input.slot || pick(ARMOR_SLOTS);
  const minRarity = input.min_rarity || "common";
  const maxRarity = input.max_rarity || "legendary";

  const rarity = rollRarity(minRarity, maxRarity, input.tier);
  const tier = input.tier || (RARITIES.indexOf(rarity) + 1);

  const defRange = DEFENSE_BY_RARITY[rarity];
  const defense = rollBetween(defRange.min, defRange.max);
  let weightRange = WEIGHT_BY_SLOT[slot];
  if (!weightRange) {
    console.warn(`Unknown armor slot "${slot}", falling back to "chest"`);
    weightRange = WEIGHT_BY_SLOT.chest;
  }
  const weight = rollBetween(weightRange.min, weightRange.max);
  const value = (RARITIES.indexOf(rarity) + 1) * defense * 3;

  // Legendary effect
  let legendaryEffect: GeneratedArmor["legendary_effect"];
  let appropriatenessWarnings: string[] | undefined;
  if (rarity === "legendary") {
    const seed = generateArmorSeed();
    // Float roll in [min, max] — some ranges (e.g. damage_reduction 0.1–0.4) are sub-1
    const mag = Math.round((seed.magnitude_min + Math.random() * (seed.magnitude_max - seed.magnitude_min)) * 10) / 10;
    legendaryEffect = {
      effect_name: "",   // LLM fills
      trigger: seed.trigger,
      effect_type: seed.effect_type,
      magnitude: mag,
      description: "",   // LLM fills
    };
    const warnings = checkArmorWarnings(seed.trigger, defense);
    if (warnings.length > 0) {
      appropriatenessWarnings = warnings;
    }
  }

  const armor: GeneratedArmor = {
    name: "",            // LLM fills
    slot,
    defense,
    rarity,
    tier,
    weight,
    value,
    description: "",     // LLM fills
    legendary_effect: legendaryEffect,
  };

  return {
    success: true,
    armor,
    appropriateness_warnings: appropriatenessWarnings,
  };
}
