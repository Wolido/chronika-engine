/**
 * legendary-gen.test.ts — RED phase: 传奇武器特效生成与校验测试
 *
 * 这些测试定义了 generateSeed() 和 validateLegendaryEffect() 的期望行为。
 * 当前两个函数均为桩（stub），会抛出 NOT IMPLEMENTED，
 * 因此全部测试处于 RED（失败）状态。
 *
 * coder 实现后，这些测试将逐条变绿。
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  generateSeed,
  validateLegendaryEffect,
} from "../../engine/legendary-gen.ts";

import type {
  LegendarySeed,
  LegendaryEffect,
  LegendaryValidateInput,
  LegendaryValidateResult,
} from "../../engine/legendary-gen.ts";

// ============================================================
// 有效枚举值清单
// ============================================================

const VALID_TRIGGERS = new Set([
  "on_hit",
  "on_kill",
  "on_crit",
  "on_reload",
  "on_empty_mag",
  "on_low_hp",
  "on_miss",
]);

const VALID_EFFECT_TYPES = new Set([
  "multiply_damage",
  "aoe_explosion",
  "lifesteal",
  "refill_ammo",
  "chain_lightning",
  "summon",
  "debuff_enemy",
]);

// ============================================================
// 辅助函数
// ============================================================

/**
 * 构造一个完全合法的传奇特效（happy-path 基准数据）
 */
function validEffect(overrides: Partial<LegendaryEffect> = {}): LegendaryEffect {
  return {
    name: "穷途末路",
    trigger: "on_low_hp",
    effect_type: "multiply_damage",
    magnitude: 2.5,
    description: "当生命垂危时，每次攻击都凝聚了求生的意志，造成毁灭性的伤害。",
    ...overrides,
  };
}

// ============================================================
// generateSeed 测试
// ============================================================

describe("generateSeed", () => {
  it("should generate a seed with valid trigger and effect_type from the enum sets", () => {
    for (let i = 0; i < 5; i++) {
      const seed: LegendarySeed = generateSeed();

      assert.ok(
        VALID_TRIGGERS.has(seed.trigger as any),
        `run ${i}: trigger "${seed.trigger}" is not a valid TriggerType`
      );

      assert.ok(
        VALID_EFFECT_TYPES.has(seed.effect_type as any),
        `run ${i}: effect_type "${seed.effect_type}" is not a valid EffectType`
      );
    }
  });

  it("should generate a seed with magnitude_min ≤ magnitude_max and both in [1.0, 10.0]", () => {
    for (let i = 0; i < 10; i++) {
      const seed: LegendarySeed = generateSeed();

      assert.ok(
        seed.magnitude_min <= seed.magnitude_max,
        `run ${i}: magnitude_min (${seed.magnitude_min}) should be ≤ magnitude_max (${seed.magnitude_max})`
      );

      assert.ok(
        seed.magnitude_min >= 1.0,
        `run ${i}: magnitude_min (${seed.magnitude_min}) should be ≥ 1.0`
      );

      assert.ok(
        seed.magnitude_max <= 10.0,
        `run ${i}: magnitude_max (${seed.magnitude_max}) should be ≤ 10.0`
      );
    }
  });
});

// ============================================================
// validateLegendaryEffect 测试
// ============================================================

describe("validateLegendaryEffect", () => {
  // --- 合法效果通过校验 ---

  it("should return valid=true with no errors for a fully valid legendary effect", () => {
    const effect = validEffect();
    const input: LegendaryValidateInput = {
      effect,
      weapon_tier: 3,
    };

    const result: LegendaryValidateResult = validateLegendaryEffect(input);

    assert.strictEqual(result.valid, true);
    assert.ok(Array.isArray(result.errors));
    assert.strictEqual(result.errors.length, 0);
    assert.ok(Array.isArray(result.warnings));
  });

  // --- 无效 trigger ---

  it("should return valid=false when trigger is not a valid TriggerType", () => {
    const effect = validEffect({ trigger: "on_full_moon" } as any);
    const input: LegendaryValidateInput = {
      effect,
      weapon_tier: 2,
    };

    const result: LegendaryValidateResult = validateLegendaryEffect(input);

    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.length > 0);
    assert.ok(
      result.errors.some((e) => e.toLowerCase().includes("trigger")),
      `errors should mention 'trigger', got: ${JSON.stringify(result.errors)}`
    );
  });

  // --- 无效 effect_type ---

  it("should return valid=false when effect_type is not a valid EffectType", () => {
    const effect = validEffect({ effect_type: "instakill" } as any);
    const input: LegendaryValidateInput = {
      effect,
      weapon_tier: 2,
    };

    const result: LegendaryValidateResult = validateLegendaryEffect(input);

    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.length > 0);
    assert.ok(
      result.errors.some((e) => e.toLowerCase().includes("effect_type")),
      `errors should mention 'effect_type', got: ${JSON.stringify(result.errors)}`
    );
  });

  // --- 名称为空 ---

  it("should return valid=false when name is an empty string", () => {
    const effect = validEffect({ name: "" });
    const input: LegendaryValidateInput = {
      effect,
      weapon_tier: 2,
    };

    const result: LegendaryValidateResult = validateLegendaryEffect(input);

    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.length > 0);
    assert.ok(
      result.errors.some((e) => e.toLowerCase().includes("name")),
      `errors should mention 'name', got: ${JSON.stringify(result.errors)}`
    );
  });

  it("should return valid=false when name is missing (undefined)", () => {
    const effect = validEffect();
    delete (effect as any).name;
    const input: LegendaryValidateInput = {
      effect,
      weapon_tier: 2,
    };

    const result: LegendaryValidateResult = validateLegendaryEffect(input);

    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.length > 0);
    assert.ok(
      result.errors.some((e) => e.toLowerCase().includes("name")),
      `errors should mention 'name', got: ${JSON.stringify(result.errors)}`
    );
  });

  // --- magnitude 超过 tier 允许值 ---

  it("should return valid=true with warnings when magnitude exceeds tier-based limit", () => {
    // tier=1 → 允许上限 3.0; magnitude=5.0 超出上限
    const effect = validEffect({ magnitude: 5.0 });
    const input: LegendaryValidateInput = {
      effect,
      weapon_tier: 1,
    };

    const result: LegendaryValidateResult = validateLegendaryEffect(input);

    // 仍为 valid（警告而非错误），但应产生警告
    assert.strictEqual(result.valid, true);
    assert.ok(result.warnings.length > 0);
    assert.ok(
      result.warnings.some((w) => w.toLowerCase().includes("magnitude")),
      `warnings should mention 'magnitude', got: ${JSON.stringify(result.warnings)}`
    );
  });

  // --- magnitude 在 tier 允许范围内应无警告 ---

  it("should return valid=true with no warnings when magnitude is within tier-based limit", () => {
    // tier=2 → 允许上限 6.0; magnitude=4.0 在范围内
    const effect = validEffect({ magnitude: 4.0 });
    const input: LegendaryValidateInput = {
      effect,
      weapon_tier: 2,
    };

    const result: LegendaryValidateResult = validateLegendaryEffect(input);

    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
    assert.strictEqual(
      result.warnings.length,
      0,
      `expected no warnings, got: ${JSON.stringify(result.warnings)}`
    );
  });
});
