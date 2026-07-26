import { describe, it } from "node:test";
import assert from "node:assert";
import { combatResolve } from "../../engine/combat.ts";

// ============================================================
// Interfaces (Cycle 1: weapon affix revisions + armor legendary)
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
  accuracy: number;
  damage_type: string;
}

interface ElementData {
  element_type: string;
  proc_chance: number;
}

type CombatFlag =
  | "stealth"
  | "counter_attack"
  | "reload"
  | "empty_mag"
  | "full_mag"
  | "weapon_jam"
  | "first_blood"
  | "reflect"
  | "dodge"
  | "parry"
  | "combat_start";

interface LegendaryData {
  effect_name: string;
  trigger: string;
  effect_type: string;
  magnitude: number;
}

interface AccessoryData {
  name: string;
  trigger: string;
  effect_type: string;
  magnitude: number;
}

interface CombatInput {
  attacker: {
    stats: CombatantStats;
    weapon: WeaponStats;
    crit_chance?: number;
    flags?: CombatFlag[];
    hp?: number;
    hp_max?: number;
    ammo?: number;
    max_ammo?: number;
    element?: ElementData;
    legendary?: LegendaryData;
    accessories?: AccessoryData[];
  };
  defender: {
    stats?: CombatantStats;
    evasion: number;
    armor: number;
    hp: number;
    hp_max?: number;
    armor_legendary?: LegendaryData;
  };
}

interface CombatResult {
  hit: boolean;
  hit_roll: number;
  hit_threshold: number;

  crit: boolean;
  crit_roll: number;
  crit_threshold: number;

  damage_raw: number;
  strength_bonus: number;
  damage_absorbed: number;
  damage_final: number;
  damage_type: string;

  elemental_proc: boolean;
  elemental_detail?: string;

  legendary_triggered: boolean;
  legendary_detail?: string;
  legendary_hp_restored?: number;
  legendary_aoe_damage?: number;
  legendary_chain_damage?: number;
  legendary_chain_targets?: number;
  legendary_shield?: number;
  legendary_ammo_change?: number;
  legendary_reflect_damage?: number;
  legendary_status_on_defender?: string[];
  legendary_status_on_attacker?: string[];
  legendary_summon?: boolean;
  legendary_fear?: boolean;
  legendary_disarm?: boolean;

  armor_legendary_triggered: boolean;
  armor_legendary_detail?: string;
  armor_legendary_thorns?: number;
  armor_legendary_reflect?: number;
  armor_legendary_hp_restored?: number;
  armor_legendary_aoe?: number;
  armor_legendary_heal_on_kill?: number;
  armor_legendary_status_on_wearer?: string[];
  armor_legendary_status_on_attacker?: string[];
  armor_legendary_damage_reduced?: number;
  armor_legendary_emergency_heal?: number;
  armor_legendary_fear_aura?: boolean;
  armor_legendary_last_stand?: boolean;
  armor_legendary_retribution?: number;
  armor_legendary_cleansed?: string[];

  accessory_xp_boost?: number;
  accessory_second_wind?: boolean;
  accessory_lucky_crit_bonus?: number;
  accessory_heal_on_kill?: number;

  hp_remaining: number;
  killed: boolean;
}

// ============================================================
// Test helpers
// ============================================================

function sampleCombat(overrides: Partial<CombatInput> = {}): CombatInput {
  return {
    attacker: {
      stats: { strength: 8, agility: 5, endurance: 6, perception: 4, intelligence: 3, willpower: 3 },
      weapon: { damage_min: 3, damage_max: 8, accuracy: 0.75, damage_type: "slashing" },
      crit_chance: 0,
      flags: [],
      ...overrides.attacker,
    },
    defender: { evasion: 0.2, armor: 2, hp: 30, hp_max: 30, ...overrides.defender },
  };
}

function baseHitCombat(overrides: Partial<CombatInput> = {}): CombatInput {
  return sampleCombat({
    attacker: {
      stats: { strength: 8, agility: 5, endurance: 6, perception: 5, intelligence: 3, willpower: 3 },
      weapon: { damage_min: 7, damage_max: 7, accuracy: 1.0, damage_type: "slashing" },
      ...overrides.attacker,
    },
    defender: { evasion: 0.0, armor: 2, hp: 50, hp_max: 50, ...overrides.defender },
  });
}

function legendaryCombat(trigger: string, effectType: string, magnitude: number): CombatInput {
  return baseHitCombat({
    attacker: {
      legendary: {
        effect_name: "Test Legendary",
        trigger,
        effect_type: effectType,
        magnitude,
      },
    },
  });
}

function armorLegendaryCombat(
  trigger: string,
  effectType: string,
  magnitude: number,
  overrides: Partial<CombatInput> = {}
): CombatInput {
  return baseHitCombat({
    attacker: overrides.attacker,
    defender: {
      armor_legendary: {
        effect_name: "Test Armor Legendary",
        trigger,
        effect_type: effectType,
        magnitude,
      },
      ...overrides.defender,
    },
  });
}

