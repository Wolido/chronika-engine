/**
 * item.test.ts — RED phase: 物品校验规则测试
 *
 * 这些测试定义了 validateItem() 的期望行为。
 * 当前 validateItem 是一个桩（stub），会抛出 NOT IMPLEMENTED，
 * 因此全部测试处于 RED（失败）状态。
 *
 * coder 实现 validateItem 后，这些测试将逐条变绿。
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { validateItem, type ItemData } from "../../../engine/validation/item.ts";

// ---------------------------------------------------------------------------
// 辅助函数：构造一件完全合法的物品（happy-path 基准数据）
// ---------------------------------------------------------------------------

function validItem(overrides: Partial<ItemData> = {}): ItemData {
  return {
    name: "测试物品",
    item_type: "material",
    rarity: "common",
    value: 10,
    weight: 1.0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 测试用例
// ---------------------------------------------------------------------------

describe("validateItem", () => {
  // =========================================================================
  // 基础必填字段
  // =========================================================================

  describe("基础必填字段", () => {
    it("should fail when name is an empty string", () => {
      const item = validItem({ name: "" });

      const result = validateItem(item);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("name")),
        `errors should mention 'name', got: ${JSON.stringify(result.errors)}`
      );
    });

    it("should fail when name is missing", () => {
      const item = validItem();
      delete (item as any).name;

      const result = validateItem(item);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("name")),
        `errors should mention 'name', got: ${JSON.stringify(result.errors)}`
      );
    });

    it("should fail when item_type is not one of consumable / material / armor / misc", () => {
      const item = validItem({ item_type: "weapon" });

      const result = validateItem(item);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("item_type")),
        `errors should mention 'item_type', got: ${JSON.stringify(result.errors)}`
      );
    });

    it("should fail when rarity is not one of common / uncommon / rare / legendary", () => {
      const item = validItem({ rarity: "epic" });

      const result = validateItem(item);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("rarity")),
        `errors should mention 'rarity', got: ${JSON.stringify(result.errors)}`
      );
    });
  });

  // =========================================================================
  // 数值范围
  // =========================================================================

  describe("数值范围", () => {
    it("should fail when value is negative", () => {
      const item = validItem({ value: -1 });

      const result = validateItem(item);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("value")),
        `errors should mention 'value', got: ${JSON.stringify(result.errors)}`
      );
    });

    it("should fail when value is undefined", () => {
      const item = { ...validItem(), value: undefined as any };

      const result = validateItem(item as any);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("value")),
        `errors should mention 'value', got: ${JSON.stringify(result.errors)}`
      );
    });

    it("should fail when weight is negative", () => {
      const item = validItem({ weight: -0.5 });

      const result = validateItem(item);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("weight")),
        `errors should mention 'weight', got: ${JSON.stringify(result.errors)}`
      );
    });
  });

  // =========================================================================
  // 条件依赖：consumable
  // =========================================================================

  describe("条件依赖：consumable", () => {
    it("should fail when item_type=consumable but effect_type is missing", () => {
      const item = validItem({
        item_type: "consumable",
        effect_value: 25,
      });
      delete (item as any).effect_type;

      const result = validateItem(item);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("effect_type")),
        `errors should mention 'effect_type', got: ${JSON.stringify(result.errors)}`
      );
    });

    it("should fail when item_type=consumable but effect_value is missing", () => {
      const item = validItem({
        item_type: "consumable",
        effect_type: "heal",
      });
      delete (item as any).effect_value;

      const result = validateItem(item);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("effect_value")),
        `errors should mention 'effect_value', got: ${JSON.stringify(result.errors)}`
      );
    });
  });

  // =========================================================================
  // 条件依赖：armor
  // =========================================================================

  describe("条件依赖：armor", () => {
    it("should fail when item_type=armor but defense is missing", () => {
      const item = validItem({
        item_type: "armor",
        armor_slot: "chest",
      });
      delete (item as any).defense;

      const result = validateItem(item);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("defense")),
        `errors should mention 'defense', got: ${JSON.stringify(result.errors)}`
      );
    });

    it("should fail when item_type=armor but armor_slot is missing", () => {
      const item = validItem({
        item_type: "armor",
        defense: 15,
      });
      delete (item as any).armor_slot;

      const result = validateItem(item);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("armor_slot")),
        `errors should mention 'armor_slot', got: ${JSON.stringify(result.errors)}`
      );
    });
  });

  // =========================================================================
  // 可堆叠
  // =========================================================================

  describe("可堆叠", () => {
    it("should fail when stackable=true but stack_max is missing", () => {
      const item = validItem({ stackable: true });
      delete (item as any).stack_max;

      const result = validateItem(item);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("stack_max")),
        `errors should mention 'stack_max', got: ${JSON.stringify(result.errors)}`
      );
    });

    it("should fail when stackable=true and stack_max < 1", () => {
      const item = validItem({ stackable: true, stack_max: 0 });

      const result = validateItem(item);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("stack_max")),
        `errors should mention 'stack_max', got: ${JSON.stringify(result.errors)}`
      );
    });
  });

  // =========================================================================
  // 完全合法的物品
  // =========================================================================

  describe("完全合法的物品", () => {
    it("should pass validation for a fully valid consumable item", () => {
      const item = validItem({
        name: "治疗药水",
        item_type: "consumable",
        rarity: "uncommon",
        value: 25,
        weight: 0.3,
        effect_type: "heal",
        effect_value: 40,
      });

      const result = validateItem(item);

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it("should pass validation for a fully valid material item", () => {
      const item = validItem({
        name: "废铁",
        item_type: "material",
        rarity: "common",
        value: 5,
        weight: 2.0,
        stackable: true,
        stack_max: 99,
      });

      const result = validateItem(item);

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it("should pass validation for a fully valid armor item", () => {
      const item = validItem({
        name: "铁胸甲",
        item_type: "armor",
        rarity: "rare",
        value: 150,
        weight: 8.0,
        defense: 25,
        armor_slot: "chest",
      });

      const result = validateItem(item);

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it("should pass validation for a fully valid misc item", () => {
      const item = validItem({
        name: "旧钥匙",
        item_type: "misc",
        rarity: "common",
        value: 1,
        weight: 0.1,
      });

      const result = validateItem(item);

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });
  });
});
