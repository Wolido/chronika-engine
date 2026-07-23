/**
 * monster.test.ts — RED phase: 怪物校验规则测试
 *
 * 这些测试定义了 validateMonster() 的期望行为。
 * 当前 validateMonster 是一个桩（stub），会抛出 NOT IMPLEMENTED，
 * 因此全部测试处于 RED（失败）状态。
 *
 * coder 实现 validateMonster 后，这些测试将逐条变绿。
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { validateMonster, type MonsterData } from "../../../engine/validation/monster.ts";

// ---------------------------------------------------------------------------
// 辅助函数：构造一只完全合法的怪物（happy-path 基准数据）
// ---------------------------------------------------------------------------

function validMonster(overrides: Partial<MonsterData> = {}): MonsterData {
  // Stat sum = 33 (tier 2 × 17 = 34 max), 1 point headroom
  return {
    name: "测试怪物",
    category: "beast",
    hp: 30,
    damage_min: 3,
    damage_max: 8,
    accuracy: 0.6,
    evasion: 0.2,
    tier: 2,
    strength: 8,
    agility: 6,
    endurance: 7,
    perception: 5,
    intelligence: 3,
    willpower: 4,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 测试用例
// ---------------------------------------------------------------------------

describe("validateMonster", () => {
  // =========================================================================
  // 基础必填字段
  // =========================================================================

  describe("基础必填字段", () => {
    it("should fail when name is empty or missing", () => {
      const emptyName = validMonster({ name: "" });
      const resultEmpty = validateMonster(emptyName);

      assert.strictEqual(resultEmpty.valid, false);
      assert.ok(resultEmpty.errors.length > 0);
      assert.ok(
        resultEmpty.errors.some((e) => e.toLowerCase().includes("name")),
        `errors should mention 'name', got: ${JSON.stringify(resultEmpty.errors)}`
      );

      const missingName = validMonster();
      delete (missingName as any).name;
      const resultMissing = validateMonster(missingName);

      assert.strictEqual(resultMissing.valid, false);
      assert.ok(resultMissing.errors.length > 0);
      assert.ok(
        resultMissing.errors.some((e) => e.toLowerCase().includes("name")),
        `errors should mention 'name', got: ${JSON.stringify(resultMissing.errors)}`
      );
    });

    it("should fail when category is not one of beast / mutant / humanoid / mechanical / abomination", () => {
      const monster = validMonster({ category: "dragon" });

      const result = validateMonster(monster);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("category")),
        `errors should mention 'category', got: ${JSON.stringify(result.errors)}`
      );
    });

    it("should fail when hp is 0 or negative", () => {
      const zeroHp = validMonster({ hp: 0 });
      const resultZero = validateMonster(zeroHp);

      assert.strictEqual(resultZero.valid, false);
      assert.ok(resultZero.errors.length > 0);
      assert.ok(
        resultZero.errors.some((e) => e.toLowerCase().includes("hp")),
        `errors should mention 'hp', got: ${JSON.stringify(resultZero.errors)}`
      );

      const negativeHp = validMonster({ hp: -5 });
      const resultNeg = validateMonster(negativeHp);

      assert.strictEqual(resultNeg.valid, false);
      assert.ok(resultNeg.errors.length > 0);
      assert.ok(
        resultNeg.errors.some((e) => e.toLowerCase().includes("hp")),
        `errors should mention 'hp', got: ${JSON.stringify(resultNeg.errors)}`
      );
    });

    it("should fail when hp is undefined", () => {
      const monster = { ...validMonster(), hp: undefined as any };

      const result = validateMonster(monster as any);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("hp")),
        `errors should mention 'hp', got: ${JSON.stringify(result.errors)}`
      );
    });
  });

  // =========================================================================
  // 数值范围
  // =========================================================================

  describe("数值范围", () => {
    it("should fail when damage_min is undefined", () => {
      const monster = { ...validMonster(), damage_min: undefined as any };

      const result = validateMonster(monster as any);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("damage_min")),
        `errors should mention 'damage_min', got: ${JSON.stringify(result.errors)}`
      );
    });

    it("should fail when damage_min is less than 1", () => {
      const monster = validMonster({ damage_min: 0 });
      const result = validateMonster(monster);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.toLowerCase().includes("damage_min")));
    });

    it("should fail when damage_max is undefined", () => {
      const monster = validMonster({ damage_max: undefined as any });
      const result = validateMonster(monster as any);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.toLowerCase().includes("damage_max")));
    });

    it("should fail when accuracy is undefined", () => {
      const monster = validMonster({ accuracy: undefined as any });
      const result = validateMonster(monster as any);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.toLowerCase().includes("accuracy")));
    });

    it("should fail when evasion is undefined", () => {
      const monster = validMonster({ evasion: undefined as any });
      const result = validateMonster(monster as any);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.toLowerCase().includes("evasion")));
    });

    it("should fail when tier is undefined", () => {
      const monster = validMonster({ tier: undefined as any });
      const result = validateMonster(monster as any);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.toLowerCase().includes("tier")));
    });

    it("should fail when damage_min > damage_max", () => {
      const monster = validMonster({ damage_min: 10, damage_max: 5 });

      const result = validateMonster(monster);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some(
          (e) =>
            e.toLowerCase().includes("damage_min") ||
            e.toLowerCase().includes("damage_max")
        ),
        `errors should mention 'damage_min' or 'damage_max', got: ${JSON.stringify(result.errors)}`
      );
    });

    it("should fail when damage_max exceeds 50 (tier 5 上限)", () => {
      const monster = validMonster({ damage_min: 40, damage_max: 51, tier: 5 });

      const result = validateMonster(monster);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("damage_max")),
        `errors should mention 'damage_max', got: ${JSON.stringify(result.errors)}`
      );
    });

    it("should fail when accuracy is outside [0.0, 1.0]", () => {
      const below = validMonster({ accuracy: -0.1 });
      const above = validMonster({ accuracy: 1.5 });

      const resultBelow = validateMonster(below);
      const resultAbove = validateMonster(above);

      assert.strictEqual(resultBelow.valid, false);
      assert.ok(resultBelow.errors.length > 0);
      assert.ok(
        resultBelow.errors.some((e) => e.toLowerCase().includes("accuracy")),
        `errors should mention 'accuracy', got: ${JSON.stringify(resultBelow.errors)}`
      );

      assert.strictEqual(resultAbove.valid, false);
      assert.ok(resultAbove.errors.length > 0);
      assert.ok(
        resultAbove.errors.some((e) => e.toLowerCase().includes("accuracy")),
        `errors should mention 'accuracy', got: ${JSON.stringify(resultAbove.errors)}`
      );
    });

    it("should fail when evasion is outside [0.0, 1.0]", () => {
      const below = validMonster({ evasion: -0.1 });
      const above = validMonster({ evasion: 1.5 });

      const resultBelow = validateMonster(below);
      const resultAbove = validateMonster(above);

      assert.strictEqual(resultBelow.valid, false);
      assert.ok(resultBelow.errors.length > 0);
      assert.ok(
        resultBelow.errors.some((e) => e.toLowerCase().includes("evasion")),
        `errors should mention 'evasion', got: ${JSON.stringify(resultBelow.errors)}`
      );

      assert.strictEqual(resultAbove.valid, false);
      assert.ok(resultAbove.errors.length > 0);
      assert.ok(
        resultAbove.errors.some((e) => e.toLowerCase().includes("evasion")),
        `errors should mention 'evasion', got: ${JSON.stringify(resultAbove.errors)}`
      );
    });

    it("should fail when tier is outside [1, 5]", () => {
      const below = validMonster({ tier: 0 });
      const above = validMonster({ tier: 6 });

      const resultBelow = validateMonster(below);
      const resultAbove = validateMonster(above);

      assert.strictEqual(resultBelow.valid, false);
      assert.ok(resultBelow.errors.length > 0);
      assert.ok(
        resultBelow.errors.some((e) => e.toLowerCase().includes("tier")),
        `errors should mention 'tier', got: ${JSON.stringify(resultBelow.errors)}`
      );

      assert.strictEqual(resultAbove.valid, false);
      assert.ok(resultAbove.errors.length > 0);
      assert.ok(
        resultAbove.errors.some((e) => e.toLowerCase().includes("tier")),
        `errors should mention 'tier', got: ${JSON.stringify(resultAbove.errors)}`
      );
    });
  });

  // =========================================================================
  // 属性范围
  // =========================================================================

  describe("属性范围", () => {
    it("should fail when an attribute (e.g. strength) is less than 1", () => {
      const monster = validMonster({ strength: 0 });

      const result = validateMonster(monster);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("strength") || e.toLowerCase().includes("attribute")),
        `errors should mention 'strength' or 'attribute', got: ${JSON.stringify(result.errors)}`
      );
    });

    it("should fail when an attribute (e.g. intelligence) exceeds 20", () => {
      const monster = validMonster({ intelligence: 21 });

      const result = validateMonster(monster);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("intelligence") || e.toLowerCase().includes("attribute")),
        `errors should mention 'intelligence' or 'attribute', got: ${JSON.stringify(result.errors)}`
      );
    });

    it("should fail when an attribute is undefined", () => {
      const monster = { ...validMonster(), agility: undefined as any };

      const result = validateMonster(monster as any);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("agility") || e.toLowerCase().includes("attribute")),
        `errors should mention 'agility' or 'attribute', got: ${JSON.stringify(result.errors)}`
      );
    });
  });

  // =========================================================================
  // 平衡性约束
  // =========================================================================

  describe("平衡性约束", () => {
    it("should fail when accuracy + evasion exceeds 1.3", () => {
      const monster = validMonster({ accuracy: 0.9, evasion: 0.5 });

      const result = validateMonster(monster);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some(
          (e) =>
            e.toLowerCase().includes("accuracy") ||
            e.toLowerCase().includes("evasion") ||
            e.toLowerCase().includes("sum")
        ),
        `errors should mention accuracy/evasion balance, got: ${JSON.stringify(result.errors)}`
      );
    });

    it("should fail when sum of six attributes exceeds tier × 17", () => {
      // tier 2 → max sum = 34; give each attribute a high value
      const monster = validMonster({
        tier: 2,
        strength: 10,
        agility: 10,
        endurance: 10,
        perception: 10,
        intelligence: 10,
        willpower: 10,
      }); // sum = 60, far exceeds 2×17 = 34

      const result = validateMonster(monster);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some(
          (e) =>
            e.toLowerCase().includes("attribute") ||
            e.toLowerCase().includes("sum") ||
            e.toLowerCase().includes("tier")
        ),
        `errors should mention attribute sum / tier balance, got: ${JSON.stringify(result.errors)}`
      );
    });
  });

  // =========================================================================
  // 完全合法的怪物
  // =========================================================================

  describe("完全合法的怪物", () => {
    it("should pass validation for a fully valid beast monster", () => {
      const monster = validMonster({
        name: "森林狼",
        category: "beast",
        hp: 25,
        damage_min: 4,
        damage_max: 10,
        accuracy: 0.65,
        evasion: 0.25,
        tier: 2,
        strength: 9,
        agility: 7,
        endurance: 6,
        perception: 6,
        intelligence: 2,
        willpower: 4,
      });

      const result = validateMonster(monster);

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it("should pass validation for a fully valid humanoid monster", () => {
      const monster = validMonster({
        name: "土匪哨兵",
        category: "humanoid",
        hp: 40,
        damage_min: 5,
        damage_max: 12,
        accuracy: 0.7,
        evasion: 0.15,
        tier: 3,
        strength: 10,
        agility: 8,
        endurance: 9,
        perception: 7,
        intelligence: 6,
        willpower: 5,
      });

      const result = validateMonster(monster);

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });
  });
});
