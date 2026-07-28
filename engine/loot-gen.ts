/**
 * IMPORTANT: Math.random() call order is part of the test contract.
 * Item drop check MUST be the first Math.random() call (before the currency roll).
 * See tests/engine/loot-gen-accessory.test.ts for mock expectations.
 */
import { generateWeapon } from "./weapon-gen.ts";
import { generateArmor } from "./armor-gen.ts";
import { generateAccessory } from "./accessory-gen.ts";
import type { AccessoryData } from "./legendary-gen.ts";

export interface GenerateLootInput {
  tier: number;
  accessories?: AccessoryData[];
}

export type LootItemType = "currency" | "item" | "weapon" | "armor" | "accessory";

export interface LootItemEntry {
  type: LootItemType;
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
  accessory_loot_magnet_bonus?: number;
  accessory_ammo_scavenged?: number;
  accessory_double_loot_triggered?: boolean;
}

const RARITY_TABLE = [
  { rarity: "common", chance: 0.15 },
  { rarity: "uncommon", chance: 0.25 },
  { rarity: "rare", chance: 0.35 },
  { rarity: "legendary", chance: 0.25 },
];

const DEFAULT_ITEMS = ["治疗粉", "净水", "罐头"];

function rollBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function rollRarity(): { rarity: string } {
  const roll = Math.random();
  let cumulative = 0;
  for (const entry of RARITY_TABLE) {
    cumulative += entry.chance;
    if (roll < cumulative) {
      return { rarity: entry.rarity };
    }
  }
  return { rarity: "common" }; // Fallback for floating-point edge case
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateLoot(input: GenerateLootInput): GenerateLootResult {
  const { tier } = input;
  const items: LootItemEntry[] = [];
  const rolls: LootRollRecord[] = [];

  // 0. 饰品加成（on_loot / passive 触发器）
  let lootMagnetBonus = 0;
  let ammoScavengeChance = 0;
  let doubleLootChance = 0;
  for (const acc of input.accessories ?? []) {
    if (acc.trigger !== "on_loot" && acc.trigger !== "passive") continue;
    if (acc.effect_type === "loot_magnet") lootMagnetBonus += acc.magnitude;
    else if (acc.effect_type === "ammo_scavenge") ammoScavengeChance += acc.magnitude;
    else if (acc.effect_type === "double_loot") doubleLootChance += acc.magnitude;
  }
  // Clamp: 概率加成叠加不得超过 1.0
  ammoScavengeChance = Math.min(1, ammoScavengeChance);
  doubleLootChance = Math.min(1, doubleLootChance);

  // 1. Items (概率随 tier 增加，loot_magnet 叠加掉落概率)
  // 注意：物品 roll 必须是最早的 Math.random 调用（测试依赖此顺序）
  const itemChance = Math.min(1, 0.3 + tier * 0.12 + lootMagnetBonus);
  let itemDropped: string | undefined;
  if (Math.random() < itemChance) {
    itemDropped = pickRandom(DEFAULT_ITEMS);
  }

  // 2. Currency (always)
  const currencyAmount = tier * 2 + rollBetween(0, tier * 3);
  items.push({ type: "currency", name: "瓶盖", quantity: currencyAmount });
  rolls.push({ category: "currency", success: true, detail: `${currencyAmount} caps` });

  if (itemDropped) {
    items.push({ type: "item", name: itemDropped, quantity: 1 });
    rolls.push({ category: "item", success: true, detail: `${itemDropped} ×1` });
  } else {
    rolls.push({ category: "item", success: false });
  }

  // 3. ammo_scavenge：概率追加弹药
  let ammoScavenged: number | undefined;
  if (ammoScavengeChance > 0 && Math.random() < ammoScavengeChance) {
    ammoScavenged = Math.max(1, tier * 2);
    items.push({ type: "item", name: "弹药", quantity: ammoScavenged });
    rolls.push({ category: "item", success: true, detail: `弹药 ×${ammoScavenged} (scavenged)` });
  }

  // 4. double_loot：概率数量翻倍
  let doubleLootTriggered: boolean | undefined;
  if (doubleLootChance > 0 && Math.random() < doubleLootChance) {
    doubleLootTriggered = true;
    for (const item of items) {
      if (item.type !== "weapon") item.quantity *= 2;
    }
  }

  // 5. Weapon (70% chance)
  const WEAPON_CHANCE = 0.7;
  if (Math.random() < WEAPON_CHANCE) {
    const { rarity } = rollRarity();
    const weapon = generateWeapon({
      min_rarity: rarity,
      max_rarity: rarity,
      tier: tier,
    });
    items.push({
      type: "weapon",
      name: weapon.weapon.name || `${rarity} weapon (tier ${tier})`,
      quantity: 1,
      rarity,
    });
    rolls.push({ category: "weapon", success: true, detail: `${rarity}: ${weapon.weapon.name || "unnamed"}` });
  } else {
    rolls.push({ category: "weapon", success: false });
  }

  // 6. Armor (60% chance)
  const ARMOR_CHANCE = 0.6;
  if (Math.random() < ARMOR_CHANCE) {
    const { rarity } = rollRarity();
    const armor = generateArmor({
      min_rarity: rarity,
      max_rarity: rarity,
      tier: tier,
    });
    items.push({
      type: "armor",
      name: armor.armor.name || `${rarity} armor (tier ${tier})`,
      quantity: 1,
      rarity,
    });
    rolls.push({ category: "armor", success: true, detail: `${rarity}: ${armor.armor.name || "unnamed"}` });
  } else {
    rolls.push({ category: "armor", success: false });
  }

  // 7. Accessory (50% chance)
  const ACCESSORY_CHANCE = 0.5;
  if (Math.random() < ACCESSORY_CHANCE) {
    const { rarity } = rollRarity();
    const accessory = generateAccessory({
      min_rarity: rarity,
      max_rarity: rarity,
      tier: tier,
    });
    items.push({
      type: "accessory",
      name: accessory.accessory.name || `${rarity} accessory (tier ${tier})`,
      quantity: 1,
      rarity,
    });
    rolls.push({ category: "accessory", success: true, detail: `${rarity}: ${accessory.accessory.name || "unnamed"}` });
  } else {
    rolls.push({ category: "accessory", success: false });
  }

  return {
    items,
    rolls,
    tier,
    accessory_loot_magnet_bonus: lootMagnetBonus > 0 ? lootMagnetBonus : undefined,
    accessory_ammo_scavenged: ammoScavenged,
    accessory_double_loot_triggered: doubleLootTriggered,
  };
}
