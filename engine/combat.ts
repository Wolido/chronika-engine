export interface CombatantStats {
  strength: number;
  agility: number;
  endurance: number;
  perception: number;
  intelligence: number;
  willpower: number;
}

export interface WeaponStats {
  damage_min: number;
  damage_max: number;
  accuracy: number;
  damage_type: string;
}

export interface ElementData {
  element_type: string;
  proc_chance: number;
}

export interface LegendaryData {
  effect_name: string;
  trigger: string;
  effect_type: string;
  magnitude: number;
}

export interface CombatInput {
  attacker: {
    stats: CombatantStats;
    weapon: WeaponStats;
    element?: ElementData;
    legendary?: LegendaryData;
  };
  defender: {
    evasion: number;
    armor: number;
    hp: number;
  };
}

export interface CombatResult {
  hit: boolean;
  hit_roll: number;
  hit_threshold: number;
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
  hp_remaining: number;
  killed: boolean;
}

function rollD100(): number {
  return Math.floor(Math.random() * 100) + 1;
}

function rollBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function combatResolve(input: CombatInput): CombatResult {
  // 1. 命中判定
  const hitThreshold = Math.max(0, Math.round((input.attacker.weapon.accuracy - input.defender.evasion) * 100));
  const hitRoll = rollD100();
  const hit = hitRoll <= hitThreshold;

  if (!hit) {
    return {
      hit: false,
      hit_roll: hitRoll,
      hit_threshold: hitThreshold,
      damage_raw: 0,
      strength_bonus: 0,
      damage_absorbed: 0,
      damage_final: 0,
      damage_type: input.attacker.weapon.damage_type,
      elemental_proc: false,
      legendary_triggered: false,
      hp_remaining: input.defender.hp,
      killed: false,
    };
  }

  // 2. 伤害计算
  const rawDamage = rollBetween(input.attacker.weapon.damage_min, input.attacker.weapon.damage_max);
  const strengthBonus = Math.floor(input.attacker.stats.strength / 4);
  const beforeArmor = rawDamage + strengthBonus;
  const absorbed = Math.min(input.defender.armor, beforeArmor);
  const finalDamage = beforeArmor - absorbed;

  // 3. 元素触发
  let elementalProc = false;
  let elementalDetail: string | undefined;
  if (input.attacker.element) {
    const procRoll = rollD100();
    elementalProc = procRoll <= input.attacker.element.proc_chance * 100;
    if (elementalProc) {
      elementalDetail = `${input.attacker.element.element_type} triggered (roll: ${procRoll}, threshold: ${input.attacker.element.proc_chance * 100})`;
    }
  }

  // 4. 传奇特效处理
  let legendaryTriggered = false;
  let legendaryDetail: string | undefined;
  let legendaryHpRestored: number | undefined;
  let finalDamageAfterLegendary = finalDamage;

  if (input.attacker.legendary && input.attacker.legendary.trigger === "on_hit") {
    legendaryTriggered = true;
    const leg = input.attacker.legendary;

    if (leg.effect_type === "multiply_damage") {
      finalDamageAfterLegendary = Math.round(finalDamage * leg.magnitude);
      legendaryDetail = `${leg.effect_name}: damage ×${leg.magnitude} (${finalDamage} → ${finalDamageAfterLegendary})`;
    } else if (leg.effect_type === "lifesteal") {
      const restored = Math.floor(finalDamage * leg.magnitude);
      legendaryHpRestored = restored;
      legendaryDetail = `${leg.effect_name}: restored ${restored} HP (${leg.magnitude * 100}% of ${finalDamage} damage)`;
    } else if (leg.effect_type === "aoe_explosion") {
      const aoeDamage = Math.round(finalDamage * leg.magnitude);
      legendaryDetail = `${leg.effect_name}: explosion deals ${aoeDamage} area damage (${leg.magnitude}× of ${finalDamage})`;
    } else {
      legendaryDetail = `${leg.effect_name}: triggered (${leg.effect_type})`;
    }
  }

  const hpRemainingAfterLegendary = Math.max(0, input.defender.hp - finalDamageAfterLegendary);

  return {
    hit: true,
    hit_roll: hitRoll,
    hit_threshold: hitThreshold,
    damage_raw: rawDamage,
    strength_bonus: strengthBonus,
    damage_absorbed: absorbed,
    damage_final: finalDamageAfterLegendary,
    damage_type: input.attacker.weapon.damage_type,
    elemental_proc: elementalProc,
    elemental_detail: elementalDetail,
    legendary_triggered: legendaryTriggered,
    legendary_detail: legendaryDetail,
    legendary_hp_restored: legendaryHpRestored,
    hp_remaining: hpRemainingAfterLegendary,
    killed: hpRemainingAfterLegendary <= 0,
  };
}
