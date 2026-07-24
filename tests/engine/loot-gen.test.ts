import { describe, it } from "node:test";
import assert from "node:assert";
import {
  generateLoot,
  type GenerateLootInput,
  type GenerateLootResult,
  type LootItemEntry,
} from "../../engine/loot-gen.ts";

// ============================================================
// 概率表（硬编码，供测试参考）
// ============================================================
//
// tier 1-2:   common 60% / uncommon 30% / rare 8% / legendary 2%
// tier 3:     common 20% / uncommon 40% / rare 30% / legendary 10%
// tier 4-5:   common 5%  / uncommon 20% / rare 40% / legendary 35%

const VALID_RARITIES = ["common", "uncommon", "rare", "legendary"];

// ============================================================
// 辅助函数
// ============================================================

function tier1Input(): GenerateLootInput {
  return { tier: 1, enemy_type: "beast" };
}

function tier5Input(): GenerateLootInput {
  return { tier: 5, enemy_type: "mutant" };
}

/** 运行 N 次 generateLoot，返回所有结果 */
function runMany(input: GenerateLootInput, times: number): GenerateLootResult[] {
  const results: GenerateLootResult[] = [];
  for (let i = 0; i < times; i++) {
    results.push(generateLoot(input));
  }
  return results;
}

// ============================================================
// Tests
// ============================================================

describe("generateLoot", () => {
  // --- 测试 1: tier 1 敌人至少掉落货币 -------------------------------

  it("should always drop at least one currency item for tier 1 enemy (10 runs)", () => {
    for (let i = 0; i < 10; i++) {
      const result = generateLoot(tier1Input());

      const currencyItems = result.items.filter(item => item.type === "currency");

      assert.ok(
        currencyItems.length >= 1,
        `run ${i}: expected at least 1 currency item, got ${currencyItems.length}`,
      );
    }
  });

  // --- 测试 2: tier 5 敌人掉落内容多于 tier 1 -----------------------

  it("should drop more items on average for tier 5 than tier 1 (20 runs each)", () => {
    const tier1Results = runMany(tier1Input(), 20);
    const tier5Results = runMany(tier5Input(), 20);

    const tier1Avg =
      tier1Results.reduce((sum, r) => sum + r.items.length, 0) / tier1Results.length;
    const tier5Avg =
      tier5Results.reduce((sum, r) => sum + r.items.length, 0) / tier5Results.length;

    assert.ok(
      tier5Avg > tier1Avg,
      `expected tier 5 avg items (${tier5Avg}) > tier 1 avg items (${tier1Avg})`,
    );
  });

  // --- 测试 3: 武器掉落时 rarity 在概率表范围内 -----------------------

  it("should only produce weapons with valid rarity values (100 runs)", () => {
    const results = runMany({ tier: 3 }, 100);

    const allWeapons = results.flatMap(r =>
      r.items.filter((item): item is LootItemEntry => item.type === "weapon"),
    );

    // 不要求一定有武器掉落（概率性的），但如果掉落了就必须合法
    for (const weapon of allWeapons) {
      assert.ok(
        weapon.rarity && VALID_RARITIES.includes(weapon.rarity),
        `weapon "${weapon.name}" has invalid rarity: ${weapon.rarity}`,
      );
    }
  });

  // --- 测试 4: 掉落中包含材料时数量为正数 ----------------------------

  it("should drop materials with positive quantity", () => {
    // 用高 tier 提高材料掉落概率，跑多次来收集材料
    const results = runMany(tier5Input(), 30);

    const allMaterials = results.flatMap(r =>
      r.items.filter(item => item.type === "material"),
    );

    // 如果材料掉落了，数量必须 > 0
    for (const mat of allMaterials) {
      assert.ok(
        mat.quantity > 0,
        `material "${mat.name}" has non-positive quantity: ${mat.quantity}`,
      );
    }
  });

  // --- 测试 5: 武器掉落的名字非空 ------------------------------------

  it("should generate weapons with non-empty name", () => {
    // 用高 tier 提高武器掉落概率
    const results = runMany(tier5Input(), 50);

    const allWeapons = results.flatMap(r =>
      r.items.filter(item => item.type === "weapon"),
    );

    for (const weapon of allWeapons) {
      assert.ok(
        typeof weapon.name === "string" && weapon.name.length > 0,
        `weapon has empty or invalid name: "${weapon.name}"`,
      );
    }
  });
});
