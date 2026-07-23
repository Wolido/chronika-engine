/**
 * weapon.test.ts — RED phase: 武器校验规则测试
 *
 * 这些测试定义了 validateWeapon() 的期望行为。
 * 当前 validateWeapon 是一个桩（stub），会抛出 NOT IMPLEMENTED，
 * 因此全部测试处于 RED（失败）状态。
 *
 * coder 实现 validateWeapon 后，这些测试将逐条变绿。
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { validateWeapon, type WeaponData } from "../../../engine/validation/weapon.ts";

// ---------------------------------------------------------------------------
// 辅助函数：构造一把完全合法的武器（happy-path 基准数据）
// ---------------------------------------------------------------------------

function validWeapon(overrides: Partial<WeaponData> = {}): WeaponData {
  return {
    name: "标准长剑",
    category: "melee",
    damage_type: "slashing",
    damage_min: 4,
    damage_max: 8,
    accuracy: 0.85,
    tier: 2,
    rarity: "uncommon",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 测试用例
// ---------------------------------------------------------------------------

describe("validateWeapon", () => {
  // =========================================================================
  // 基础必填字段
  // =========================================================================

  describe("基础必填字段", () => {
    it("should fail when name is an empty string", () => {
      const weapon = validWeapon({ name: "" });

      const result = validateWeapon(weapon);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("name")),
        `errors should mention 'name', got: ${JSON.stringify(result.errors)}`
      );
    });

    it("should fail when name is missing", () => {
      const weapon = validWeapon();
      delete (weapon as any).name;

      const result = validateWeapon(weapon);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("name")),
        `errors should mention 'name', got: ${JSON.stringify(result.errors)}`
      );
    });

    it("should fail when category is not one of melee / ranged / thrown / explosive", () => {
      const weapon = validWeapon({ category: "magic" });

      const result = validateWeapon(weapon);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("category")),
        `errors should mention 'category', got: ${JSON.stringify(result.errors)}`
      );
    });

    it("should fail when damage_type is not one of slashing / piercing / bludgeoning / thermal / explosive / chemical", () => {
      const weapon = validWeapon({ damage_type: "psychic" });

      const result = validateWeapon(weapon);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("damage_type")),
        `errors should mention 'damage_type', got: ${JSON.stringify(result.errors)}`
      );
    });
  });

  // =========================================================================
  // 数值范围
  // =========================================================================

  describe("数值范围", () => {
    it("should fail when damage_min > damage_max", () => {
      const weapon = validWeapon({ damage_min: 10, damage_max: 5 });

      const result = validateWeapon(weapon);

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

    it("should fail when damage_min is less than 1", () => {
      const weapon = validWeapon({ damage_min: 0, damage_max: 5 });

      const result = validateWeapon(weapon);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("damage_min")),
        `errors should mention 'damage_min', got: ${JSON.stringify(result.errors)}`
      );
    });

    it("should fail when damage_max exceeds 50", () => {
      const weapon = validWeapon({ damage_min: 40, damage_max: 51 });

      const result = validateWeapon(weapon);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("damage_max")),
        `errors should mention 'damage_max', got: ${JSON.stringify(result.errors)}`
      );
    });

    it("should fail when accuracy is outside 0.0–1.0", () => {
      const below = validWeapon({ accuracy: -0.1 });
      const above = validWeapon({ accuracy: 1.5 });

      const resultBelow = validateWeapon(below);
      const resultAbove = validateWeapon(above);

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

    it("should fail when tier is outside 1–5", () => {
      const below = validWeapon({ tier: 0 });
      const above = validWeapon({ tier: 6 });

      const resultBelow = validateWeapon(below);
      const resultAbove = validateWeapon(above);

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

    it("should fail when rarity is not one of common / uncommon / rare / legendary", () => {
      const weapon = validWeapon({ rarity: "mythic" });

      const result = validateWeapon(weapon);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("rarity")),
        `errors should mention 'rarity', got: ${JSON.stringify(result.errors)}`
      );
    });

    // RED: 当前因 NaN 比较静默通过 —— damage_min/damage_max/accuracy/tier 为 undefined
    // 时，NaN < n 返回 false，因此校验永远不会失败。

    it("should fail when damage_min is undefined", () => {
      const weapon = { ...validWeapon(), damage_min: undefined as any };
      const result = validateWeapon(weapon as any);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("damage_min")));
    });

    it("should fail when damage_max is undefined", () => {
      const weapon = { ...validWeapon(), damage_max: undefined as any };
      const result = validateWeapon(weapon as any);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("damage_max")));
    });

    it("should fail when accuracy is undefined", () => {
      const weapon = { ...validWeapon(), accuracy: undefined as any };
      const result = validateWeapon(weapon as any);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("accuracy")));
    });

    it("should fail when tier is undefined", () => {
      const weapon = { ...validWeapon(), tier: undefined as any };
      const result = validateWeapon(weapon as any);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("tier")));
    });
  });

  // =========================================================================
  // 条件依赖（ranged / thrown）
  // =========================================================================

  describe("条件依赖：ranged 类别", () => {
    it("should fail when category=ranged but range_min is missing", () => {
      const weapon = validWeapon({
        category: "ranged",
        damage_type: "piercing",
        range_max: 30,
        ammo_type: "arrows",
      });
      delete (weapon as any).range_min;

      const result = validateWeapon(weapon);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("range_min")),
        `errors should mention 'range_min', got: ${JSON.stringify(result.errors)}`
      );
    });

    it("should fail when category=ranged but range_max is missing", () => {
      const weapon = validWeapon({
        category: "ranged",
        damage_type: "piercing",
        range_min: 5,
        ammo_type: "arrows",
      });
      delete (weapon as any).range_max;

      const result = validateWeapon(weapon);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("range_max")),
        `errors should mention 'range_max', got: ${JSON.stringify(result.errors)}`
      );
    });

    it("should fail when category=ranged but ammo_type is missing", () => {
      const weapon = validWeapon({
        category: "ranged",
        damage_type: "piercing",
        range_min: 5,
        range_max: 30,
      });
      delete (weapon as any).ammo_type;

      const result = validateWeapon(weapon);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("ammo_type")),
        `errors should mention 'ammo_type', got: ${JSON.stringify(result.errors)}`
      );
    });

    it("should fail when category=thrown but range_min, range_max, ammo_type are missing", () => {
      const weapon = validWeapon({
        category: "thrown",
        damage_type: "piercing",
      });
      delete (weapon as any).range_min;
      delete (weapon as any).range_max;
      delete (weapon as any).ammo_type;

      const result = validateWeapon(weapon);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      // 至少应该报出其中一项
      const msg = result.errors.join(" ").toLowerCase();
      assert.ok(
        msg.includes("range") || msg.includes("ammo"),
        `errors should mention range fields or ammo, got: ${JSON.stringify(result.errors)}`
      );
    });

    it("should fail when category=ranged and range_max <= range_min", () => {
      const weapon = validWeapon({
        category: "ranged",
        damage_type: "piercing",
        range_min: 30,
        range_max: 30,
        ammo_type: "arrows",
      });

      const result = validateWeapon(weapon);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some(
          (e) =>
            e.toLowerCase().includes("range_max") ||
            e.toLowerCase().includes("range_min")
        ),
        `errors should mention range ordering, got: ${JSON.stringify(result.errors)}`
      );
    });
  });

  // =========================================================================
  // 边界案例：完全合法
  // =========================================================================

  describe("完全合法的武器", () => {
    it("should pass validation for a fully valid melee weapon", () => {
      const weapon = validWeapon({
        name: "秘银长剑",
        category: "melee",
        damage_type: "slashing",
        damage_min: 6,
        damage_max: 12,
        accuracy: 0.9,
        tier: 3,
        rarity: "rare",
      });

      const result = validateWeapon(weapon);

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it("should pass validation for a fully valid ranged weapon", () => {
      const weapon = validWeapon({
        name: "精灵长弓",
        category: "ranged",
        damage_type: "piercing",
        damage_min: 3,
        damage_max: 10,
        accuracy: 0.75,
        tier: 2,
        rarity: "uncommon",
        range_min: 10,
        range_max: 60,
        ammo_type: "arrows",
      });

      const result = validateWeapon(weapon);

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it("should pass validation for a fully valid thrown weapon", () => {
      const weapon = validWeapon({
        name: "投掷飞斧",
        category: "thrown",
        damage_type: "slashing",
        damage_min: 3,
        damage_max: 7,
        accuracy: 0.7,
        tier: 1,
        rarity: "common",
        range_min: 5,
        range_max: 20,
        ammo_type: "throwing axes",
      });

      const result = validateWeapon(weapon);

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it("should pass validation for a fully valid explosive weapon", () => {
      const weapon = validWeapon({
        name: "破片手雷",
        category: "explosive",
        damage_type: "explosive",
        damage_min: 15,
        damage_max: 30,
        accuracy: 0.6,
        tier: 4,
        rarity: "rare",
      });

      const result = validateWeapon(weapon);

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it("should pass validation with boundary values at limits", () => {
      // tier 边界的合法武器
      const weapon = validWeapon({
        name: "边界测试剑",
        category: "melee",
        damage_type: "bludgeoning",
        damage_min: 1,
        damage_max: 50,
        accuracy: 0.0,
        tier: 5,
        rarity: "legendary",
      });

      const result = validateWeapon(weapon);

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });
  });
});
