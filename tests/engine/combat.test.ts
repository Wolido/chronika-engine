import { describe, it } from "node:test";
import assert from "node:assert";
import { combatResolve } from "../../engine/combat.ts";

// ============================================================
// Interfaces
// ============================================================

interface CombatantStats {
  strength: number;
  agility: number;
  endurance: number;
  perception: number;
  intelligence: number;
  willpower: number;
}

interface WeaponStats {
  damage_min: number;
  damage_max: number;
  accuracy: number;      // 0.0 - 1.0
  damage_type: string;
}

interface ElementData {
  element_type: string;  // fire, corrosive, shock, frost, radiation, explosive, venom, void
  proc_chance: number;   // 0.0 - 1.0
}

interface LegendaryData {
  effect_name: string;
  trigger: string;       // on_hit, on_kill, on_crit, etc.
  effect_type: string;   // multiply_damage, lifesteal, aoe_explosion, etc.
  magnitude: number;
}

interface CombatInput {
  attacker: {
    stats: CombatantStats;
    weapon: WeaponStats;
    element?: ElementData;
    legendary?: LegendaryData;
  };
  defender: {
    stats?: CombatantStats;
    evasion: number;      // 0.0 - 1.0
    armor: number;
    hp: number;
  };
}

interface CombatResult {
  hit: boolean;
  hit_roll: number;        // d100 结果
  hit_threshold: number;   // 命中需要 ≤ 的值

  damage_raw: number;      // 基础伤害
  strength_bonus: number;  // 力量加成
  damage_absorbed: number; // 护甲吸收
  damage_final: number;    // 最终伤害
  damage_type: string;

  elemental_proc: boolean;
  elemental_detail?: string;

  legendary_triggered: boolean;
  legendary_detail?: string;
  legendary_hp_restored?: number;

  hp_remaining: number;    // 防御者剩余 HP
  killed: boolean;         // 是否击杀
}

// ============================================================
// Test helpers
// ============================================================

function sampleCombat(overrides: Partial<CombatInput> = {}): CombatInput {
  return {
    attacker: {
      stats: { strength: 8, agility: 5, endurance: 6, perception: 4, intelligence: 3, willpower: 3 },
      weapon: { damage_min: 3, damage_max: 8, accuracy: 0.75, damage_type: "slashing" },
      ...overrides.attacker,
    },
    defender: { evasion: 0.2, armor: 2, hp: 30, ...overrides.defender },
  };
}

// ============================================================
// Tests
// ============================================================

