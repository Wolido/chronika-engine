// ============================================================
// legendary-gen.ts — 传奇武器特效生成与校验 (25 triggers × 25 effects)
// ============================================================

export const TRIGGER_TYPES = [
  "on_hit", "on_crit", "on_miss", "on_kill", "on_attack_start",
  "on_damage_dealt", "on_overkill", "on_armor_pierce", "on_low_attacker_hp",
  "on_low_defender_hp", "on_parry", "on_reload", "on_empty_mag",
  "on_full_mag", "on_weapon_jam", "on_elemental_proc", "on_stealth_attack",
  "on_counter_attack", "on_finishing_blow", "on_berserk", "on_last_stand",
  "on_first_blood", "on_reflect", "on_wound", "on_ammo_low",
] as const;
export const EFFECT_TYPES = [
  "multiply_damage", "add_flat_damage", "lifesteal", "life_drain",
  "aoe_explosion", "chain_lightning", "armor_pierce", "armor_shred", "stun",
  "bleed", "burn", "poison", "frost_slow", "shock_proc", "mental_break",
  "debuff_attack", "debuff_defense", "buff_attack", "buff_accuracy", "buff_evasion",
  "summon_ally", "refill_ammo", "shield", "reflect_damage", "disarm",
] as const;

export const ARMOR_TRIGGERS = [
  "on_hit_taken", "on_crit_taken", "on_damage_taken", "on_heavy_damage",
  "on_block", "on_dodged", "on_low_wearer_hp", "on_critical_hp",
  "on_combat_start", "on_kill_response", "on_debuff_received",
  "on_elemental_hit", "on_fatal_hit", "passive",
] as const;

export const ARMOR_EFFECTS = [
  "damage_reduction", "flat_damage_block", "thorns", "reflect_percent",
  "hp_regen", "emergency_heal", "heal_on_kill", "explosive_retaliation",
  "elemental_absorption", "status_cleanse", "fear_aura",
  "pain_to_power", "last_stand", "stat_boost", "retribution",
] as const;

export type ArmorTriggerType = typeof ARMOR_TRIGGERS[number];
export type ArmorEffectType = typeof ARMOR_EFFECTS[number];

// ============================================================
// 饰品传奇系统 (Cycle 2)
// ============================================================

export const ACCESSORY_TRIGGERS = [
  "on_kill", "on_low_hp", "on_combat_start", "on_travel",
  "on_explore", "on_loot", "on_trade", "on_craft", "on_heal", "passive",
] as const;

export const ACCESSORY_EFFECTS = [
  "xp_boost", "second_wind", "lucky_crit", "heal_on_kill",
  "stealth_field", "danger_sense", "movement_speed", "resource_sense",
  "loot_magnet", "ammo_scavenge", "double_loot",
  "trade_discount", "sell_bonus",
  "crafting_efficiency", "material_save",
  "healing_boost", "item_efficiency",
] as const;

export type AccessoryTrigger = typeof ACCESSORY_TRIGGERS[number];
export type AccessoryEffect = typeof ACCESSORY_EFFECTS[number];

/** 各模块共用的饰品数据结构 */
export interface AccessoryData {
  name: string;
  trigger: string;
  effect_type: string;
  magnitude: number;
}

export type TriggerType = typeof TRIGGER_TYPES[number];
export type EffectType = typeof EFFECT_TYPES[number];

export interface LegendarySeed {
  trigger: string;
  effect_type: string;
  magnitude_min: number;
  magnitude_max: number;
  description_template: string;
}

export interface LegendaryEffect {
  name: string;
  trigger: string;
  effect_type: string;
  magnitude: number;
  description: string;
}

export interface LegendaryValidateInput {
  effect: LegendaryEffect;
  weapon_tier: number;
}

export interface LegendaryValidateResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface WeaponContext {
  weapon_type: string;   // melee/ranged/thrown
  tier: number;
  damage_type?: string;
  ammo_type?: string;
}

/** Alias kept for callers that refer to the legendary-validation context by name. */
export type LegendaryWeaponContext = WeaponContext;

export interface MagnitudeRange {
  min: number;
  max: number;
}