function accessoryCombat(trigger: string, effectType: string, magnitude: number, overrides: Partial<CombatInput> = {}): CombatInput {
  return baseHitCombat({
    attacker: {
      accessories: [{ name: "Test Accessory", trigger, effect_type: effectType, magnitude }],
      ...overrides.attacker,
    },
    defender: { ...overrides.defender },
  });
}

// ============================================================
// Tests
// ============================================================

describe("combatResolve", () => {

  // --- 命中判定 -------------------------------------------------

  it("should always hit when effective accuracy far exceeds evasion", () => {
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
      assert.strictEqual(result.hit_threshold, 100, `Expected hit_threshold=100, got ${result.hit_threshold}`);
      hits += result.hit ? 1 : 0;
    }

    assert.strictEqual(
      hits,
      N,
      `Expected ${N} hits out of ${N}, got ${hits}`
    );
  });

  it("should never hit when threshold is capped at 0", () => {
    const input = sampleCombat({
      attacker: {
        stats: { strength: 8, agility: 5, endurance: 6, perception: 4, intelligence: 3, willpower: 3 },
        weapon: { damage_min: 5, damage_max: 10, accuracy: 0.1, damage_type: "slashing" },
      },
      defender: { evasion: 0.7, armor: 2, hp: 30 },
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

  it("should have ~70% hit chance for normal weapon vs normal monster", () => {
    // accuracy=0.6, evasion=0.3 → (0.5 + 0.6 - 0.3) × 100 = 80
    const input = sampleCombat({
      attacker: { weapon: { damage_min: 5, damage_max: 5, accuracy: 0.6, damage_type: "slashing" } },
      defender: { evasion: 0.3, armor: 0, hp: 100 },
    });
    const result = combatResolve(input);
    assert.strictEqual(result.hit_threshold, 80); // was 30 with old formula
  });

  it("should still have >0% for low accuracy vs high evasion", () => {
    // accuracy=0.4, evasion=0.6 → (0.5 + 0.4 - 0.6) × 100 = 30
    const input = sampleCombat({
      attacker: { weapon: { damage_min: 5, damage_max: 5, accuracy: 0.4, damage_type: "slashing" } },
      defender: { evasion: 0.6, armor: 0, hp: 100 },
    });
    const result = combatResolve(input);
    assert.strictEqual(result.hit_threshold, 30); // was 0 (capped) with old formula
  });

  it("should cap at 100 for very high accuracy", () => {
    // accuracy=1.0, evasion=0 → (0.5 + 1.0 - 0) × 100 = 150 → capped 100
    const input = sampleCombat({
      attacker: { weapon: { damage_min: 5, damage_max: 5, accuracy: 1.0, damage_type: "slashing" } },
      defender: { evasion: 0, armor: 0, hp: 100 },
    });
    const result = combatResolve(input);
    assert.strictEqual(result.hit_threshold, 100);
  });

  it("should not go below 0", () => {
    // accuracy=0.1, evasion=0.9 → (0.5 + 0.1 - 0.9) × 100 = -30 → capped 0
    const input = sampleCombat({
      attacker: { weapon: { damage_min: 5, damage_max: 5, accuracy: 0.1, damage_type: "slashing" } },
      defender: { evasion: 0.9, armor: 0, hp: 100 },
    });
    const result = combatResolve(input);
    assert.strictEqual(result.hit_threshold, 0);
  });

  // --- 暴击系统 -------------------------------------------------

  it("should always crit when crit_chance=1.0 and multiply damage by 1.5", () => {
    const input = baseHitCombat({
      attacker: { crit_chance: 1.0 },
    });

    const result = combatResolve(input);

    assert.strictEqual(result.hit, true);
    assert.strictEqual(result.crit, true);
    assert.strictEqual(result.crit_threshold, 100);
    assert.ok(result.crit_roll <= result.crit_threshold);
    assert.strictEqual(
      result.damage_final,
      Math.round((7 + 2 - 2) * 1.5),
      `expected crit damage, got ${result.damage_final}`
    );
  });

  it("should never crit when crit_chance=0.0", () => {
    const input = baseHitCombat({
      attacker: { crit_chance: 0.0 },
    });

    const result = combatResolve(input);

    assert.strictEqual(result.crit, false);
  });

  // --- 伤害计算 -------------------------------------------------

  it("should calculate damage correctly with strength bonus and armor absorption", () => {
    const input = baseHitCombat({
      attacker: {
        stats: { strength: 8, agility: 5, endurance: 6, perception: 5, intelligence: 3, willpower: 3 },
      },
      defender: { armor: 2, hp: 30, hp_max: 30 },
    });

    for (let i = 0; i < 100; i++) {
      const result = combatResolve(input);

      assert.ok(
        result.damage_raw >= 5 && result.damage_raw <= 10,
        `damage_raw ${result.damage_raw} out of [5,10]`
      );

      assert.strictEqual(result.strength_bonus, 2);

      const rawTotal = result.damage_raw + result.strength_bonus;
      assert.strictEqual(
        result.damage_absorbed,
        Math.min(2, rawTotal),
        `damage_absorbed ${result.damage_absorbed} != min(2, ${rawTotal})`
      );

      assert.strictEqual(
        result.damage_final,
        rawTotal - result.damage_absorbed,
        `damage_final ${result.damage_final} != ${rawTotal} - ${result.damage_absorbed}`
      );

      assert.strictEqual(result.damage_type, "slashing");
    }
  });

  it("should reduce damage to zero when armor exceeds raw damage significantly", () => {
    const input = baseHitCombat({
      attacker: {
        stats: { strength: 4, agility: 5, endurance: 6, perception: 5, intelligence: 3, willpower: 3 },
        weapon: { damage_min: 3, damage_max: 5, accuracy: 1.0, damage_type: "piercing" },
      },
      defender: { armor: 10, hp: 30, hp_max: 30 },
    });

    for (let i = 0; i < 50; i++) {
      const result = combatResolve(input);

      assert.ok(result.damage_raw >= 3 && result.damage_raw <= 5);
      assert.strictEqual(result.strength_bonus, 1);
      assert.ok(result.damage_absorbed <= 6);
      assert.strictEqual(
        result.damage_final,
        0,
        `Expected damage_final=0 but got ${result.damage_final}`
      );
    }
  });

  // --- 元素触发 -------------------------------------------------

  it("should trigger elemental proc roughly 50% of the time when proc_chance=0.5", () => {
    const input = baseHitCombat({
      attacker: {
        element: { element_type: "fire", proc_chance: 0.5 },
      },
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
    const input = baseHitCombat({
      attacker: {
        weapon: { damage_min: 5, damage_max: 10, accuracy: 1.0, damage_type: "slashing" },
      },
      defender: { armor: 0, hp: 30, hp_max: 30 },
    });

    const result = combatResolve(input);

    assert.strictEqual(result.hit, true);
    assert.ok(result.damage_final > 0);
    assert.ok(result.hp_remaining < input.defender.hp);
    assert.strictEqual(result.killed, result.hp_remaining <= 0);
  });

  it("should miss and leave defender HP unchanged when accuracy is too low", () => {
    const input = sampleCombat({
      attacker: {
        weapon: { damage_min: 5, damage_max: 10, accuracy: 0.0, damage_type: "slashing" },
      },
      defender: { evasion: 1.0, armor: 2, hp: 30, hp_max: 30 },
    });

    const result = combatResolve(input);

    assert.strictEqual(result.hit, false);
    assert.strictEqual(result.damage_final, 0);
    assert.strictEqual(result.hp_remaining, input.defender.hp);
    assert.strictEqual(result.killed, false);
  });

  // --- 属性影响命中/闪避 ---------------------------------------

  it("should increase defender evasion when agility is high, making hits harder", () => {
    const input = sampleCombat({
      attacker: {
        stats: { strength: 8, agility: 5, endurance: 6, perception: 5, intelligence: 3, willpower: 3 },
        weapon: { damage_min: 5, damage_max: 10, accuracy: 0.8, damage_type: "slashing" },
      },
      defender: {
        stats: { strength: 8, agility: 15, endurance: 6, perception: 4, intelligence: 3, willpower: 3 },
        evasion: 0.2,
        armor: 2,
        hp: 30,
      },
    });

    const result = combatResolve(input);
    assert.strictEqual(result.hit_threshold, 90, `Expected hit_threshold=90, got ${result.hit_threshold}`);
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
    assert.strictEqual(result.hit_threshold, 100, `Expected hit_threshold=100, got ${result.hit_threshold}`);
  });

  // --- 传奇武器特效 (25×25) ------------------------------------

  it("should trigger on_hit multiply_damage and multiply final damage", () => {
    const input = legendaryCombat("on_hit", "multiply_damage", 2.0);

    const result = combatResolve(input);

    assert.strictEqual(result.hit, true);
    assert.strictEqual(result.legendary_triggered, true);
    assert.strictEqual(result.damage_final, 14);
  });

  it("should trigger on_crit multiply_damage when the attack is a critical hit", () => {
    const input = legendaryCombat("on_crit", "multiply_damage", 2.0);
    input.attacker.crit_chance = 1.0;

    const result = combatResolve(input);

    assert.strictEqual(result.crit, true);
    assert.strictEqual(result.legendary_triggered, true);
  });

  it("should trigger on_miss legendary even when the attack misses", () => {
    const input = sampleCombat({
      attacker: {
        weapon: { damage_min: 5, damage_max: 5, accuracy: 0.0, damage_type: "slashing" },
        crit_chance: 0,
        legendary: {
          effect_name: "Missile Echo",
          trigger: "on_miss",
          effect_type: "reflect_damage",
          magnitude: 1.0,
        },
      },
      defender: { evasion: 1.0, armor: 0, hp: 30, hp_max: 30 },
    });

    const result = combatResolve(input);

    assert.strictEqual(result.hit, false);
    assert.strictEqual(result.legendary_triggered, true);
    assert.ok(
      typeof result.legendary_detail === "string" && result.legendary_detail.length > 0,
      "expected legendary_detail on miss"
    );
  });

  it("should trigger on_kill summon_ally when the defender is killed", () => {
    const input = legendaryCombat("on_kill", "summon_ally", 1.0);
    input.defender.hp = 1;

    const result = combatResolve(input);

    assert.strictEqual(result.killed, true);
    assert.strictEqual(result.legendary_triggered, true);
    assert.strictEqual(result.legendary_summon, true);
  });

  it("should deal higher final damage with armor_pierce than without", () => {
    const baseInput = baseHitCombat({ defender: { armor: 10, hp: 100, hp_max: 100 } });
    const apInput = baseHitCombat({
      defender: { armor: 10, hp: 100, hp_max: 100 },
      attacker: {
        legendary: {
          effect_name: "Armor Bane",
          trigger: "on_hit",
          effect_type: "armor_pierce",
          magnitude: 1.0,
        },
      },
    });

    const baseResult = combatResolve(baseInput);
    const apResult = combatResolve(apInput);

    assert.ok(
      apResult.damage_final > baseResult.damage_final,
      `armor_pierce final ${apResult.damage_final} should exceed base ${baseResult.damage_final}`
    );
  });

  it("should return stun status on defender when effect_type is stun", () => {
    const input = legendaryCombat("on_hit", "stun", 1.0);

    const result = combatResolve(input);

    assert.strictEqual(result.legendary_triggered, true);
    assert.ok(
      result.legendary_status_on_defender?.includes("stun"),
      `expected stun status, got ${JSON.stringify(result.legendary_status_on_defender)}`
    );
  });

  it("should return bleed status on defender when effect_type is bleed", () => {
    const input = legendaryCombat("on_hit", "bleed", 1.0);

    const result = combatResolve(input);

    assert.ok(
      result.legendary_status_on_defender?.includes("bleed"),
      `expected bleed status, got ${JSON.stringify(result.legendary_status_on_defender)}`
    );
  });

  it("should return burn status on defender when effect_type is burn", () => {
    const input = legendaryCombat("on_hit", "burn", 1.0);

    const result = combatResolve(input);

    assert.ok(
      result.legendary_status_on_defender?.includes("burn"),
      `expected burn status, got ${JSON.stringify(result.legendary_status_on_defender)}`
    );
  });

  it("should return poison status on defender when effect_type is poison", () => {
    const input = legendaryCombat("on_hit", "poison", 1.0);

    const result = combatResolve(input);

    assert.ok(
      result.legendary_status_on_defender?.includes("poison"),
      `expected poison status, got ${JSON.stringify(result.legendary_status_on_defender)}`
    );
  });

  it("should return buff_attack status on attacker when effect_type is buff_attack", () => {
    const input = legendaryCombat("on_hit", "buff_attack", 1.0);

    const result = combatResolve(input);

    assert.ok(
      result.legendary_status_on_attacker?.includes("buff_attack"),
      `expected buff_attack status, got ${JSON.stringify(result.legendary_status_on_attacker)}`
    );
  });

  it("should return buff_accuracy status on attacker when effect_type is buff_accuracy", () => {
    const input = legendaryCombat("on_hit", "buff_accuracy", 1.0);

    const result = combatResolve(input);

    assert.ok(
      result.legendary_status_on_attacker?.includes("buff_accuracy"),
      `expected buff_accuracy status, got ${JSON.stringify(result.legendary_status_on_attacker)}`
    );
  });

  it("should return buff_evasion status on attacker when effect_type is buff_evasion", () => {
    const input = legendaryCombat("on_hit", "buff_evasion", 1.0);

    const result = combatResolve(input);

    assert.ok(
      result.legendary_status_on_attacker?.includes("buff_evasion"),
      `expected buff_evasion status, got ${JSON.stringify(result.legendary_status_on_attacker)}`
    );
  });

  it("should return legendary_shield > 0 when effect_type is shield", () => {
    const input = legendaryCombat("on_hit", "shield", 1.0);

    const result = combatResolve(input);

    assert.ok(
      (result.legendary_shield ?? 0) > 0,
      `expected legendary_shield > 0, got ${result.legendary_shield}`
    );
  });

  it("should return legendary_ammo_change > 0 when effect_type is refill_ammo", () => {
    const input = baseHitCombat({
      attacker: {
        weapon: { damage_min: 5, damage_max: 5, accuracy: 1.0, damage_type: "ballistic" },
        ammo: 0,
        max_ammo: 10,
        legendary: {
          effect_name: "Resupply",
          trigger: "on_empty_mag",
          effect_type: "refill_ammo",
          magnitude: 0.5,
        },
      },
    });

    const result = combatResolve(input);

    assert.ok(
      (result.legendary_ammo_change ?? 0) > 0,
      `expected legendary_ammo_change > 0, got ${result.legendary_ammo_change}`
    );
  });

  it("should return legendary_aoe_damage > 0 when effect_type is aoe_explosion", () => {
    const input = legendaryCombat("on_hit", "aoe_explosion", 2.0);

    const result = combatResolve(input);

    assert.ok(
      (result.legendary_aoe_damage ?? 0) > 0,
      `expected legendary_aoe_damage > 0, got ${result.legendary_aoe_damage}`
    );
  });

  it("should return legendary_chain_damage and legendary_chain_targets when effect_type is chain_lightning", () => {
    const input = legendaryCombat("on_hit", "chain_lightning", 2.0);

    const result = combatResolve(input);

    assert.ok(
      (result.legendary_chain_damage ?? 0) > 0,
      `expected legendary_chain_damage > 0, got ${result.legendary_chain_damage}`
    );
    assert.ok(
      (result.legendary_chain_targets ?? 0) > 0,
      `expected legendary_chain_targets > 0, got ${result.legendary_chain_targets}`
    );
  });

  it("should restore HP when effect_type is lifesteal", () => {
    const input = baseHitCombat({
      attacker: {
        weapon: { damage_min: 10, damage_max: 10, accuracy: 1.0, damage_type: "slashing" },
        legendary: {
          effect_name: "Soul Drinker",
          trigger: "on_hit",
          effect_type: "lifesteal",
          magnitude: 0.3,
        },
      },
      defender: { armor: 0, hp: 50, hp_max: 50 },
    });

    const result = combatResolve(input);

    assert.strictEqual(result.damage_final, 12);
    assert.strictEqual(result.legendary_hp_restored, 3);
  });

  it("should trigger on_low_attacker_hp when attacker HP is at or below 25%", () => {
    const input = legendaryCombat("on_low_attacker_hp", "multiply_damage", 2.0);
    input.attacker.hp = 10;
    input.attacker.hp_max = 40;

    const result = combatResolve(input);

    assert.strictEqual(result.legendary_triggered, true);
  });

  it("should trigger on_parry when attacker flags include parry and attack misses", () => {
    const input = sampleCombat({
      attacker: {
        weapon: { damage_min: 5, damage_max: 5, accuracy: 0.0, damage_type: "slashing" },
        flags: ["parry"],
        legendary: {
          effect_name: "Riposte",
          trigger: "on_parry",
          effect_type: "reflect_damage",
          magnitude: 1.0,
        },
      },
      defender: { evasion: 1.0, armor: 0, hp: 30, hp_max: 30 },
    });

    const result = combatResolve(input);

    assert.strictEqual(result.hit, false);
    assert.strictEqual(result.legendary_triggered, true);
  });

  it("should trigger on_empty_mag when attacker flags include empty_mag", () => {
    const input = baseHitCombat({
      attacker: {
        flags: ["empty_mag"],
        legendary: {
          effect_name: "Dry Fire",
          trigger: "on_empty_mag",
          effect_type: "refill_ammo",
          magnitude: 1.0,
        },
      },
    });

    const result = combatResolve(input);

    assert.strictEqual(result.legendary_triggered, true);
    assert.ok((result.legendary_ammo_change ?? 0) > 0);
  });

  it("should trigger on_full_mag when attacker flags include full_mag", () => {
    const input = baseHitCombat({
      attacker: {
        flags: ["full_mag"],
        ammo: 10,
        max_ammo: 10,
        legendary: {
          effect_name: "Overflow",
          trigger: "on_full_mag",
          effect_type: "shield",
          magnitude: 1.0,
        },
      },
    });

    const result = combatResolve(input);

    assert.strictEqual(result.legendary_triggered, true);
    assert.ok((result.legendary_shield ?? 0) > 0);
  });

  it("should trigger on_stealth_attack when attacker flags include stealth", () => {
    const input = baseHitCombat({
      attacker: {
        flags: ["stealth"],
        legendary: {
          effect_name: "Shadow Strike",
          trigger: "on_stealth_attack",
          effect_type: "multiply_damage",
          magnitude: 2.0,
        },
      },
    });

    const result = combatResolve(input);

    assert.strictEqual(result.hit, true);
    assert.strictEqual(result.legendary_triggered, true);
  });

  it("should set legendary_fear and apply mental_break status when effect_type is mental_break", () => {
    const input = legendaryCombat("on_hit", "mental_break", 1.0);

    const result = combatResolve(input);

    assert.strictEqual(result.legendary_triggered, true);
    assert.strictEqual(result.legendary_fear, true);
    assert.ok(
      result.legendary_status_on_defender?.includes("mental_break"),
      `expected mental_break status, got ${JSON.stringify(result.legendary_status_on_defender)}`
    );
  });

  it("should set legendary_disarm and apply disarm status when effect_type is disarm", () => {
    const input = legendaryCombat("on_hit", "disarm", 1.0);

    const result = combatResolve(input);

    assert.strictEqual(result.legendary_triggered, true);
    assert.strictEqual(result.legendary_disarm, true);
    assert.ok(
      result.legendary_status_on_defender?.includes("disarm"),
      `expected disarm status, got ${JSON.stringify(result.legendary_status_on_defender)}`
    );
  });

  it("should return debuff_attack status on defender when effect_type is debuff_attack", () => {
    const input = legendaryCombat("on_hit", "debuff_attack", 1.0);

    const result = combatResolve(input);

    assert.ok(
      result.legendary_status_on_defender?.includes("debuff_attack"),
      `expected debuff_attack status, got ${JSON.stringify(result.legendary_status_on_defender)}`
    );
  });

  it("should return debuff_defense status on defender when effect_type is debuff_defense", () => {
    const input = legendaryCombat("on_hit", "debuff_defense", 1.0);

    const result = combatResolve(input);

    assert.ok(
      result.legendary_status_on_defender?.includes("debuff_defense"),
      `expected debuff_defense status, got ${JSON.stringify(result.legendary_status_on_defender)}`
    );
  });

  it("should trigger multiple legendary effects when multiple conditions are satisfied", () => {
    const input = baseHitCombat({
      attacker: {
        crit_chance: 1.0,
        legendary: {
          effect_name: "Twin Furies",
          trigger: "on_crit",
          effect_type: "multiply_damage",
          magnitude: 2.0,
        },
      },
    });

    const result = combatResolve(input);

    assert.strictEqual(result.crit, true);
    assert.strictEqual(result.legendary_triggered, true);
    assert.ok(
      result.legendary_detail?.toLowerCase().includes("crit") ||
        result.damage_final > 10,
      `expected crit legendary to influence result, got damage=${result.damage_final}, detail=${result.legendary_detail}`
    );
  });

  // --- on_ammo_low 触发器 ---------------------------------------

  it("should trigger on_ammo_low when ammo is 30% or less of max_ammo and greater than 0", () => {
    const input = baseHitCombat({
      attacker: {
        weapon: { damage_min: 5, damage_max: 5, accuracy: 1.0, damage_type: "ballistic" },
        ammo: 3,
        max_ammo: 10,
        legendary: {
          effect_name: "Low Pulse",
          trigger: "on_ammo_low",
          effect_type: "multiply_damage",
          magnitude: 2.0,
        },
      },
    });

    const result = combatResolve(input);

    assert.strictEqual(result.legendary_triggered, true);
  });

  it("should not trigger on_ammo_low when ammo is above 30% of max_ammo", () => {
    const input = baseHitCombat({
      attacker: {
        weapon: { damage_min: 5, damage_max: 5, accuracy: 1.0, damage_type: "ballistic" },
        ammo: 5,
        max_ammo: 10,
        legendary: {
          effect_name: "Low Pulse",
          trigger: "on_ammo_low",
          effect_type: "multiply_damage",
          magnitude: 2.0,
        },
      },
    });

    const result = combatResolve(input);

    assert.strictEqual(result.legendary_triggered, false);
  });

  it("should not trigger on_ammo_low when ammo is undefined", () => {
    const input = baseHitCombat({
      attacker: {
        weapon: { damage_min: 5, damage_max: 5, accuracy: 1.0, damage_type: "ballistic" },
        legendary: {
          effect_name: "Low Pulse",
          trigger: "on_ammo_low",
          effect_type: "multiply_damage",
          magnitude: 2.0,
        },
      },
    });

    const result = combatResolve(input);

    assert.strictEqual(result.legendary_triggered, false);
  });

  it("should not trigger on_ammo_low when ammo is 0 (belongs to on_empty_mag)", () => {
    const input = baseHitCombat({
      attacker: {
        weapon: { damage_min: 5, damage_max: 5, accuracy: 1.0, damage_type: "ballistic" },
        ammo: 0,
        max_ammo: 10,
        legendary: {
          effect_name: "Low Pulse",
          trigger: "on_ammo_low",
          effect_type: "multiply_damage",
          magnitude: 2.0,
        },
      },
    });

    const result = combatResolve(input);

    assert.strictEqual(result.legendary_triggered, false);
  });

  // --- 防具传奇系统 --------------------------------------------

  it("should trigger armor_legendary on_hit_taken and apply thorns damage", () => {
    const input = armorLegendaryCombat("on_hit_taken", "thorns", 5.0);

    const result = combatResolve(input);

    assert.strictEqual(result.armor_legendary_triggered, true);
    assert.ok(
      (result.armor_legendary_thorns ?? 0) > 0,
      `expected armor_legendary_thorns > 0, got ${result.armor_legendary_thorns}`
    );
  });

  it("should reduce final damage when armor_legendary has damage_reduction", () => {
    const baseInput = baseHitCombat({ defender: { armor: 0, hp: 100, hp_max: 100 } });
    const armoredInput = armorLegendaryCombat(
      "on_hit_taken",
      "damage_reduction",
      0.5,
      { defender: { armor: 0, hp: 100, hp_max: 100 } }
    );

    const baseResult = combatResolve(baseInput);
    const armoredResult = combatResolve(armoredInput);

    assert.ok(
      armoredResult.damage_final < baseResult.damage_final,
      `armored damage ${armoredResult.damage_final} should be lower than base ${baseResult.damage_final}`
    );
    assert.ok(
      (armoredResult.armor_legendary_damage_reduced ?? 0) > 0,
      `expected armor_legendary_damage_reduced > 0, got ${armoredResult.armor_legendary_damage_reduced}`
    );
  });

  it("should trigger armor_legendary flat_damage_block on_block", () => {
    const input = armorLegendaryCombat(
      "on_block",
      "flat_damage_block",
      3.0,
      { defender: { armor: 5, hp: 100, hp_max: 100 } }
    );

    const result = combatResolve(input);

    assert.strictEqual(result.armor_legendary_triggered, true);
    assert.ok(
      (result.armor_legendary_damage_reduced ?? 0) > 0 || result.damage_final < 7,
      `expected some damage reduction from flat block, got damage_final=${result.damage_final}, reduced=${result.armor_legendary_damage_reduced}`
    );
  });

  it("should reflect percent damage on_crit_taken with reflect_percent", () => {
    const input = armorLegendaryCombat(
      "on_crit_taken",
      "reflect_percent",
      0.5,
      {
        attacker: { crit_chance: 1.0 },
        defender: { armor: 0, hp: 100, hp_max: 100 },
      }
    );

    const result = combatResolve(input);

    assert.strictEqual(result.crit, true);
    assert.strictEqual(result.armor_legendary_triggered, true);
    assert.ok(
      (result.armor_legendary_reflect ?? 0) > 0,
      `expected armor_legendary_reflect > 0, got ${result.armor_legendary_reflect}`
    );
  });

  it("should apply hp_regen hot status when armor_legendary trigger is passive", () => {
    const input = armorLegendaryCombat("passive", "hp_regen", 5.0);

    const result = combatResolve(input);

    assert.strictEqual(result.armor_legendary_triggered, true);
    assert.ok(
      result.armor_legendary_status_on_wearer?.some((s) =>
        s.toLowerCase().includes("hot") || s.toLowerCase().includes("regen")
      ),
      `expected hot/regen status on wearer, got ${JSON.stringify(result.armor_legendary_status_on_wearer)}`
    );
  });

  it("should emergency_heal when wearer HP is at or below 10%", () => {
    const input = armorLegendaryCombat(
      "on_critical_hp",
      "emergency_heal",
      0.2,
      { defender: { hp: 5, hp_max: 100 } }
    );

    const result = combatResolve(input);

    assert.strictEqual(result.armor_legendary_triggered, true);
    assert.ok(
      (result.armor_legendary_emergency_heal ?? 0) > 0,
      `expected armor_legendary_emergency_heal > 0, got ${result.armor_legendary_emergency_heal}`
    );
  });

  it("should heal_on_kill when on_kill_response triggers on a kill", () => {
    const input = armorLegendaryCombat(
      "on_kill_response",
      "heal_on_kill",
      0.3,
      { defender: { hp: 1, hp_max: 100 } }
    );

    const result = combatResolve(input);

    assert.strictEqual(result.killed, true);
    assert.strictEqual(result.armor_legendary_triggered, true);
    assert.ok(
      (result.armor_legendary_heal_on_kill ?? 0) > 0,
      `expected armor_legendary_heal_on_kill > 0, got ${result.armor_legendary_heal_on_kill}`
    );
  });

  it("should create explosive AOE on_heavy_damage with explosive_retaliation", () => {
    const input = armorLegendaryCombat(
      "on_heavy_damage",
      "explosive_retaliation",
      0.5,
      {
        attacker: {
          weapon: { damage_min: 20, damage_max: 20, accuracy: 1.0, damage_type: "blunt" },
        },
        defender: { armor: 2, hp: 100, hp_max: 30 },
      }
    );

    const result = combatResolve(input);

    assert.strictEqual(result.armor_legendary_triggered, true);
    assert.ok(
      (result.armor_legendary_aoe ?? 0) > 0,
      `expected armor_legendary_aoe > 0, got ${result.armor_legendary_aoe}`
    );
  });

  it("should absorb elemental hit into HP with elemental_absorption", () => {
    const input = armorLegendaryCombat(
      "on_elemental_hit",
      "elemental_absorption",
      0.5,
      {
        attacker: {
          element: { element_type: "fire", proc_chance: 1.0 },
        },
        defender: { armor: 0, hp: 100, hp_max: 100 },
      }
    );

    const result = combatResolve(input);

    assert.strictEqual(result.elemental_proc, true);
    assert.strictEqual(result.armor_legendary_triggered, true);
    assert.ok(
      (result.armor_legendary_hp_restored ?? 0) > 0,
      `expected armor_legendary_hp_restored > 0, got ${result.armor_legendary_hp_restored}`
    );
  });

  it("should cleanse debuff with status_cleanse when on_debuff_received", () => {
    const input = baseHitCombat({
      attacker: {
        legendary: {
          effect_name: "Stunning Blow",
          trigger: "on_hit",
          effect_type: "stun",
          magnitude: 1.0,
        },
      },
      defender: {
        armor_legendary: {
          effect_name: "Purifying Plate",
          trigger: "on_debuff_received",
          effect_type: "status_cleanse",
          magnitude: 1.0,
        },
        hp: 100,
        hp_max: 100,
      },
    });

    const result = combatResolve(input);

    assert.strictEqual(result.armor_legendary_triggered, true);
    assert.ok(
      !result.legendary_status_on_defender?.includes("stun") ||
        result.armor_legendary_status_on_wearer?.length === 0,
      `expected stun to be cleansed, got defender statuses ${JSON.stringify(result.legendary_status_on_defender)} and wearer statuses ${JSON.stringify(result.armor_legendary_status_on_wearer)}`
    );
  });

  it("should apply fear to attacker with fear_aura", () => {
    const input = armorLegendaryCombat("on_hit_taken", "fear_aura", 1.0);

    const result = combatResolve(input);

    assert.strictEqual(result.armor_legendary_triggered, true);
    assert.strictEqual(result.armor_legendary_fear_aura, true);
    assert.ok(
      result.armor_legendary_status_on_attacker?.includes("fear"),
      `expected fear on attacker, got ${JSON.stringify(result.armor_legendary_status_on_attacker)}`
    );
  });

  it("should buff wearer with pain_to_power when on_damage_taken", () => {
    const input = armorLegendaryCombat("on_damage_taken", "pain_to_power", 1.0);

    const result = combatResolve(input);

    assert.strictEqual(result.armor_legendary_triggered, true);
    assert.ok(
      (result.armor_legendary_status_on_wearer ?? []).length > 0,
      `expected wearer buff status, got ${JSON.stringify(result.armor_legendary_status_on_wearer)}`
    );
  });

  it("should activate last_stand when wearer HP is low", () => {
    const input = armorLegendaryCombat(
      "on_low_wearer_hp",
      "last_stand",
      1.0,
      { defender: { hp: 10, hp_max: 100 } }
    );

    const result = combatResolve(input);

    assert.strictEqual(result.armor_legendary_triggered, true);
    assert.strictEqual(result.armor_legendary_last_stand, true);
    assert.ok(
      (result.armor_legendary_status_on_wearer ?? []).length > 0,
      `expected last_stand buff status, got ${JSON.stringify(result.armor_legendary_status_on_wearer)}`
    );
  });

  it("should grant random stat boost with passive stat_boost", () => {
    const input = armorLegendaryCombat("passive", "stat_boost", 1.0);

    const result = combatResolve(input);

    assert.strictEqual(result.armor_legendary_triggered, true);
    assert.ok(
      (result.armor_legendary_status_on_wearer ?? []).length > 0,
      `expected stat boost status on wearer, got ${JSON.stringify(result.armor_legendary_status_on_wearer)}`
    );
  });

  it("should trigger retribution on fatal_hit when wearer dies", () => {
    const input = armorLegendaryCombat(
      "on_fatal_hit",
      "retribution",
      0.5,
      { defender: { hp: 1, hp_max: 100 } }
    );

    const result = combatResolve(input);

    assert.strictEqual(result.killed, true);
    assert.strictEqual(result.armor_legendary_triggered, true);
    assert.ok(
      (result.armor_legendary_retribution ?? 0) > 0,
      `expected armor_legendary_retribution > 0, got ${result.armor_legendary_retribution}`
    );
  });

  it("should trigger armor_legendary on_dodged when attack misses", () => {
    const input = sampleCombat({
      attacker: {
        weapon: { damage_min: 5, damage_max: 5, accuracy: 0.0, damage_type: "slashing" },
      },
      defender: {
        evasion: 1.0,
        armor: 0,
        hp: 30,
        hp_max: 30,
        armor_legendary: {
          effect_name: "Evasive Ward",
          trigger: "on_dodged",
          effect_type: "thorns",
          magnitude: 3.0,
        },
      },
    });

    const result = combatResolve(input);

    assert.strictEqual(result.hit, false);
    assert.strictEqual(result.armor_legendary_triggered, true);
  });

  it("should trigger armor_legendary on_combat_start when combat_start flag is present", () => {
    const input = baseHitCombat({
      attacker: {
        flags: ["combat_start"],
      },
      defender: {
        armor_legendary: {
          effect_name: "Opening Bulwark",
          trigger: "on_combat_start",
          effect_type: "stat_boost",
          magnitude: 5.0,
        },
      },
    });

    const result = combatResolve(input);

    assert.strictEqual(result.armor_legendary_triggered, true);
  });

  // --- 饰品传奇系统 (Cycle 2) ------------------------------------

  it("should apply accessory_xp_boost when on_kill + xp_boost triggers", () => {
    const input = accessoryCombat("on_kill", "xp_boost", 0.3, {
      defender: { hp: 1, hp_max: 50 },
    });

    const result = combatResolve(input);

    assert.strictEqual(result.killed, true);
    assert.ok(
      (result.accessory_xp_boost ?? 0) > 0,
      `expected accessory_xp_boost > 0, got ${result.accessory_xp_boost}`
    );
  });

  it("should set accessory_second_wind when on_low_hp + second_wind triggers", () => {
    const input = accessoryCombat("on_low_hp", "second_wind", 2.0, {
      attacker: { hp: 5, hp_max: 50 },
    });

    const result = combatResolve(input);

    assert.strictEqual(result.accessory_second_wind, true);
  });

  it("should apply accessory_lucky_crit_bonus when on_combat_start + lucky_crit triggers", () => {
    const input = accessoryCombat("on_combat_start", "lucky_crit", 0.15, {
      attacker: { flags: ["combat_start"] },
    });

    const result = combatResolve(input);

    assert.ok(
      (result.accessory_lucky_crit_bonus ?? 0) > 0,
      `expected accessory_lucky_crit_bonus > 0, got ${result.accessory_lucky_crit_bonus}`
    );
  });

  it("should apply accessory_heal_on_kill when passive + heal_on_kill and defender is killed", () => {
    const input = accessoryCombat("passive", "heal_on_kill", 0.25, {
      defender: { hp: 1, hp_max: 50 },
    });

    const result = combatResolve(input);

    assert.strictEqual(result.killed, true);
    assert.ok(
      (result.accessory_heal_on_kill ?? 0) > 0,
      `expected accessory_heal_on_kill > 0, got ${result.accessory_heal_on_kill}`
    );
  });
});
