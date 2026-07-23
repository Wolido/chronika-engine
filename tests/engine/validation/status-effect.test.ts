/**
 * status-effect.test.ts — RED phase: 状态效果校验规则测试
 *
 * 这些测试定义了 validateStatusEffect() 的期望行为。
 * 当前 validateStatusEffect 是一个桩（stub），会抛出 NOT IMPLEMENTED，
 * 因此全部测试处于 RED（失败）状态。
 *
 * coder 实现 validateStatusEffect 后，这些测试将逐条变绿。
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { validateStatusEffect, type StatusEffectData } from "../../../engine/validation/status-effect.ts";

// ---------------------------------------------------------------------------
// 辅助函数：构造一个完全合法的状态效果（happy-path 基准数据）
// ---------------------------------------------------------------------------

function validEffect(overrides: Partial<StatusEffectData> = {}): StatusEffectData {
  return {
    name: "测试效果",
    effect_type: "buff",
    target_attribute: "strength",
    magnitude: 3,
    duration: 5,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 测试用例
// ---------------------------------------------------------------------------

describe("validateStatusEffect", () => {
  // =========================================================================
  // 基础必填字段
  // =========================================================================

  describe("基础必填字段", () => {
    it("should fail when name is an empty string", () => {
      const effect = validEffect({ name: "" });

      const result = validateStatusEffect(effect);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("name")),
        `errors should mention 'name', got: ${JSON.stringify(result.errors)}`
      );
    });

    it("should fail when name is missing", () => {
      const effect = validEffect();
      delete (effect as any).name;

      const result = validateStatusEffect(effect);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("name")),
        `errors should mention 'name', got: ${JSON.stringify(result.errors)}`
      );
    });

    it("should fail when effect_type is not a valid value (e.g. 'invisible')", () => {
      const effect = validEffect({ effect_type: "invisible" });

      const result = validateStatusEffect(effect);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("effect_type")),
        `errors should mention 'effect_type', got: ${JSON.stringify(result.errors)}`
      );
    });
  });

  // =========================================================================
  // 数值范围
  // =========================================================================

  describe("数值范围", () => {
    it("should fail when magnitude is undefined", () => {
      const effect = { ...validEffect(), magnitude: undefined as any };

      const result = validateStatusEffect(effect as any);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("magnitude")),
        `errors should mention 'magnitude', got: ${JSON.stringify(result.errors)}`
      );
    });

    it("should fail when duration is undefined", () => {
      const effect = { ...validEffect(), duration: undefined as any };

      const result = validateStatusEffect(effect as any);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("duration")),
        `errors should mention 'duration', got: ${JSON.stringify(result.errors)}`
      );
    });

    it("should fail when duration is less than 1 (zero or negative)", () => {
      const zeroDuration = validEffect({ duration: 0 });
      const resultZero = validateStatusEffect(zeroDuration);

      assert.strictEqual(resultZero.valid, false);
      assert.ok(resultZero.errors.length > 0);
      assert.ok(
        resultZero.errors.some((e) => e.toLowerCase().includes("duration")),
        `errors should mention 'duration', got: ${JSON.stringify(resultZero.errors)}`
      );

      const negativeDuration = validEffect({ duration: -3 });
      const resultNeg = validateStatusEffect(negativeDuration);

      assert.strictEqual(resultNeg.valid, false);
      assert.ok(resultNeg.errors.length > 0);
      assert.ok(
        resultNeg.errors.some((e) => e.toLowerCase().includes("duration")),
        `errors should mention 'duration', got: ${JSON.stringify(resultNeg.errors)}`
      );
    });
  });

  // =========================================================================
  // 类型约束
  // =========================================================================

  describe("类型约束", () => {
    it("should fail when effect_type=buff but magnitude < 0 (buff should be positive)", () => {
      const effect = validEffect({ effect_type: "buff", magnitude: -5 });

      const result = validateStatusEffect(effect);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some(
          (e) =>
            e.toLowerCase().includes("magnitude") ||
            e.toLowerCase().includes("buff")
        ),
        `errors should mention magnitude/buff constraint, got: ${JSON.stringify(result.errors)}`
      );
    });

    it("should fail when effect_type=debuff but magnitude > 0 (debuff should be negative)", () => {
      const effect = validEffect({ effect_type: "debuff", magnitude: 3 });

      const result = validateStatusEffect(effect);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some(
          (e) =>
            e.toLowerCase().includes("magnitude") ||
            e.toLowerCase().includes("debuff")
        ),
        `errors should mention magnitude/debuff constraint, got: ${JSON.stringify(result.errors)}`
      );
    });

    it("should fail when effect_type=stun but magnitude ≠ 0 (stun should be zero)", () => {
      const effect = validEffect({ effect_type: "stun", magnitude: 1 });

      const result = validateStatusEffect(effect);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some(
          (e) =>
            e.toLowerCase().includes("magnitude") ||
            e.toLowerCase().includes("stun")
        ),
        `errors should mention magnitude/stun constraint, got: ${JSON.stringify(result.errors)}`
      );
    });
  });

  // =========================================================================
  // 可堆叠
  // =========================================================================

  describe("可堆叠", () => {
    it("should fail when stackable=true but max_stacks is missing", () => {
      const effect = validEffect({ stackable: true });
      delete (effect as any).max_stacks;

      const result = validateStatusEffect(effect);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("max_stacks")),
        `errors should mention 'max_stacks', got: ${JSON.stringify(result.errors)}`
      );
    });

    it("should fail when stackable=true and max_stacks < 1", () => {
      const effect = validEffect({ stackable: true, max_stacks: 0 });

      const result = validateStatusEffect(effect);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("max_stacks")),
        `errors should mention 'max_stacks', got: ${JSON.stringify(result.errors)}`
      );
    });
  });

  // =========================================================================
  // 完全合法的状态效果
  // =========================================================================

  describe("完全合法的状态效果", () => {
    it("should pass validation for a fully valid buff (magnitude > 0)", () => {
      const effect = validEffect({
        name: "力量提升",
        effect_type: "buff",
        target_attribute: "strength",
        magnitude: 5,
        duration: 3,
      });

      const result = validateStatusEffect(effect);

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it("should pass validation for a fully valid debuff (magnitude < 0)", () => {
      const effect = validEffect({
        name: "虚弱诅咒",
        effect_type: "debuff",
        target_attribute: "strength",
        magnitude: -4,
        duration: 2,
      });

      const result = validateStatusEffect(effect);

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });
  });
});
