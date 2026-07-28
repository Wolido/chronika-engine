import { describe, it } from "node:test";
import assert from "node:assert";
import {
  generateLoot,
  type GenerateLootInput,
  type GenerateLootResult,
  type LootItemEntry,
} from "../../engine/loot-gen.ts";

// ============================================================
// 新版 loot 系统期望常量
// ============================================================

const EQUIPMENT_TYPES = ["weapon", "armor", "accessory"];

const NEW_RARITY_CHANCES: Record<string, number> = {
  common: 0.15,
  uncommon: 0.25,
  rare: 0.35,
  legendary: 0.25,
};

// ============================================================
// 辅助函数
// ============================================================

function runMany(input: GenerateLootInput, times: number): GenerateLootResult[] {
  const results: GenerateLootResult[] = [];
  for (let i = 0; i < times; i++) {
    results.push(generateLoot(input));
  }
  return results;
}

function hasItemType(result: GenerateLootResult, type: string): boolean {
  return result.items.some(item => item.type === type);
}

function countEquipmentByRarity(results: GenerateLootResult[], rarity: string): number {
  return results.reduce(
    (sum, r) =>
      sum +
      r.items.filter(
        item => EQUIPMENT_TYPES.includes(item.type) && item.rarity === rarity,
      ).length,
    0,
  );
}

// ============================================================
// Tests
// ============================================================

describe("generateLoot revised loot system (RED phase)", () => {
  const sampleSize = 1500;
  const defaultInput: GenerateLootInput = { tier: 3 };

  // --- 测试 1: 结果中应出现 armor 掉落项 -------------------------

  it("should include armor LootItemEntry entries across many runs", () => {
    const results = runMany(defaultInput, sampleSize);
    const armorCount = results.reduce(
      (sum, r) => sum + r.items.filter(item => item.type === "armor").length,
      0,
    );

    assert.ok(
      armorCount > 0,
      `expected at least one armor drop in ${sampleSize} runs, got ${armorCount}`,
    );
  });

  // --- 测试 2: 结果中应出现 accessory 掉落项 ---------------------

  it("should include accessory LootItemEntry entries across many runs", () => {
    const results = runMany(defaultInput, sampleSize);
    const accessoryCount = results.reduce(
      (sum, r) => sum + r.items.filter(item => item.type === "accessory").length,
      0,
    );

    assert.ok(
      accessoryCount > 0,
      `expected at least one accessory drop in ${sampleSize} runs, got ${accessoryCount}`,
    );
  });

  // --- 测试 3: 武器掉率接近 70% ---------------------------------

  it("should drop weapons at approximately 70% rate", () => {
    const results = runMany(defaultInput, sampleSize);
    const fightsWithWeapon = results.filter(r => hasItemType(r, "weapon")).length;
    const rate = fightsWithWeapon / sampleSize;

    assert.ok(
      rate >= 0.65 && rate <= 0.75,
      `weapon drop rate ${rate} not within 0.65-0.75`,
    );
  });

  // --- 测试 4: 防具掉率接近 60% ---------------------------------

  it("should drop armor at approximately 60% rate", () => {
    const results = runMany(defaultInput, sampleSize);
    const fightsWithArmor = results.filter(r => hasItemType(r, "armor")).length;
    const rate = fightsWithArmor / sampleSize;

    assert.ok(
      rate >= 0.55 && rate <= 0.65,
      `armor drop rate ${rate} not within 0.55-0.65`,
    );
  });

  // --- 测试 5: 饰品掉率接近 50% ---------------------------------

  it("should drop accessories at approximately 50% rate", () => {
    const results = runMany(defaultInput, sampleSize);
    const fightsWithAccessory = results.filter(r => hasItemType(r, "accessory")).length;
    const rate = fightsWithAccessory / sampleSize;

    assert.ok(
      rate >= 0.45 && rate <= 0.55,
      `accessory drop rate ${rate} not within 0.45-0.55`,
    );
  });

  // --- 测试 6: 平均每 2 场战斗出 1 件传奇装备 --------------------

  it("should produce legendary equipment at approximately 1 per 2 fights on average", () => {
    const results = runMany(defaultInput, sampleSize);
    const legendaryCount = results.reduce(
      (sum, r) =>
        sum +
        r.items.filter(
          item => EQUIPMENT_TYPES.includes(item.type) && item.rarity === "legendary",
        ).length,
      0,
    );
    const avg = legendaryCount / sampleSize;

    assert.ok(
      avg >= 0.35 && avg <= 0.55,
      `average legendary equipment per fight ${avg} not within 0.35-0.55`,
    );
  });

  // --- 测试 7: 防具/饰品稀有度遵循新版统一稀有度表 ---------------

  it("should reflect new unified rarity distribution for armor and accessory drops", () => {
    const tiers = [1, 5];
    const collected: LootItemEntry[] = [];

    for (const tier of tiers) {
      const results = runMany({ tier }, 800);
      collected.push(
        ...results.flatMap(r =>
          r.items.filter(item => item.type === "armor" || item.type === "accessory"),
        ),
      );
    }

    assert.ok(
      collected.length >= 100,
      `expected enough armor/accessory drops for distribution check, got ${collected.length}`,
    );

    const counts: Record<string, number> = {
      common: 0,
      uncommon: 0,
      rare: 0,
      legendary: 0,
    };
    for (const item of collected) {
      if (item.rarity) {
        counts[item.rarity] = (counts[item.rarity] ?? 0) + 1;
      }
    }

    const total = collected.length;
    for (const [rarity, expected] of Object.entries(NEW_RARITY_CHANCES)) {
      const actual = counts[rarity] / total;
      assert.ok(
        Math.abs(actual - expected) <= 0.06,
        `${rarity} rate ${actual} differs from expected ${expected} by >0.06 ` +
          `(count ${counts[rarity]}/${total})`,
      );
    }
  });
});