const TRIGGER_DESCRIPTIONS: Record<string, string> = {
  on_hit: "On hit",
  on_crit: "On critical hit",
  on_miss: "On miss",
  on_kill: "On kill",
  on_attack_start: "On attack start",
  on_damage_dealt: "On damage dealt",
  on_overkill: "On overkill",
  on_armor_pierce: "On armor pierced",
  on_low_attacker_hp: "When attacker HP is low",
  on_low_defender_hp: "When defender HP is low",
  on_parry: "On parry",
  on_reload: "On reload",
  on_empty_mag: "When magazine is empty",
  on_full_mag: "When magazine is full",
  on_weapon_jam: "On weapon jam",
  on_elemental_proc: "On elemental proc",
  on_stealth_attack: "On stealth attack",
  on_counter_attack: "On counter attack",
  on_finishing_blow: "On finishing blow",
  on_berserk: "While berserk",
  on_last_stand: "On last stand",
  on_first_blood: "On first blood",
  on_reflect: "On reflect",
  on_wound: "On wound",
  on_ammo_low: "When ammo is low",
};

const EFFECT_DESCRIPTIONS: Record<string, string> = {
  multiply_damage: "multiply damage",
  add_flat_damage: "add flat damage",
  lifesteal: "steal health",
  life_drain: "drain life over time",
  aoe_explosion: "trigger area explosion",
  chain_lightning: "chain lightning to nearby enemies",
  armor_pierce: "pierce armor",
  armor_shred: "shred armor",
  stun: "stun the target",
  bleed: "cause bleeding",
  burn: "ignite the target",
  poison: "poison the target",
  frost_slow: "slow the target with frost",
  shock_proc: "discharge bonus shock damage",
  mental_break: "break the target's mind",
  debuff_attack: "reduce enemy attack",
  debuff_defense: "reduce enemy defense",
  buff_attack: "boost attack",
  buff_accuracy: "boost accuracy",
  buff_evasion: "boost evasion",
  summon_ally: "summon an ally",
  refill_ammo: "refill ammo",
  shield: "grant a shield",
  reflect_damage: "reflect damage",
  disarm: "disarm the target",
};

// Magnitude ranges per effect type (see design: damage multipliers > 1,
// lifesteal fractions, flat point values, status durations/potency).
const MAGNITUDE_RANGES: Record<string, MagnitudeRange> = {
  multiply_damage: { min: 1.2, max: 4.0 },
  aoe_explosion: { min: 1.2, max: 4.0 },
  chain_lightning: { min: 1.2, max: 4.0 },
  shock_proc: { min: 1.2, max: 4.0 },
  reflect_damage: { min: 1.2, max: 4.0 },
  lifesteal: { min: 0.1, max: 0.6 },
  life_drain: { min: 0.1, max: 0.6 },
  add_flat_damage: { min: 3, max: 15 },
  armor_pierce: { min: 0.1, max: 1.0 },
  shield: { min: 3, max: 15 },
  armor_shred: { min: 3, max: 15 },
  stun: { min: 1, max: 5 },
  bleed: { min: 1, max: 5 },
  burn: { min: 1, max: 5 },
  poison: { min: 1, max: 5 },
  frost_slow: { min: 1, max: 5 },
  mental_break: { min: 1, max: 5 },
  debuff_attack: { min: 1, max: 5 },
  debuff_defense: { min: 1, max: 5 },
  buff_attack: { min: 1, max: 5 },
  buff_accuracy: { min: 1, max: 5 },
  buff_evasion: { min: 1, max: 5 },
  summon_ally: { min: 1, max: 5 },
  refill_ammo: { min: 0.3, max: 1.5 },
  disarm: { min: 1, max: 5 },
};

const DEFAULT_MAGNITUDE_RANGE: MagnitudeRange = { min: 1, max: 5 };

export function magnitudeRangeFor(effectType: string): MagnitudeRange {
  return MAGNITUDE_RANGES[effectType] ?? DEFAULT_MAGNITUDE_RANGE;
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 10) / 10;
}

