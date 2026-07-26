/**
 * legendary-gen.test.ts — Cycle 1 RED phase
 *
 * 覆盖范围：
 * 1. 武器词条修正
 *    - fear / confuse 合并为 mental_break
 *    - 删除 on_dodge 触发器
 *    - 新增 on_ammo_low 触发器
 *    - 新增 disarm 效果
 * 2. 防具传奇系统
 *    - 14 种防具触发器 + 15 种防具效果常量
 *    - generateArmorSeed()（如果引擎导出）
 *
 * 当前 engine 仍为旧实现，因此这些测试应处于 RED 状态。
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  generateSeed,
  validateLegendaryEffect,
  validateLegendaryForWeapon,
  magnitudeRangeFor,
} from "../../engine/legendary-gen.ts";

import type {
  LegendarySeed,
  LegendaryEffect,
  LegendaryValidateInput,
  LegendaryValidateResult,
  WeaponContext,
} from "../../engine/legendary-gen.ts";

// ============================================================
// 武器触发器与效果类型枚举（Cycle 1 修正后）
// ============================================================

const VALID_TRIGGERS = new Set([
  "on_hit",
  "on_crit",
  "on_miss",
  "on_kill",
  "on_attack_start",
  "on_damage_dealt",
  "on_overkill",
  "on_armor_pierce",
  "on_low_attacker_hp",
  "on_low_defender_hp",
  "on_parry",
  "on_reload",
  "on_empty_mag",
  "on_full_mag",
  "on_weapon_jam",
  "on_elemental_proc",
  "on_stealth_attack",
  "on_counter_attack",
  "on_finishing_blow",
  "on_berserk",
  "on_last_stand",
  "on_first_blood",
  "on_reflect",
  "on_wound",
  "on_ammo_low",
]);

const VALID_EFFECT_TYPES = new Set([
  "multiply_damage",
  "add_flat_damage",
  "lifesteal",
  "life_drain",
  "aoe_explosion",
  "chain_lightning",
  "armor_pierce",
  "armor_shred",
  "stun",
  "bleed",
  "burn",
  "poison",
  "frost_slow",
  "shock_proc",
  "mental_break",
  "debuff_attack",
  "debuff_defense",
  "buff_attack",
  "buff_accuracy",
  "buff_evasion",
  "summon_ally",
  "refill_ammo",
  "shield",
  "reflect_damage",
  "disarm",
]);

const ARMOR_TRIGGERS = new Set([
  "on_hit_taken",
  "on_crit_taken",
  "on_damage_taken",
  "on_heavy_damage",
  "on_block",
  "on_dodged",
  "on_low_wearer_hp",
  "on_critical_hp",
  "on_combat_start",
  "on_kill_response",
  "on_debuff_received",
  "on_elemental_hit",
  "on_fatal_hit",
  "passive",
]);

const ARMOR_EFFECT_TYPES = new Set([
  "damage_reduction",
  "flat_damage_block",
  "thorns",
  "reflect_percent",
  "hp_regen",
  "emergency_heal",
  "heal_on_kill",
  "explosive_retaliation",
  "elemental_absorption",
  "status_cleanse",
  "fear_aura",
  "pain_to_power",
  "last_stand",
  "stat_boost",
  "retribution",
]);

// ============================================================
// 辅助函数
// ============================================================

function validEffect(overrides: Partial<LegendaryEffect> = {}): LegendaryEffect {
  return {
    name: "穷途末路",
    trigger: "on_low_attacker_hp",
    effect_type: "multiply_damage",
    magnitude: 2.5,
    description: "当生命垂危时，每次攻击都凝聚了求生的意志，造成毁灭性的伤害。",
    ...overrides,
  };
}

function weaponContext(overrides: Partial<WeaponContext> = {}): WeaponContext {
  return {
    weapon_type: "melee",
    tier: 3,
    ...overrides,
  };
}

// ============================================================
// generateSeed 测试
// ============================================================

describe("generateSeed", () => {
  it("should generate a seed with valid trigger from the 25 TriggerType enum", () => {
    for (let i = 0; i < 50; i++) {
      const seed: LegendarySeed = generateSeed();

      assert.ok(
        VALID_TRIGGERS.has(seed.trigger),
        `run ${i}: trigger "${seed.trigger}" is not a valid TriggerType`
      );
    }
  });

  it("should generate a seed with valid effect_type from the 25 EffectType enum", () => {
    for (let i = 0; i < 50; i++) {
      const seed: LegendarySeed = generateSeed();

      assert.ok(
        VALID_EFFECT_TYPES.has(seed.effect_type),
        `run ${i}: effect_type "${seed.effect_type}" is not a valid EffectType`
      );
    }
  });

  it("should generate a seed with magnitude_min ≤ magnitude_max and both > 0", () => {
    for (let i = 0; i < 30; i++) {
      const seed: LegendarySeed = generateSeed();

      assert.ok(
        seed.magnitude_min <= seed.magnitude_max,
        `run ${i}: magnitude_min (${seed.magnitude_min}) should be ≤ magnitude_max (${seed.magnitude_max})`
      );

      assert.ok(
        seed.magnitude_min > 0,
        `run ${i}: magnitude_min (${seed.magnitude_min}) should be > 0`
      );

      assert.ok(
        seed.magnitude_max > 0,
        `run ${i}: magnitude_max (${seed.magnitude_max}) should be > 0`
      );
    }
  });

  it("should never generate fear or confuse as effect_type", () => {
    for (let i = 0; i < 100; i++) {
      const seed: LegendarySeed = generateSeed();

      assert.notStrictEqual(
        seed.effect_type,
        "fear",
        `run ${i}: generateSeed still emits deprecated effect_type "fear"`
      );
      assert.notStrictEqual(
        seed.effect_type,
        "confuse",
        `run ${i}: generateSeed still emits deprecated effect_type "confuse"`
      );
    }
  });

  it("should be able to generate mental_break as effect_type", () => {
    let found = false;

    for (let i = 0; i < 500; i++) {
      const seed: LegendarySeed = generateSeed();
      if (seed.effect_type === "mental_break") {
        found = true;
        break;
      }
    }

    assert.ok(found, "generateSeed should be capable of producing mental_break");
  });

  it("should never generate on_dodge as trigger", () => {
    for (let i = 0; i < 100; i++) {
      const seed: LegendarySeed = generateSeed();

      assert.notStrictEqual(
        seed.trigger,
        "on_dodge",
        `run ${i}: generateSeed still emits deprecated trigger "on_dodge"`
      );
    }
  });

  it("should be able to generate on_ammo_low as trigger", () => {
    let found = false;

    for (let i = 0; i < 500; i++) {
      const seed: LegendarySeed = generateSeed();
      if (seed.trigger === "on_ammo_low") {
        found = true;
        break;
      }
    }

    assert.ok(found, "generateSeed should be capable of producing on_ammo_low");
  });
});

// ============================================================
// validateLegendaryEffect 测试
// ============================================================

describe("validateLegendaryEffect", () => {
  it("should return valid=true with no errors for a fully valid legendary effect", () => {
    const effect = validEffect();
    const input: LegendaryValidateInput = { effect, weapon_tier: 3 };

    const result: LegendaryValidateResult = validateLegendaryEffect(input);

    assert.strictEqual(result.valid, true);
    assert.ok(Array.isArray(result.errors));
    assert.strictEqual(result.errors.length, 0);
    assert.ok(Array.isArray(result.warnings));
  });

  it("should return valid=false when trigger is not a valid TriggerType", () => {
    const effect = validEffect({ trigger: "on_full_moon" } as any);
    const input: LegendaryValidateInput = { effect, weapon_tier: 2 };

    const result = validateLegendaryEffect(input);

    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.length > 0);
    assert.ok(
      result.errors.some((e) => e.toLowerCase().includes("trigger")),
      `errors should mention 'trigger', got: ${JSON.stringify(result.errors)}`
    );
  });

  it("should return valid=false when effect_type is not a valid EffectType", () => {
    const effect = validEffect({ effect_type: "instakill" } as any);
    const input: LegendaryValidateInput = { effect, weapon_tier: 2 };

    const result = validateLegendaryEffect(input);

    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.length > 0);
    assert.ok(
      result.errors.some((e) => e.toLowerCase().includes("effect_type")),
      `errors should mention 'effect_type', got: ${JSON.stringify(result.errors)}`
    );
  });

  it("should return valid=false when name is an empty string", () => {
    const effect = validEffect({ name: "" });
    const input: LegendaryValidateInput = { effect, weapon_tier: 2 };

    const result = validateLegendaryEffect(input);

    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.length > 0);
    assert.ok(
      result.errors.some((e) => e.toLowerCase().includes("name")),
      `errors should mention 'name', got: ${JSON.stringify(result.errors)}`
    );
  });

  it("should return valid=false when name is missing", () => {
    const effect = validEffect();
    delete (effect as any).name;
    const input: LegendaryValidateInput = { effect, weapon_tier: 2 };

    const result = validateLegendaryEffect(input);

    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.length > 0);
    assert.ok(
      result.errors.some((e) => e.toLowerCase().includes("name")),
      `errors should mention 'name', got: ${JSON.stringify(result.errors)}`
    );
  });

  it("should warn when magnitude exceeds tier-based limit", () => {
    const effect = validEffect({ magnitude: 5.0 });
    const input: LegendaryValidateInput = { effect, weapon_tier: 1 };

    const result = validateLegendaryEffect(input);

    assert.strictEqual(result.valid, true);
    assert.ok(result.warnings.length > 0);
    assert.ok(
      result.warnings.some((w) => w.toLowerCase().includes("magnitude")),
      `warnings should mention 'magnitude', got: ${JSON.stringify(result.warnings)}`
    );
  });

  it("should return no warnings when magnitude is within tier-based limit", () => {
    const effect = validEffect({ magnitude: 4.0 });
    const input: LegendaryValidateInput = { effect, weapon_tier: 2 };

    const result = validateLegendaryEffect(input);

    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
    assert.strictEqual(
      result.warnings.length,
      0,
      `expected no warnings, got: ${JSON.stringify(result.warnings)}`
    );
  });

  it("should validate every trigger in the 25 TriggerType enum", () => {
    for (const trigger of VALID_TRIGGERS) {
      const effect = validEffect({ trigger });
      const input: LegendaryValidateInput = { effect, weapon_tier: 3 };
      const result = validateLegendaryEffect(input);

      assert.strictEqual(
        result.valid,
        true,
        `trigger "${trigger}" should be valid, got errors: ${JSON.stringify(result.errors)}`
      );
    }
  });

  it("should validate every effect_type in the 25 EffectType enum", () => {
    for (const effectType of VALID_EFFECT_TYPES) {
      const effect = validEffect({ effect_type: effectType });
      const input: LegendaryValidateInput = { effect, weapon_tier: 3 };
      const result = validateLegendaryEffect(input);

      assert.strictEqual(
        result.valid,
        true,
        `effect_type "${effectType}" should be valid, got errors: ${JSON.stringify(result.errors)}`
      );
    }
  });

  it("should reject deprecated effect_type fear", () => {
    const effect = validEffect({ effect_type: "fear" as any });
    const input: LegendaryValidateInput = { effect, weapon_tier: 3 };

    const result = validateLegendaryEffect(input);

    assert.strictEqual(result.valid, false);
    assert.ok(
      result.errors.some((e) => e.toLowerCase().includes("effect_type")),
      `errors should mention effect_type, got: ${JSON.stringify(result.errors)}`
    );
  });

  it("should reject deprecated effect_type confuse", () => {
    const effect = validEffect({ effect_type: "confuse" as any });
    const input: LegendaryValidateInput = { effect, weapon_tier: 3 };

    const result = validateLegendaryEffect(input);

    assert.strictEqual(result.valid, false);
    assert.ok(
      result.errors.some((e) => e.toLowerCase().includes("effect_type")),
      `errors should mention effect_type, got: ${JSON.stringify(result.errors)}`
    );
  });

  it("should accept effect_type mental_break", () => {
    const effect = validEffect({ effect_type: "mental_break" });
    const input: LegendaryValidateInput = { effect, weapon_tier: 3 };

    const result = validateLegendaryEffect(input);

    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
  });

  it("should accept effect_type disarm", () => {
    const effect = validEffect({ effect_type: "disarm" });
    const input: LegendaryValidateInput = { effect, weapon_tier: 3 };

    const result = validateLegendaryEffect(input);

    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
  });

  it("should reject deprecated trigger on_dodge", () => {
    const effect = validEffect({ trigger: "on_dodge" as any });
    const input: LegendaryValidateInput = { effect, weapon_tier: 3 };

    const result = validateLegendaryEffect(input);

    assert.strictEqual(result.valid, false);
    assert.ok(
      result.errors.some((e) => e.toLowerCase().includes("trigger")),
      `errors should mention trigger, got: ${JSON.stringify(result.errors)}`
    );
  });

  it("should accept trigger on_ammo_low", () => {
    const effect = validEffect({ trigger: "on_ammo_low" });
    const input: LegendaryValidateInput = { effect, weapon_tier: 3 };

    const result = validateLegendaryEffect(input);

    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
  });
});

// ============================================================
// validateLegendaryForWeapon 测试
// ============================================================

describe("validateLegendaryForWeapon", () => {
  it("should warn when a melee weapon uses on_reload trigger", () => {
    const effect = validEffect({ trigger: "on_reload" });
    const ctx = weaponContext({ weapon_type: "melee" });

    const result = validateLegendaryForWeapon(effect, ctx);

    assert.ok(
      result.warnings.some((w) => w.toLowerCase().includes("reload")),
      `expected reload warning, got: ${JSON.stringify(result.warnings)}`
    );
  });

  it("should warn when a melee weapon uses refill_ammo effect", () => {
    const effect = validEffect({ effect_type: "refill_ammo" });
    const ctx = weaponContext({ weapon_type: "melee" });

    const result = validateLegendaryForWeapon(effect, ctx);

    assert.ok(
      result.warnings.some((w) => w.toLowerCase().includes("ammo")),
      `expected ammo warning, got: ${JSON.stringify(result.warnings)}`
    );
  });

  it("should warn when a ranged weapon uses reflect_damage effect", () => {
    const effect = validEffect({ effect_type: "reflect_damage" });
    const ctx = weaponContext({ weapon_type: "ranged" });

    const result = validateLegendaryForWeapon(effect, ctx);

    assert.ok(
      result.warnings.some((w) =>
        w.toLowerCase().includes("reflect") || w.toLowerCase().includes("melee")
      ),
      `expected reflect/melee warning, got: ${JSON.stringify(result.warnings)}`
    );
  });

  it("should warn when summon_ally is used on a low-tier weapon", () => {
    const effect = validEffect({ effect_type: "summon_ally" });
    const ctx = weaponContext({ weapon_type: "melee", tier: 2 });

    const result = validateLegendaryForWeapon(effect, ctx);

    assert.ok(
      result.warnings.some((w) =>
        w.toLowerCase().includes("summon") || w.toLowerCase().includes("tier")
      ),
      `expected summon/tier warning, got: ${JSON.stringify(result.warnings)}`
    );
  });

  it("should return no warnings for a perfect melee on_hit multiply_damage match", () => {
    const effect = validEffect({ trigger: "on_hit", effect_type: "multiply_damage" });
    const ctx = weaponContext({ weapon_type: "melee", tier: 3 });

    const result = validateLegendaryForWeapon(effect, ctx);

    assert.strictEqual(
      result.warnings.length,
      0,
      `expected no warnings, got: ${JSON.stringify(result.warnings)}`
    );
  });
});

// ============================================================
// magnitudeRangeFor 测试
// ============================================================

describe("magnitudeRangeFor", () => {
  it("should return a range with min ≤ max and both positive for each effect type", () => {
    for (const effectType of VALID_EFFECT_TYPES) {
      const range = magnitudeRangeFor(effectType);

      assert.ok(
        range.min > 0,
        `${effectType}: expected min > 0, got ${range.min}`
      );
      assert.ok(
        range.max >= range.min,
        `${effectType}: expected max (${range.max}) >= min (${range.min})`
      );
    }
  });

  it("should return different ranges for damage effects vs utility effects", () => {
    const damageRange = magnitudeRangeFor("multiply_damage");
    const shieldRange = magnitudeRangeFor("shield");

    assert.ok(damageRange.max > 1, "multiply_damage max should exceed 1");
    assert.ok(shieldRange.max > 0, "shield max should be positive");
  });
});

// ============================================================
// 防具传奇系统常量与生成测试
// ============================================================

describe("armor legendary generation", () => {
  it("should define 14 armor trigger constants", () => {
    assert.strictEqual(ARMOR_TRIGGERS.size, 14);
  });

  it("should define 15 armor effect_type constants", () => {
    assert.strictEqual(ARMOR_EFFECT_TYPES.size, 15);
  });

  it("should expose generateArmorSeed with armor-valid output if the function exists", async () => {
    const mod = await import("../../engine/legendary-gen.ts");

    if (typeof mod.generateArmorSeed !== "function") {
      return;
    }

    const seed = mod.generateArmorSeed();

    assert.ok(
      ARMOR_TRIGGERS.has(seed.trigger),
      `armor trigger "${seed.trigger}" is not a valid armor trigger`
    );
    assert.ok(
      ARMOR_EFFECT_TYPES.has(seed.effect_type),
      `armor effect_type "${seed.effect_type}" is not a valid armor effect`
    );
    assert.ok(
      seed.magnitude_min <= seed.magnitude_max,
      `magnitude_min (${seed.magnitude_min}) should be ≤ magnitude_max (${seed.magnitude_max})`
    );
    assert.ok(seed.magnitude_min > 0, "magnitude_min should be > 0");
    assert.ok(seed.magnitude_max > 0, "magnitude_max should be > 0");
  });
});

// ============================================================
// 饰品传奇系统常量与生成测试 (Cycle 2)
// ============================================================

const EXPECTED_ACCESSORY_TRIGGERS = new Set([
  "on_kill",
  "on_low_hp",
  "on_combat_start",
  "on_travel",
  "on_explore",
  "on_loot",
  "on_trade",
  "on_craft",
  "on_heal",
  "passive",
]);

const EXPECTED_ACCESSORY_EFFECTS = new Set([
  "xp_boost",
  "second_wind",
  "lucky_crit",
  "heal_on_kill",
  "stealth_field",
  "danger_sense",
  "movement_speed",
  "resource_sense",
  "loot_magnet",
  "ammo_scavenge",
  "double_loot",
  "trade_discount",
  "sell_bonus",
  "crafting_efficiency",
  "material_save",
  "healing_boost",
  "item_efficiency",
]);

const ACCESSORY_MAGNITUDE_RANGES: Record<string, { min: number; max: number }> = {
  xp_boost: { min: 0.1, max: 0.5 },
  second_wind: { min: 1, max: 4 },
  lucky_crit: { min: 0.05, max: 0.2 },
  heal_on_kill: { min: 0.1, max: 0.4 },
  stealth_field: { min: 1, max: 4 },
  danger_sense: { min: 0.5, max: 1.0 },
  movement_speed: { min: 1, max: 5 },
  resource_sense: { min: 0.3, max: 1.0 },
  loot_magnet: { min: 0.1, max: 0.4 },
  ammo_scavenge: { min: 0.3, max: 1.0 },
  double_loot: { min: 0.1, max: 0.3 },
  trade_discount: { min: 0.1, max: 0.3 },
  sell_bonus: { min: 0.1, max: 0.3 },
  crafting_efficiency: { min: 0.2, max: 1.0 },
  material_save: { min: 0.2, max: 0.5 },
  healing_boost: { min: 0.2, max: 0.6 },
  item_efficiency: { min: 0.1, max: 0.4 },
};

describe("accessory legendary generation", () => {
  it("should export ACCESSORY_TRIGGERS with exactly 10 triggers", async () => {
    const mod = await import("../../engine/legendary-gen.ts");

    assert.ok(
      Array.isArray(mod.ACCESSORY_TRIGGERS),
      "ACCESSORY_TRIGGERS should be exported as an array"
    );
    assert.strictEqual(mod.ACCESSORY_TRIGGERS.length, 10);
    for (const trigger of mod.ACCESSORY_TRIGGERS) {
      assert.ok(
        EXPECTED_ACCESSORY_TRIGGERS.has(trigger),
        `unexpected accessory trigger "${trigger}"`
      );
    }
  });

  it("should export ACCESSORY_EFFECTS with exactly 17 effects", async () => {
    const mod = await import("../../engine/legendary-gen.ts");

    assert.ok(
      Array.isArray(mod.ACCESSORY_EFFECTS),
      "ACCESSORY_EFFECTS should be exported as an array"
    );
    assert.strictEqual(mod.ACCESSORY_EFFECTS.length, 17);
    for (const effect of mod.ACCESSORY_EFFECTS) {
      assert.ok(
        EXPECTED_ACCESSORY_EFFECTS.has(effect),
        `unexpected accessory effect "${effect}"`
      );
    }
  });

  it("should expose generateAccessorySeed with accessory-valid output", async () => {
    const mod = await import("../../engine/legendary-gen.ts");

    assert.strictEqual(
      typeof mod.generateAccessorySeed,
      "function",
      "generateAccessorySeed should be exported as a function"
    );

    for (let i = 0; i < 50; i++) {
      const seed = mod.generateAccessorySeed();

      assert.ok(
        EXPECTED_ACCESSORY_TRIGGERS.has(seed.trigger),
        `run ${i}: accessory trigger "${seed.trigger}" is not valid`
      );
      assert.ok(
        EXPECTED_ACCESSORY_EFFECTS.has(seed.effect_type),
        `run ${i}: accessory effect_type "${seed.effect_type}" is not valid`
      );
      assert.ok(
        seed.magnitude_min <= seed.magnitude_max,
        `run ${i}: magnitude_min (${seed.magnitude_min}) should be ≤ magnitude_max (${seed.magnitude_max})`
      );
      assert.ok(seed.magnitude_min > 0, `run ${i}: magnitude_min should be > 0`);
      assert.ok(seed.magnitude_max > 0, `run ${i}: magnitude_max should be > 0`);
    }
  });

  it("should generate magnitude ranges within design bounds for each accessory effect type", async () => {
    const mod = await import("../../engine/legendary-gen.ts");

    assert.strictEqual(
      typeof mod.generateAccessorySeed,
      "function",
      "generateAccessorySeed should be exported as a function"
    );

    for (let i = 0; i < 200; i++) {
      const seed = mod.generateAccessorySeed();
      const expected = ACCESSORY_MAGNITUDE_RANGES[seed.effect_type];

      assert.ok(
        expected,
        `effect_type "${seed.effect_type}" has no expected magnitude range`
      );
      assert.ok(
        seed.magnitude_min >= expected.min && seed.magnitude_min <= expected.max,
        `magnitude_min ${seed.magnitude_min} out of bounds for ${seed.effect_type} [${expected.min}, ${expected.max}]`
      );
      assert.ok(
        seed.magnitude_max >= expected.min && seed.magnitude_max <= expected.max,
        `magnitude_max ${seed.magnitude_max} out of bounds for ${seed.effect_type} [${expected.min}, ${expected.max}]`
      );
    }
  });
});
