import { generateWeapon } from "./weapon-gen.ts";

export interface GenerateLootInput {
  tier: number;
  enemy_type?: string;
  db?: any;
}

export interface LootItemEntry {
  type: "currency" | "material" | "item" | "weapon";
  name: string;
  quantity: number;
  rarity?: string;
}

export interface LootRollRecord {
  category: string;
  success: boolean;
  detail?: string;
}

export interface GenerateLootResult {
  items: LootItemEntry[];
  rolls: LootRollRecord[];
  tier: number;
}

const RARITY_TABLE: Record<number, { rarity: string; chance: number }[]> = {
  1: [
    { rarity: "common", chance: 0.60 },
    { rarity: "uncommon", chance: 0.30 },
    { rarity: "rare", chance: 0.08 },
    { rarity: "legendary", chance: 0.02 },
  ],
  2: [
    { rarity: "common", chance: 0.60 },
    { rarity: "uncommon", chance: 0.30 },
    { rarity: "rare", chance: 0.08 },
    { rarity: "legendary", chance: 0.02 },
  ],
  3: [
    { rarity: "common", chance: 0.20 },
    { rarity: "uncommon", chance: 0.40 },
    { rarity: "rare", chance: 0.30 },
    { rarity: "legendary", chance: 0.10 },
  ],
  4: [
    { rarity: "common", chance: 0.05 },
    { rarity: "uncommon", chance: 0.20 },
    { rarity: "rare", chance: 0.40 },
    { rarity: "legendary", chance: 0.35 },
  ],
  5: [
    { rarity: "common", chance: 0.05 },
    { rarity: "uncommon", chance: 0.20 },
    { rarity: "rare", chance: 0.40 },
    { rarity: "legendary", chance: 0.35 },
  ],
};

const DEFAULT_MATERIALS = ["废铁", "布料", "螺栓", "玻璃"];
const DEFAULT_ITEMS = ["治疗粉", "净水", "罐头"];

function rollBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function rollRarity(tier: number): { rarity: string; success: boolean } {
  const table = RARITY_TABLE[tier] || RARITY_TABLE[1];
  const roll = Math.random();
  let cumulative = 0;
  for (const entry of table) {
    cumulative += entry.chance;
    if (roll < cumulative) {
      return { rarity: entry.rarity, success: true };
    }
  }
  return { rarity: "common", success: true };
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateLoot(input: GenerateLootInput): GenerateLootResult {
  const { tier } = input;
  const items: LootItemEntry[] = [];
  const rolls: LootRollRecord[] = [];

  // 1. Currency (always)
  const currencyAmount = tier * 2 + rollBetween(0, tier * 3);
  items.push({ type: "currency", name: "瓶盖", quantity: currencyAmount });
  rolls.push({ category: "currency", success: true, detail: `${currencyAmount} caps` });

  // 2. Materials (概率随 tier 增加)
  const materialChance = 0.5 + tier * 0.08;
  if (Math.random() < materialChance) {
    const matQty = rollBetween(1, tier + 1);
    const matName = pickRandom(DEFAULT_MATERIALS);
    items.push({ type: "material", name: matName, quantity: matQty });
    rolls.push({ category: "material", success: true, detail: `${matName} ×${matQty}` });
  } else {
    rolls.push({ category: "material", success: false });
  }

  // 3. Items (概率随 tier 增加)
  const itemChance = 0.2 + tier * 0.1;
  if (Math.random() < itemChance) {
    const itemName = pickRandom(DEFAULT_ITEMS);
    items.push({ type: "item", name: itemName, quantity: 1 });
    rolls.push({ category: "item", success: true, detail: `${itemName} ×1` });
  } else {
    rolls.push({ category: "item", success: false });
  }

  // 4. Weapon (概率随 tier 增加，带稀有度表)
  const weaponChance = 0.1 + tier * 0.1;
  if (Math.random() < weaponChance) {
    const rarityResult = rollRarity(tier);
    const weapon = generateWeapon({
      min_rarity: rarityResult.rarity,
      max_rarity: rarityResult.rarity,
      tier: tier,
    });
    items.push({
      type: "weapon",
      name: weapon.weapon.name || `${rarityResult.rarity} weapon (tier ${tier})`,
      quantity: 1,
      rarity: rarityResult.rarity,
    });
    rolls.push({ category: "weapon", success: true, detail: `${rarityResult.rarity}: ${weapon.weapon.name || "unnamed"}` });
  } else {
    rolls.push({ category: "weapon", success: false });
  }

  return { items, rolls, tier };
}
