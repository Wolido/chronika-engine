// ============================================================
// legendary-gen.ts — 传奇武器特效生成与校验
// ============================================================

export const TRIGGER_TYPES = ["on_hit", "on_kill", "on_crit", "on_reload", "on_empty_mag", "on_low_hp", "on_miss"] as const;
export const EFFECT_TYPES = ["multiply_damage", "aoe_explosion", "lifesteal", "refill_ammo", "chain_lightning", "summon", "debuff_enemy"] as const;

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

const TRIGGER_DESCRIPTIONS: Record<string, string> = {
  on_hit: "On hit",
  on_kill: "On kill",
  on_crit: "On critical hit",
  on_reload: "On reload",
  on_empty_mag: "When magazine is empty",
  on_low_hp: "When HP is low",
  on_miss: "On miss",
};

const EFFECT_DESCRIPTIONS: Record<string, string> = {
  multiply_damage: "multiply damage",
  aoe_explosion: "trigger area explosion",
  lifesteal: "steal health",
  refill_ammo: "refill ammo",
  chain_lightning: "chain lightning to nearby enemies",
  summon: "summon assistance",
  debuff_enemy: "debuff enemies",
};

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 10) / 10;
}

export function generateSeed(): LegendarySeed {
  const trigger = pickRandom(TRIGGER_TYPES);
  const effectType = pickRandom(EFFECT_TYPES);
  const magMin = randomBetween(1.0, 3.0);
  const magMax = randomBetween(magMin, Math.min(magMin + 3.0, 10.0));
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