describe("combatResolve", () => {

  // --- 命中判定 -------------------------------------------------

  it("should hit roughly 58% of the time when accuracy=0.78 and evasion=0.2", () => {
    const input = sampleCombat({
      attacker: {
        stats: { strength: 8, agility: 5, endurance: 6, perception: 4, intelligence: 3, willpower: 3 },
        weapon: { damage_min: 5, damage_max: 10, accuracy: 0.8, damage_type: "slashing" },
      },
      defender: { evasion: 0.2, armor: 2, hp: 30 },
    });

    const N = 200;
    let hits = 0;

    for (let i = 0; i < N; i++) {
      const result = combatResolve(input);
      assert.strictEqual(result.hit_threshold, 58, `Expected hit_threshold=58, got ${result.hit_threshold}`);
      hits += result.hit ? 1 : 0;
    }

    assert.ok(
      hits >= 100 && hits <= 132,
      `Expected 100–132 hits out of ${N}, got ${hits}`
    );
  });

  it("should never hit when accuracy=0.3 and evasion=0.6 (threshold negative)", () => {
    const input = sampleCombat({
      attacker: {
        stats: { strength: 8, agility: 5, endurance: 6, perception: 4, intelligence: 3, willpower: 3 },
        weapon: { damage_min: 5, damage_max: 10, accuracy: 0.3, damage_type: "slashing" },
      },
      defender: { evasion: 0.6, armor: 2, hp: 30 },
    });

    for (let i = 0; i < 100; i++) {
      const result = combatResolve(input);
      assert.strictEqual(
        result.hit,
        false,
        `Expected miss but got hit on iteration ${i}`
      );
    }
  });

  // --- 伤害计算 -------------------------------------------------

  it("should calculate damage correctly with strength bonus and armor absorption", () => {
    // 使用 accuracy=1.0, evasion=0.0 保证必定命中，专注验证伤害公式
    const input = sampleCombat({
      attacker: {
        stats: { strength: 8, agility: 5, endurance: 6, perception: 5, intelligence: 3, willpower: 3 },
        weapon: { damage_min: 5, damage_max: 10, accuracy: 1.0, damage_type: "slashing" },
      },
      defender: { evasion: 0.0, armor: 2, hp: 30 },
    });

    for (let i = 0; i < 100; i++) {
      const result = combatResolve(input);

      // damage_raw 在武器伤害范围内
      assert.ok(
        result.damage_raw >= 5 && result.damage_raw <= 10,
        `damage_raw ${result.damage_raw} out of [5,10]`
      );

      // strength_bonus = floor(strength / 4) = 2
      assert.strictEqual(result.strength_bonus, 2);

      // damage_absorbed = min(armor, damage_raw + strength_bonus) = min(2, raw+2) → 2
      const rawTotal = result.damage_raw + result.strength_bonus;
      assert.strictEqual(
        result.damage_absorbed,
        Math.min(2, rawTotal),
        `damage_absorbed ${result.damage_absorbed} != min(2, ${rawTotal})`
      );

      // damage_final = rawTotal - damage_absorbed
      assert.strictEqual(
        result.damage_final,
        rawTotal - result.damage_absorbed,
        `damage_final ${result.damage_final} != ${rawTotal} - ${result.damage_absorbed}`
      );

      assert.strictEqual(result.damage_type, "slashing");
    }
  });

  it("should reduce damage to zero when armor exceeds raw damage significantly", () => {
    // strength=4 → bonus=1; damage_raw ∈ [3,5]; rawTotal ∈ [4,6]; armor=10
    // armor >= any rawTotal → absorb = rawTotal → final = 0
    const input = sampleCombat({
      attacker: {
        stats: { strength: 4, agility: 5, endurance: 6, perception: 5, intelligence: 3, willpower: 3 },
        weapon: { damage_min: 3, damage_max: 5, accuracy: 1.0, damage_type: "piercing" },
      },
      defender: { evasion: 0.0, armor: 10, hp: 30 },
    });

    for (let i = 0; i < 50; i++) {
      const result = combatResolve(input);

      assert.ok(result.damage_raw >= 3 && result.damage_raw <= 5);
      assert.strictEqual(result.strength_bonus, 1);

      // 原始伤害 ≤ 6，护甲 10 → 吸收 = 原始伤害 → 最终 = 0
      assert.ok(
        result.damage_absorbed <= 6,
        `damage_absorbed ${result.damage_absorbed} should be ≤ 6`
      );
      assert.strictEqual(
        result.damage_final,
        0,
        `Expected damage_final=0 but got ${result.damage_final}`
      );
    }
  });

  // --- 元素触发 -------------------------------------------------

  it("should trigger elemental proc roughly 50% of the time when proc_chance=0.5", () => {
    const input = sampleCombat({
      attacker: {
        stats: { strength: 8, agility: 5, endurance: 6, perception: 5, intelligence: 3, willpower: 3 },
        weapon: { damage_min: 5, damage_max: 10, accuracy: 1.0, damage_type: "slashing" },
        element: { element_type: "fire", proc_chance: 0.5 },
      },
      defender: { evasion: 0.0, armor: 2, hp: 30 },
    });

    const N = 200;
    let procs = 0;

    for (let i = 0; i < N; i++) {
      const result = combatResolve(input);
      procs += result.elemental_proc ? 1 : 0;
    }

    assert.ok(
      procs >= 70 && procs <= 130,
      `Expected 70–130 elemental procs out of ${N}, got ${procs}`
    );
  });

  // --- 完整战斗 -------------------------------------------------

  it("should hit, deal damage, and reduce defender HP in a valid combat", () => {
    // accuracy=1.0, evasion=0.0 → 必定命中
    const input = sampleCombat({
      attacker: {
        stats: { strength: 8, agility: 5, endurance: 6, perception: 5, intelligence: 3, willpower: 3 },
        weapon: { damage_min: 5, damage_max: 10, accuracy: 1.0, damage_type: "slashing" },
      },
      defender: { evasion: 0.0, armor: 0, hp: 30 },
    });

    const result = combatResolve(input);

    assert.strictEqual(result.hit, true);
    assert.ok(
      result.damage_final > 0,
      `Expected damage_final > 0, got ${result.damage_final}`
    );
    assert.ok(
      result.hp_remaining < input.defender.hp,
      `hp_remaining ${result.hp_remaining} should be < ${input.defender.hp}`
    );
    // 击杀标志应与 HP 一致
    assert.strictEqual(result.killed, result.hp_remaining <= 0);
  });

  it("should miss and leave defender HP unchanged when accuracy is too low", () => {
    // accuracy=0.0, evasion=1.0 → 永远无法命中
    const input = sampleCombat({
      attacker: {
        stats: { strength: 8, agility: 5, endurance: 6, perception: 4, intelligence: 3, willpower: 3 },
        weapon: { damage_min: 5, damage_max: 10, accuracy: 0.0, damage_type: "slashing" },
      },
      defender: { evasion: 1.0, armor: 2, hp: 30 },
    });

    const result = combatResolve(input);

    assert.strictEqual(result.hit, false);
    assert.strictEqual(
      result.damage_final,
      0,
      `Expected damage_final=0 on miss, got ${result.damage_final}`
    );
    assert.strictEqual(
      result.hp_remaining,
      input.defender.hp,
      `hp_remaining ${result.hp_remaining} should equal initial ${input.defender.hp}`
    );
  });

  // --- 属性影响命中/闪避 ---------------------------------------

  it("should increase defender evasion when agility is high, making hits harder", () => {
    const input = sampleCombat({
      attacker: {
        stats: { strength: 8, agility: 5, endurance: 6, perception: 5, intelligence: 3, willpower: 3 },
        weapon: { damage_min: 5, damage_max: 10, accuracy: 0.8, damage_type: "slashing" },
      },
      defender: { stats: { strength: 8, agility: 15, endurance: 6, perception: 4, intelligence: 3, willpower: 3 }, evasion: 0.2, armor: 2, hp: 30 },
    });

    const result = combatResolve(input);

    assert.strictEqual(result.hit_threshold, 40, `Expected hit_threshold=40 (evasion 0.2 + 0.2 agility bonus), got ${result.hit_threshold}`);
  });

  it("should increase attacker accuracy when perception is high, making hits easier", () => {
    const input = sampleCombat({
      attacker: {
        stats: { strength: 8, agility: 5, endurance: 6, perception: 15, intelligence: 3, willpower: 3 },
        weapon: { damage_min: 5, damage_max: 10, accuracy: 0.8, damage_type: "slashing" },
      },
      defender: { evasion: 0.2, armor: 2, hp: 30 },
    });

    const result = combatResolve(input);

    assert.strictEqual(result.hit_threshold, 80, `Expected hit_threshold=80 (accuracy 0.8 + 0.2 perception bonus), got ${result.hit_threshold}`);
  });

  // --- 传奇武器特效 --------------------------------------------

  // 辅助：必定命中的战斗 + on_hit multiply_damage 传奇
  function hitCombatWithLegendary(effectType: string, magnitude: number): CombatInput {
    return sampleCombat({
      attacker: {
        stats: { strength: 8, agility: 5, endurance: 6, perception: 5, intelligence: 3, willpower: 3 },
        weapon: { damage_min: 7, damage_max: 7, accuracy: 1.0, damage_type: "slashing" },
        legendary: {
          effect_name: "Rending Flames",
          trigger: "on_hit",
          effect_type: effectType,
          magnitude,
        },
      },
      defender: { evasion: 0.0, armor: 2, hp: 30 },
    });
  }

  it("should trigger on_hit legendary and mark legendary_triggered=true when hit", () => {
    // Arrange
    const input = hitCombatWithLegendary("multiply_damage", 2.0);

    // Act
    const result = combatResolve(input);

    // Assert
    assert.strictEqual(result.hit, true);
    assert.strictEqual(
      result.legendary_triggered,
      true,
      `Expected legendary_triggered=true, got ${result.legendary_triggered}`
    );
    assert.ok(
      typeof result.legendary_detail === "string" && result.legendary_detail.length > 0,
      `Expected non-empty legendary_detail, got: ${result.legendary_detail}`
    );
  });

  it("should multiply final damage by legendary magnitude when effect_type is multiply_damage", () => {
    // Arrange: damage_raw=7, strength=8→bonus=2, armor=2 → pre-legend final = 7+2-2 = 7
    const input = hitCombatWithLegendary("multiply_damage", 2.0);

    // Act
    const result = combatResolve(input);

    // Assert: 7 × 2.0 = 14
    assert.strictEqual(result.hit, true);
    assert.strictEqual(result.damage_raw, 7);
    assert.strictEqual(result.strength_bonus, 2);
    assert.strictEqual(result.damage_absorbed, 2);
    assert.strictEqual(
      result.damage_final,
      14,
      `Expected damage_final=14 (7 * 2.0), got ${result.damage_final}`
    );
    assert.strictEqual(result.legendary_triggered, true);
  });

  it("should NOT trigger legendary when attack misses", () => {
    // Arrange: legendary exists but accuracy too low to hit
    const input = sampleCombat({
      attacker: {
        stats: { strength: 8, agility: 5, endurance: 6, perception: 4, intelligence: 3, willpower: 3 },
        weapon: { damage_min: 7, damage_max: 7, accuracy: 0.0, damage_type: "slashing" },
        legendary: {
          effect_name: "Rending Flames",
          trigger: "on_hit",
          effect_type: "multiply_damage",
          magnitude: 2.0,
        },
      },
      defender: { evasion: 1.0, armor: 2, hp: 30 },
    });

    // Act
    const result = combatResolve(input);

    // Assert
    assert.strictEqual(result.hit, false);
    assert.strictEqual(result.damage_final, 0);
    assert.strictEqual(
      result.legendary_triggered,
      false,
      `Expected legendary_triggered=false on miss, got ${result.legendary_triggered}`
    );
    assert.strictEqual(
      result.hp_remaining,
      input.defender.hp,
      "HP should be unchanged on miss"
    );
  });

  it("should calculate multiply_damage correctly stacking with strength bonus and armor", () => {
    // Arrange: damage_raw=7, strength=8→bonus=2, armor=2
    // pre-legend: 7+2-2=7, magnitude=2.0 → final=14
    const input = sampleCombat({
      attacker: {
        stats: { strength: 8, agility: 5, endurance: 6, perception: 5, intelligence: 3, willpower: 3 },
        weapon: { damage_min: 7, damage_max: 7, accuracy: 1.0, damage_type: "piercing" },
        legendary: {
          effect_name: "Void Strike",
          trigger: "on_hit",
          effect_type: "multiply_damage",
          magnitude: 2.0,
        },
      },
      defender: { evasion: 0.0, armor: 2, hp: 50 },
    });

    // Act
    const result = combatResolve(input);

    // Assert: (7 + 2 - 2) × 2.0 = 14
    assert.strictEqual(result.hit, true);
    assert.strictEqual(result.damage_raw, 7);
    assert.strictEqual(result.strength_bonus, 2);
    assert.strictEqual(result.damage_absorbed, 2);
    assert.strictEqual(
      result.damage_final,
      14,
      `Expected damage_final=14, got ${result.damage_final}`
    );
    assert.strictEqual(result.legendary_triggered, true);
  });

  it("should restore HP when legendary effect_type is lifesteal", () => {
    // Arrange: damage_raw=10, no armor → final=12 (10+2), lifesteal=0.3 → restore 3.6 → floor 3
    const input = sampleCombat({
      attacker: {
        stats: { strength: 8, agility: 5, endurance: 6, perception: 5, intelligence: 3, willpower: 3 },
        weapon: { damage_min: 10, damage_max: 10, accuracy: 1.0, damage_type: "slashing" },
        legendary: {
          effect_name: "Soul Drinker",
          trigger: "on_hit",
          effect_type: "lifesteal",
          magnitude: 0.3,
        },
      },
      defender: { evasion: 0.0, armor: 0, hp: 50 },
    });

    // Act
    const result = combatResolve(input);

    // Assert: damage_final=12, lifesteal 0.3 → 3.6 → floor 3
    assert.strictEqual(result.hit, true);
    assert.strictEqual(result.damage_raw, 10);
    assert.strictEqual(result.strength_bonus, 2);
    assert.strictEqual(result.damage_final, 12);
    assert.strictEqual(result.legendary_triggered, true);
    assert.strictEqual(
      result.legendary_hp_restored,
      3,
      `Expected legendary_hp_restored=3 (12 * 0.3), got ${result.legendary_hp_restored}`
    );
  });

});