export function generateSeed(): LegendarySeed {
  const trigger = pickRandom(TRIGGER_TYPES);
  const effectType = pickRandom(EFFECT_TYPES);
  const range = magnitudeRangeFor(effectType);
  const magMin = randomBetween(range.min, range.max);
  const magMax = randomBetween(magMin, range.max);
  const triggerDesc = TRIGGER_DESCRIPTIONS[trigger];
  const effectDesc = EFFECT_DESCRIPTIONS[effectType];

  return {
    trigger,
    effect_type: effectType,
    magnitude_min: magMin,
    magnitude_max: magMax,
    description_template: `${triggerDesc}, ${effectDesc} at {magnitude}× power`,
  };
}

// ============================================================
// 防具传奇生成
// ============================================================

const ARMOR_TRIGGER_DESCRIPTIONS: Record<string, string> = {
  on_hit_taken: "When the wearer is hit",
  on_crit_taken: "When the wearer suffers a critical hit",
  on_damage_taken: "When the wearer takes damage",
  on_heavy_damage: "When the wearer takes heavy damage",
  on_block: "When the wearer blocks damage",
  on_dodged: "When an attack against the wearer misses",
  on_low_wearer_hp: "When the wearer's HP is low",
  on_critical_hp: "When the wearer's HP is critical",
  on_combat_start: "At the start of combat",
  on_kill_response: "When a kill occurs",
  on_debuff_received: "When the wearer receives a debuff",
  on_elemental_hit: "When the wearer is struck by an elemental hit",
  on_fatal_hit: "When the wearer suffers a fatal hit",
  passive: "Passive",
};

const ARMOR_EFFECT_DESCRIPTIONS: Record<string, string> = {
  damage_reduction: "reduce incoming damage",
  flat_damage_block: "block flat damage",
  thorns: "retaliate with thorns damage",
  reflect_percent: "reflect a percentage of damage",
  hp_regen: "regenerate health over time",
  emergency_heal: "heal in an emergency",
  heal_on_kill: "heal on kill",
  explosive_retaliation: "retaliate with an explosion",
  elemental_absorption: "absorb elemental damage as healing",
  status_cleanse: "cleanse status effects",
  fear_aura: "instill fear in attackers",
  pain_to_power: "convert pain to power",
  last_stand: "empower the wearer's last stand",
  stat_boost: "boost stats",
  retribution: "exact retribution on death",
};

const ARMOR_MAGNITUDE_RANGES: Record<string, MagnitudeRange> = {
  damage_reduction: { min: 0.1, max: 0.4 },
  reflect_percent: { min: 0.1, max: 0.4 },
  elemental_absorption: { min: 0.1, max: 0.4 },
  flat_damage_block: { min: 2, max: 12 },
  thorns: { min: 2, max: 12 },
  hp_regen: { min: 1, max: 8 },
  emergency_heal: { min: 0.15, max: 0.5 },
  heal_on_kill: { min: 0.15, max: 0.5 },
  explosive_retaliation: { min: 0.3, max: 1.5 },
  status_cleanse: { min: 0.3, max: 0.8 },
  pain_to_power: { min: 0.5, max: 2.0 },
  last_stand: { min: 1, max: 5 },
  stat_boost: { min: 1, max: 4 },
  retribution: { min: 0.5, max: 2.0 },
  fear_aura: { min: 1, max: 4 },
};

function armorMagnitudeRangeFor(effectType: string): MagnitudeRange {
  return ARMOR_MAGNITUDE_RANGES[effectType] ?? DEFAULT_MAGNITUDE_RANGE;
}

const ACCESSORY_MAGNITUDE_RANGES: Record<string, MagnitudeRange> = {
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

export function accessoryMagnitudeRangeFor(effectType: string): MagnitudeRange {
  return ACCESSORY_MAGNITUDE_RANGES[effectType] ?? DEFAULT_MAGNITUDE_RANGE;
}

export function generateAccessorySeed(): LegendarySeed {
  const trigger = pickRandom(ACCESSORY_TRIGGERS);
  const effectType = pickRandom(ACCESSORY_EFFECTS);
  const range = accessoryMagnitudeRangeFor(effectType);
  const magMin = randomBetween(range.min, range.max);
  const magMax = randomBetween(magMin, range.max);

  return {
    trigger,
    effect_type: effectType,
    magnitude_min: magMin,
    magnitude_max: magMax,
    description_template: `${trigger}, ${effectType} at {magnitude}× power`,
  };
}

export function generateArmorSeed(): LegendarySeed {
  const trigger = pickRandom(ARMOR_TRIGGERS);
  const effectType = pickRandom(ARMOR_EFFECTS);
  const range = armorMagnitudeRangeFor(effectType);
  const magMin = randomBetween(range.min, range.max);
  const magMax = randomBetween(magMin, range.max);
  const triggerDesc = ARMOR_TRIGGER_DESCRIPTIONS[trigger];
  const effectDesc = ARMOR_EFFECT_DESCRIPTIONS[effectType];

  return {
    trigger,
    effect_type: effectType,
    magnitude_min: magMin,
    magnitude_max: magMax,
    description_template: `${triggerDesc}, ${effectDesc} at {magnitude}× power`,
  };
}

const TIER_MAGNITUDE_CAPS: Record<number, number> = {
  1: 3.0,
  2: 5.0,
  3: 7.0,
  4: 9.0,
  5: 10.0,
};

export function validateLegendaryEffect(input: LegendaryValidateInput): LegendaryValidateResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // name
  if (!input.effect.name || input.effect.name.trim() === "") {
    errors.push("legendary effect name is required");
  }

  // trigger
  if (!TRIGGER_TYPES.includes(input.effect.trigger as any)) {
    errors.push(`trigger must be one of: ${TRIGGER_TYPES.join(", ")}`);
  }

  // effect_type
  if (!EFFECT_TYPES.includes(input.effect.effect_type as any)) {
    errors.push(`effect_type must be one of: ${EFFECT_TYPES.join(", ")}`);
  }

  // magnitude
  if (input.effect.magnitude === undefined || input.effect.magnitude === null || isNaN(input.effect.magnitude)) {
    errors.push("magnitude is required");
  } else if (input.effect.magnitude <= 0) {
    errors.push("magnitude must be positive");
  } else {
    const cap = TIER_MAGNITUDE_CAPS[input.weapon_tier] ?? 10.0;
    if (input.effect.magnitude > cap) {
      warnings.push(`magnitude ${input.effect.magnitude} exceeds tier ${input.weapon_tier} recommended cap of ${cap}`);
    }
  }

  // description
  if (!input.effect.description || input.effect.description.trim() === "") {
    warnings.push("legendary effect has no description — add flavor text");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// Triggers that only make sense on weapons with a magazine.
const RANGED_ONLY_TRIGGERS = new Set(["on_reload", "on_empty_mag", "on_full_mag", "on_weapon_jam"]);

export function validateLegendaryForWeapon(
  effect: LegendaryEffect,
  ctx: WeaponContext
): { warnings: string[] } {
  const warnings: string[] = [];
  const isRanged = ctx.weapon_type === "ranged";

  if (RANGED_ONLY_TRIGGERS.has(effect.trigger) && !isRanged) {
    warnings.push(`trigger "${effect.trigger}" is ranged-only (reload/magazine) but weapon is ${ctx.weapon_type}`);
  }

  if (effect.effect_type === "refill_ammo" && !isRanged) {
    warnings.push(`effect "refill_ammo" is wasted on a ${ctx.weapon_type} weapon — ammo only applies to ranged weapons`);
  }

  if (effect.effect_type === "reflect_damage" && isRanged) {
    warnings.push(`effect "reflect_damage" is typically a melee effect — ranged weapons rarely get hit in melee`);
  }

  if (effect.effect_type === "summon_ally" && ctx.tier < 3) {
    warnings.push(`effect "summon_ally" on a tier ${ctx.tier} weapon is underpowered — recommended for tier 3+`);
  }

  if ((effect.effect_type === "lifesteal" || effect.effect_type === "life_drain") && effect.magnitude > 1.0) {
    warnings.push(`${effect.effect_type} magnitude ${effect.magnitude} > 1.0 heals for more than the damage dealt`);
  }

  return { warnings };
}
