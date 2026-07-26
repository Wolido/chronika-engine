// ============================================================
// combat.ts — 战斗结算 (命中/暴击/伤害/元素/传奇特效 25×25)
// ============================================================

import type { AccessoryData } from "./legendary-gen.ts";

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

export type CombatFlag = "stealth" | "counter_attack" | "reload" | "empty_mag" | "full_mag"
  | "weapon_jam" | "first_blood" | "reflect" | "dodge" | "parry" | "combat_start";

export interface CombatInput {
  attacker: {
    stats: CombatantStats;
    weapon: WeaponStats;
    crit_chance?: number;   // 0.0-1.0, default 0.05
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
    evasion: number;
    armor: number;
    hp: number;
    hp_max?: number;
    stats?: CombatantStats;
    armor_legendary?: LegendaryData;
  };
}

export interface CombatResult {
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
// 传奇特效双表架构
// ============================================================

/** Everything a trigger condition or effect handler needs to know about the attack. */
interface TriggerContext {
  hit: boolean;
  crit: boolean;
  killed: boolean;
  elementalProc: boolean;
  flags: Set<string>;
  attacker: CombatInput["attacker"];
  defender: CombatInput["defender"];
  baseDamage: number;                 // raw roll + strength bonus
  finalDamageBeforeLegendary: number; // post-armor, post-crit, pre-legendary damage
}

/** Mutable accumulator that effect handlers write into. */
interface LegendaryModifications {
  baseDamageMultiplier: number;
  flatPreArmor: number;
  armorPierce: number;        // fraction (0..1) of defender armor ignored
  armorShred: number;         // flat armor reduction
  postArmorMultiplier: number;
  postArmorFlat: number;
  hpRestored: number;
  aoeDamage: number;
  chainDamage: number;
  chainTargets: number;
  shield: number;
  ammoChange: number;
  reflectDamage: number;
  statusOnDefender: string[];
  statusOnAttacker: string[];
  summon: boolean;
  fear: boolean;
  disarm: boolean;
  details: string[];
}

function createEmptyMods(): LegendaryModifications {
  return {
    baseDamageMultiplier: 1,
    flatPreArmor: 0,
    armorPierce: 0,
    armorShred: 0,
    postArmorMultiplier: 1,
    postArmorFlat: 0,
    hpRestored: 0,
    aoeDamage: 0,
    chainDamage: 0,
    chainTargets: 0,
    shield: 0,
    ammoChange: 0,
    reflectDamage: 0,
    statusOnDefender: [],
    statusOnAttacker: [],
    summon: false,
    fear: false,
    disarm: false,
    details: [],
  };
}

function hpRatio(hp: number | undefined, hpMax: number | undefined): number {
  if (hp === undefined || hpMax === undefined || hpMax <= 0) return 0;
  return Math.max(0, Math.min(1, hp / hpMax));
}

const TRIGGER_CONDITIONS: Record<string, (ctx: TriggerContext) => boolean> = {
  on_hit: (ctx) => ctx.hit,
  on_crit: (ctx) => ctx.hit && ctx.crit,
  on_miss: (ctx) => !ctx.hit,
  on_kill: (ctx) => ctx.hit && ctx.killed,
  on_attack_start: () => true,
  on_damage_dealt: (ctx) => ctx.hit && ctx.finalDamageBeforeLegendary > 0,
  on_overkill: (ctx) => ctx.hit && ctx.killed && ctx.finalDamageBeforeLegendary >= Math.max(1, ctx.defender.hp) * 1.5,
  on_armor_pierce: (ctx) => ctx.hit && ctx.defender.armor > 0 && ctx.finalDamageBeforeLegendary > 0,
  on_low_attacker_hp: (ctx) => hpRatio(ctx.attacker.hp, ctx.attacker.hp_max) <= 0.25,
  on_low_defender_hp: (ctx) => hpRatio(ctx.defender.hp, ctx.defender.hp_max) <= 0.25,
  on_parry: (ctx) => !ctx.hit && ctx.flags.has("parry"),
  on_reload: (ctx) => ctx.flags.has("reload"),
  on_empty_mag: (ctx) => ctx.flags.has("empty_mag") || (ctx.attacker.ammo !== undefined && ctx.attacker.ammo <= 0),
  on_full_mag: (ctx) => ctx.flags.has("full_mag")
    || (ctx.attacker.ammo !== undefined && ctx.attacker.max_ammo !== undefined && ctx.attacker.ammo >= ctx.attacker.max_ammo),
  on_weapon_jam: (ctx) => ctx.flags.has("weapon_jam"),
  on_elemental_proc: (ctx) => ctx.hit && ctx.elementalProc,
  on_stealth_attack: (ctx) => ctx.hit && ctx.flags.has("stealth"),
  on_counter_attack: (ctx) => ctx.flags.has("counter_attack"),
  on_finishing_blow: (ctx) => ctx.hit && ctx.killed
    && hpRatio(ctx.defender.hp, ctx.defender.hp_max) <= 0.2,
  on_berserk: (ctx) => hpRatio(ctx.attacker.hp, ctx.attacker.hp_max) <= 0.5,
  on_last_stand: (ctx) => hpRatio(ctx.attacker.hp, ctx.attacker.hp_max) <= 0.1,
  on_first_blood: (ctx) => ctx.flags.has("first_blood"),
  on_reflect: (ctx) => ctx.flags.has("reflect"),
  on_wound: (ctx) => ctx.hit && ctx.finalDamageBeforeLegendary > 0
    && ctx.defender.hp_max !== undefined
    && ctx.finalDamageBeforeLegendary >= ctx.defender.hp_max * 0.25,
  on_ammo_low: (ctx) => ctx.attacker.ammo !== undefined && ctx.attacker.max_ammo !== undefined
    && ctx.attacker.ammo > 0 && ctx.attacker.ammo <= ctx.attacker.max_ammo * 0.3,
};

type EffectHandler = (effect: LegendaryData, mods: LegendaryModifications, ctx: TriggerContext) => void;

function defenderStatus(status: string): EffectHandler {
  return (effect, mods) => {
    mods.statusOnDefender.push(status);
    mods.details.push(`${effect.effect_name}: ${status} applied to defender`);
  };
}

function attackerStatus(status: string): EffectHandler {
  return (effect, mods) => {
    mods.statusOnAttacker.push(status);
    mods.details.push(`${effect.effect_name}: ${status} applied to attacker`);
  };
}

const EFFECT_HANDLERS: Record<string, EffectHandler> = {
  multiply_damage: (effect, mods) => {
    mods.postArmorMultiplier *= effect.magnitude;
    mods.details.push(`${effect.effect_name}: damage ×${effect.magnitude}`);
  },
  add_flat_damage: (effect, mods) => {
    mods.flatPreArmor += effect.magnitude;
    mods.details.push(`${effect.effect_name}: +${effect.magnitude} damage`);
  },
  lifesteal: (effect, mods, ctx) => {
    const restored = Math.floor(ctx.finalDamageBeforeLegendary * effect.magnitude);
    mods.hpRestored += restored;
    mods.details.push(`${effect.effect_name}: restored ${restored} HP (${effect.magnitude * 100}% of ${ctx.finalDamageBeforeLegendary} damage)`);
  },
  life_drain: (effect, mods, ctx) => {
    const drained = Math.floor(ctx.finalDamageBeforeLegendary * effect.magnitude);
    mods.hpRestored += drained;
    mods.statusOnDefender.push("life_drain");
    mods.details.push(`${effect.effect_name}: drained ${drained} HP from defender`);
  },
  aoe_explosion: (effect, mods, ctx) => {
    const aoe = Math.round(ctx.finalDamageBeforeLegendary * effect.magnitude);
    mods.aoeDamage += aoe;
    mods.details.push(`${effect.effect_name}: explosion deals ${aoe} area damage (${effect.magnitude}× of ${ctx.finalDamageBeforeLegendary})`);
  },
  chain_lightning: (effect, mods, ctx) => {
    const chained = Math.round(ctx.finalDamageBeforeLegendary * effect.magnitude * 0.5);
    mods.chainDamage += chained;
    mods.chainTargets = Math.max(mods.chainTargets, 3);
    mods.details.push(`${effect.effect_name}: lightning chains to ${mods.chainTargets} targets for ${chained} damage`);
  },
  armor_pierce: (effect, mods) => {
    const pierce = Math.max(0, Math.min(1, effect.magnitude));
    mods.armorPierce += pierce;
    mods.details.push(`${effect.effect_name}: pierces ${Math.round(pierce * 100)}% of armor`);
  },
  armor_shred: (effect, mods) => {
    mods.armorShred += effect.magnitude;
    mods.details.push(`${effect.effect_name}: shreds ${effect.magnitude} armor`);
  },
  stun: defenderStatus("stun"),
  bleed: defenderStatus("bleed"),
  burn: defenderStatus("burn"),
  poison: defenderStatus("poison"),
  frost_slow: defenderStatus("frost_slow"),
  shock_proc: (effect, mods, ctx) => {
    const bonus = Math.round(ctx.finalDamageBeforeLegendary * effect.magnitude * 0.5);
    mods.postArmorFlat += bonus;
    mods.statusOnDefender.push("shock");
    mods.details.push(`${effect.effect_name}: shock discharge +${bonus} damage`);
  },
  mental_break: (effect, mods) => {
    mods.statusOnDefender.push("mental_break");
    mods.fear = true;
    mods.details.push(`${effect.effect_name}: mental break strikes the defender`);
  },
  disarm: (effect, mods) => {
    mods.statusOnDefender.push("disarm");
    mods.disarm = true;
    mods.details.push(`${effect.effect_name}: defender is disarmed`);
  },
  debuff_attack: defenderStatus("debuff_attack"),
  debuff_defense: defenderStatus("debuff_defense"),
  buff_attack: attackerStatus("buff_attack"),
  buff_accuracy: attackerStatus("buff_accuracy"),
  buff_evasion: attackerStatus("buff_evasion"),
  summon_ally: (effect, mods) => {
    mods.summon = true;
    mods.details.push(`${effect.effect_name}: summons an ally (power ×${effect.magnitude})`);
  },
  refill_ammo: (effect, mods, ctx) => {
    const magazineSize = ctx.attacker.max_ammo ?? 10; // magnitude = fraction of a magazine (0.3~1.5)
    const refill = Math.max(1, Math.round(effect.magnitude * magazineSize));
    mods.ammoChange += refill;
    mods.details.push(`${effect.effect_name}: refills ${refill} ammo`);
  },
  shield: (effect, mods) => {
    const amount = Math.max(1, Math.round(effect.magnitude));
    mods.shield += amount;
    mods.details.push(`${effect.effect_name}: grants ${amount} shield`);
  },
  reflect_damage: (effect, mods, ctx) => {
    const reflected = Math.round(ctx.finalDamageBeforeLegendary * effect.magnitude);
    mods.reflectDamage += reflected;
    mods.details.push(`${effect.effect_name}: reflects ${reflected} damage`);
  },
};

/**
 * Look up the legendary's trigger in TRIGGER_CONDITIONS; if the condition holds
 * for this attack, run its EFFECT_HANDLERS entry, accumulating into `mods`.
 * Returns whether the legendary fired.
 */
function resolveLegendary(input: CombatInput, ctx: TriggerContext, mods: LegendaryModifications): boolean {
  const leg = input.attacker.legendary;
  if (!leg) return false;
  const condition = TRIGGER_CONDITIONS[leg.trigger];
  if (!condition) {
    console.warn(`resolveLegendary: unknown trigger "${leg.trigger}" on "${leg.effect_name}"`);
    return false;
  }
  const handler = EFFECT_HANDLERS[leg.effect_type];
  if (!handler) {
    console.warn(`resolveLegendary: unknown effect_type "${leg.effect_type}" on "${leg.effect_name}"`);
    return false;
  }
  if (!condition(ctx)) return false;
  handler(leg, mods, ctx);
  return true;
}

/** Apply accumulated modifications to the damage pipeline. */
function computeFinalDamage(armor: number, baseDamage: number, crit: boolean, mods: LegendaryModifications): { absorbed: number; final: number } {
  const preArmor = Math.round(baseDamage * mods.baseDamageMultiplier) + mods.flatPreArmor;
  const armorAfterShred = Math.max(0, armor - mods.armorShred);
  const effectiveArmor = Math.max(0, Math.round(armorAfterShred * (1 - Math.min(1, mods.armorPierce))));
  const absorbed = Math.min(effectiveArmor, preArmor);
  const postArmor = preArmor - absorbed;
  const critMultiplier = crit ? 1.5 : 1;
  const final = Math.round(postArmor * critMultiplier * mods.postArmorMultiplier + mods.postArmorFlat);
  return { absorbed, final };
}

function modsAffectDamage(mods: LegendaryModifications): boolean {
  return mods.baseDamageMultiplier !== 1 || mods.flatPreArmor !== 0 || mods.armorPierce !== 0
    || mods.armorShred !== 0 || mods.postArmorMultiplier !== 1 || mods.postArmorFlat !== 0;
}

function legendaryResultFields(mods: LegendaryModifications) {
  return {
    legendary_detail: mods.details.length > 0 ? mods.details.join("; ") : undefined,
    legendary_hp_restored: mods.hpRestored > 0 ? mods.hpRestored : undefined,
    legendary_aoe_damage: mods.aoeDamage > 0 ? mods.aoeDamage : undefined,
    legendary_chain_damage: mods.chainDamage > 0 ? mods.chainDamage : undefined,
    legendary_chain_targets: mods.chainTargets > 0 ? mods.chainTargets : undefined,
    legendary_shield: mods.shield > 0 ? mods.shield : undefined,
    legendary_ammo_change: mods.ammoChange !== 0 ? mods.ammoChange : undefined,
    legendary_reflect_damage: mods.reflectDamage > 0 ? mods.reflectDamage : undefined,
    legendary_status_on_defender: mods.statusOnDefender.length > 0 ? [...mods.statusOnDefender] : undefined,
    legendary_status_on_attacker: mods.statusOnAttacker.length > 0 ? [...mods.statusOnAttacker] : undefined,
    legendary_summon: mods.summon ? true : undefined,
    legendary_fear: mods.fear ? true : undefined,
    legendary_disarm: mods.disarm ? true : undefined,
  };
}

// ============================================================
// 防具传奇双表架构 (14 triggers × 15 effects)
// ============================================================

/** Everything an armor trigger condition or effect handler needs to know about the incoming attack. */
interface ArmorTriggerContext {
  hit: boolean;
  crit: boolean;
  killed: boolean;
  elementalProc: boolean;
  flags: Set<string>;
  attacker: CombatInput["attacker"];
  defender: CombatInput["defender"];
  baseIncomingDamage: number;   // raw roll + strength bonus
  damageAfterArmor: number;     // post-armor, post-crit, post-weapon-legendary damage
  absorbedByArmor: number;      // damage soaked by the defender's armor stat
  debuffsReceived: string[];    // debuffs the attacker's legendary applied to the wearer
}

/** Mutable accumulator that armor effect handlers write into. */
interface ArmorModifications {
  damageReduction: number;      // fraction (0..1) of incoming damage negated
  flatBlock: number;            // flat damage negated
  thornsDamage: number;         // flat counter damage to attacker
  reflectDamage: number;        // percentage-based counter damage to attacker
  hpRestored: number;           // immediate healing to wearer
  emergencyHeal: number;        // heal triggered at critical HP
  aoeRetaliation: number;       // explosive AOE counter damage
  statusOnWearer: string[];
  statusOnAttacker: string[];
  healOnKill: number;           // healing granted when a kill occurs
  fearAura: boolean;
  lastStand: boolean;
  retribution: number;          // damage dealt to the killer on death
  cleansed: string[];           // debuffs removed by status_cleanse
  details: string[];
}

function createEmptyArmorMods(): ArmorModifications {
  return {
    damageReduction: 0,
    flatBlock: 0,
    thornsDamage: 0,
    reflectDamage: 0,
    hpRestored: 0,
    emergencyHeal: 0,
    aoeRetaliation: 0,
    statusOnWearer: [],
    statusOnAttacker: [],
    healOnKill: 0,
    fearAura: false,
    lastStand: false,
    retribution: 0,
    cleansed: [],
    details: [],
  };
}

const ARMOR_TRIGGER_CONDITIONS: Record<string, (ctx: ArmorTriggerContext) => boolean> = {
  on_hit_taken: (ctx) => ctx.hit,
  on_crit_taken: (ctx) => ctx.hit && ctx.crit,
  on_damage_taken: (ctx) => ctx.hit && ctx.damageAfterArmor > 0,
  on_heavy_damage: (ctx) => ctx.hit && ctx.defender.hp_max !== undefined
    && ctx.damageAfterArmor >= ctx.defender.hp_max * 0.25,
  on_block: (ctx) => ctx.hit && ctx.absorbedByArmor > 0,
  on_dodged: (ctx) => !ctx.hit,
  on_low_wearer_hp: (ctx) => hpRatio(ctx.defender.hp, ctx.defender.hp_max) <= 0.25,
  on_critical_hp: (ctx) => hpRatio(ctx.defender.hp, ctx.defender.hp_max) <= 0.10,
  on_combat_start: (ctx) => ctx.flags.has("combat_start"),
  // 注意：此触发器在【穿戴者被击杀】时触发（defender killed），而非穿戴者击杀别人；
  // 需要"击杀别人"语义时请用武器传奇的 on_kill。
  on_kill_response: (ctx) => ctx.hit && ctx.killed,
  on_debuff_received: (ctx) => ctx.debuffsReceived.length > 0,
  on_elemental_hit: (ctx) => ctx.hit && ctx.elementalProc,
  on_fatal_hit: (ctx) => ctx.hit && ctx.killed,
  // 注意：passive 每次攻击都触发，上层需注意同名状态去重。
  passive: () => true,
};

type ArmorEffectHandler = (effect: LegendaryData, mods: ArmorModifications, ctx: ArmorTriggerContext) => void;

const ARMOR_EFFECT_HANDLERS: Record<string, ArmorEffectHandler> = {
  damage_reduction: (effect, mods) => {
    mods.damageReduction += effect.magnitude;
    mods.details.push(`${effect.effect_name}: reduces incoming damage by ${Math.round(effect.magnitude * 100)}%`);
  },
  flat_damage_block: (effect, mods) => {
    mods.flatBlock += effect.magnitude;
    mods.details.push(`${effect.effect_name}: blocks ${effect.magnitude} damage`);
  },
  thorns: (effect, mods) => {
    const dmg = Math.max(1, Math.round(effect.magnitude));
    mods.thornsDamage += dmg;
    mods.details.push(`${effect.effect_name}: thorns deal ${dmg} damage to the attacker`);
  },
  reflect_percent: (effect, mods, ctx) => {
    const reflected = Math.round(ctx.damageAfterArmor * effect.magnitude);
    mods.reflectDamage += reflected;
    mods.details.push(`${effect.effect_name}: reflects ${reflected} damage (${Math.round(effect.magnitude * 100)}%)`);
  },
  hp_regen: (effect, mods) => {
    mods.statusOnWearer.push("hot");
    mods.details.push(`${effect.effect_name}: wearer regenerates ${effect.magnitude} HP per turn`);
  },
  emergency_heal: (effect, mods, ctx) => {
    const hpMax = ctx.defender.hp_max ?? ctx.defender.hp;
    const heal = Math.max(1, Math.round(hpMax * effect.magnitude));
    mods.emergencyHeal += heal;
    mods.details.push(`${effect.effect_name}: emergency heal restores ${heal} HP`);
  },
  heal_on_kill: (effect, mods, ctx) => {
    const hpMax = ctx.defender.hp_max ?? ctx.defender.hp;
    const heal = Math.max(1, Math.round(hpMax * effect.magnitude));
    mods.healOnKill += heal;
    mods.details.push(`${effect.effect_name}: kill restores ${heal} HP to the wearer`);
  },
  explosive_retaliation: (effect, mods, ctx) => {
    const aoe = Math.round(ctx.damageAfterArmor * effect.magnitude);
    mods.aoeRetaliation += aoe;
    mods.details.push(`${effect.effect_name}: explosive retaliation deals ${aoe} area damage`);
  },
  elemental_absorption: (effect, mods, ctx) => {
    const restored = Math.round(ctx.damageAfterArmor * effect.magnitude);
    mods.hpRestored += restored;
    mods.details.push(`${effect.effect_name}: absorbs elemental energy, restoring ${restored} HP`);
  },
  status_cleanse: (effect, mods, ctx) => {
    const cleansed = ctx.debuffsReceived.filter(() => Math.random() < effect.magnitude);
    mods.cleansed.push(...cleansed);
    mods.details.push(`${effect.effect_name}: cleanses ${cleansed.length} debuff(s): ${cleansed.join(", ")}`);
  },
  fear_aura: (effect, mods) => {
    mods.fearAura = true;
    mods.statusOnAttacker.push("fear");
    mods.details.push(`${effect.effect_name}: fear aura terrifies the attacker`);
  },
  pain_to_power: (effect, mods) => {
    mods.statusOnWearer.push("buff_attack");
    mods.details.push(`${effect.effect_name}: pain converted to power (×${effect.magnitude})`);
  },
  last_stand: (effect, mods) => {
    mods.lastStand = true;
    mods.statusOnWearer.push("armor_buff", "evasion_buff");
    mods.details.push(`${effect.effect_name}: last stand grants armor and evasion buffs`);
  },
  // 注意：常配合 passive 触发器（每次攻击都触发），上层需注意同名状态去重。
  stat_boost: (effect, mods) => {
    mods.statusOnWearer.push("stat_boost");
    mods.details.push(`${effect.effect_name}: boosts a random stat (×${effect.magnitude})`);
  },
  retribution: (effect, mods, ctx) => {
    const dmg = Math.round(ctx.damageAfterArmor * effect.magnitude);
    mods.retribution += dmg;
    mods.details.push(`${effect.effect_name}: retribution deals ${dmg} damage to the killer`);
  },
};

/**
 * Look up the armor legendary's trigger in ARMOR_TRIGGER_CONDITIONS; if the
 * condition holds for this incoming attack, run its ARMOR_EFFECT_HANDLERS
 * entry, accumulating into `mods`. Returns whether the armor legendary fired.
 */
function resolveArmorLegendary(legendary: LegendaryData, ctx: ArmorTriggerContext, mods: ArmorModifications): boolean {
  const condition = ARMOR_TRIGGER_CONDITIONS[legendary.trigger];
  if (!condition) {
    console.warn(`resolveArmorLegendary: unknown trigger "${legendary.trigger}" on "${legendary.effect_name}"`);
    return false;
  }
  const handler = ARMOR_EFFECT_HANDLERS[legendary.effect_type];
  if (!handler) {
    console.warn(`resolveArmorLegendary: unknown effect_type "${legendary.effect_type}" on "${legendary.effect_name}"`);
    return false;
  }
  if (!condition(ctx)) return false;
  handler(legendary, mods, ctx);
  return true;
}

function armorResultFields(mods: ArmorModifications, damageReduced: number) {
  return {
    armor_legendary_detail: mods.details.length > 0 ? mods.details.join("; ") : undefined,
    armor_legendary_thorns: mods.thornsDamage > 0 ? mods.thornsDamage : undefined,
    armor_legendary_reflect: mods.reflectDamage > 0 ? mods.reflectDamage : undefined,
    armor_legendary_hp_restored: mods.hpRestored > 0 ? mods.hpRestored : undefined,
    armor_legendary_aoe: mods.aoeRetaliation > 0 ? mods.aoeRetaliation : undefined,
    armor_legendary_heal_on_kill: mods.healOnKill > 0 ? mods.healOnKill : undefined,
    armor_legendary_status_on_wearer: mods.statusOnWearer.length > 0 ? [...mods.statusOnWearer] : undefined,
    armor_legendary_status_on_attacker: mods.statusOnAttacker.length > 0 ? [...mods.statusOnAttacker] : undefined,
    armor_legendary_damage_reduced: damageReduced > 0 ? damageReduced : undefined,
    armor_legendary_emergency_heal: mods.emergencyHeal > 0 ? mods.emergencyHeal : undefined,
    armor_legendary_fear_aura: mods.fearAura ? true : undefined,
    armor_legendary_last_stand: mods.lastStand ? true : undefined,
    armor_legendary_retribution: mods.retribution > 0 ? mods.retribution : undefined,
    armor_legendary_cleansed: mods.cleansed.length > 0 ? [...mods.cleansed] : undefined,
  };
}

// ============================================================
// 饰品传奇结算 (Cycle 2)
// ============================================================

interface AccessoryTriggerContext {
  hit: boolean;
  killed: boolean;
  flags: Set<string>;
  attacker: CombatInput["attacker"];
  defender: CombatInput["defender"];
}

interface AccessoryModifications {
  xpBoost: number;
  secondWind: boolean;
  luckyCritBonus: number;
  healOnKill: number;
}

const ACCESSORY_TRIGGER_CONDITIONS: Record<string, (ctx: AccessoryTriggerContext) => boolean> = {
  on_kill: (ctx) => ctx.hit && ctx.killed,
  on_low_hp: (ctx) => hpRatio(ctx.attacker.hp, ctx.attacker.hp_max) <= 0.25,
  on_combat_start: (ctx) => ctx.flags.has("combat_start"),
  passive: () => true,
};

const ACCESSORY_EFFECT_HANDLERS: Record<string, (acc: AccessoryData, mods: AccessoryModifications, ctx: AccessoryTriggerContext) => void> = {
  xp_boost: (acc, mods, ctx) => {
    if (!ctx.killed) return; // 仅在实际击杀时累加（passive 触发器无击杀不生效）
    mods.xpBoost += acc.magnitude;
  },
  second_wind: (acc, mods, ctx) => {
    if (hpRatio(ctx.attacker.hp, ctx.attacker.hp_max) > 0.25) return; // 仅在 HP ≤ 25% 时触发
    mods.secondWind = true;
  },
  lucky_crit: (acc, mods) => { mods.luckyCritBonus += acc.magnitude; },
  heal_on_kill: (acc, mods, ctx) => {
    if (!ctx.killed) return; // 仅在实际击杀时记录回血值（不写回 HP）
    const hpMax = ctx.defender.hp_max ?? ctx.defender.hp;
    mods.healOnKill += Math.max(1, Math.round(hpMax * acc.magnitude));
  },
};

function resolveAccessories(input: CombatInput, ctx: AccessoryTriggerContext): AccessoryModifications {
  const mods: AccessoryModifications = { xpBoost: 0, secondWind: false, luckyCritBonus: 0, healOnKill: 0 };
  for (const acc of input.attacker.accessories ?? []) {
    const condition = ACCESSORY_TRIGGER_CONDITIONS[acc.trigger];
    const handler = ACCESSORY_EFFECT_HANDLERS[acc.effect_type];
    if (!condition || !handler) continue; // 忽略不属于战斗域的触发器/效果
    if (!condition(ctx)) continue;
    handler(acc, mods, ctx);
  }
  return mods;
}

function accessoryResultFields(mods: AccessoryModifications) {
  return {
    accessory_xp_boost: mods.xpBoost > 0 ? mods.xpBoost : undefined,
    accessory_second_wind: mods.secondWind ? true : undefined,
    accessory_lucky_crit_bonus: mods.luckyCritBonus > 0 ? mods.luckyCritBonus : undefined,
    accessory_heal_on_kill: mods.healOnKill > 0 ? mods.healOnKill : undefined,
  };
}

// ============================================================
// 主流程
// ============================================================

function rollD100(): number {
  return Math.floor(Math.random() * 100) + 1;
}

function rollBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function combatResolve(input: CombatInput): CombatResult {
  const flags = new Set<string>(input.attacker.flags ?? []);
  const critChance = input.attacker.crit_chance ?? 0.05;
  const critThreshold = Math.max(0, Math.round(critChance * 100));

  // 1. 命中判定
  // 感知偏移（基准 5，每点 ±2%）
  const perceptionMod = (input.attacker.stats.perception - 5) * 0.02;
  // 敏捷偏移（基准 5，每点 ±2%）
  const agilityMod = (input.attacker.stats.agility - 5) * 0.02;
  // 防御者敏捷偏移
  const defenderAgilityMod = input.defender.stats ? (input.defender.stats.agility - 5) * 0.02 : 0;

  const effectiveAccuracy = input.attacker.weapon.accuracy + perceptionMod + agilityMod;
  const effectiveEvasion = input.defender.evasion + defenderAgilityMod;

  const hitThreshold = Math.max(0, Math.min(100, Math.round((effectiveAccuracy - effectiveEvasion) * 100)));
  const hitRoll = rollD100();
  const hit = hitRoll <= hitThreshold;

  const mods = createEmptyMods();

  // 未命中：仍检查传奇触发（on_miss / on_parry / 旗帜类触发器）与防具传奇（on_dodged 等）
  if (!hit) {
    const ctx: TriggerContext = {
      hit, crit: false, killed: false, elementalProc: false, flags,
      attacker: input.attacker, defender: input.defender,
      baseDamage: 0, finalDamageBeforeLegendary: 0,
    };
    const legendaryTriggered = resolveLegendary(input, ctx, mods);

    const armorMods = createEmptyArmorMods();
    let armorLegendaryTriggered = false;
    if (input.defender.armor_legendary) {
      const armorCtx: ArmorTriggerContext = {
        hit, crit: false, killed: false, elementalProc: false, flags,
        attacker: input.attacker, defender: input.defender,
        baseIncomingDamage: 0, damageAfterArmor: 0, absorbedByArmor: 0,
        debuffsReceived: [...mods.statusOnDefender],
      };
      armorLegendaryTriggered = resolveArmorLegendary(input.defender.armor_legendary, armorCtx, armorMods);
    }

    // 饰品传奇结算（未命中时 killed=false，只有非击杀类触发器可能生效）
    const accessoryMods = resolveAccessories(input, {
      hit, killed: false, flags,
      attacker: input.attacker, defender: input.defender,
    });

    return {
      hit: false,
      hit_roll: hitRoll,
      hit_threshold: hitThreshold,
      crit: false,
      crit_roll: 0,
      crit_threshold: critThreshold,
      damage_raw: 0,
      strength_bonus: 0,
      damage_absorbed: 0,
      damage_final: 0,
      damage_type: input.attacker.weapon.damage_type,
      elemental_proc: false,
      legendary_triggered: legendaryTriggered,
      ...legendaryResultFields(mods),
      armor_legendary_triggered: armorLegendaryTriggered,
      ...armorResultFields(armorMods, 0),
      ...accessoryResultFields(accessoryMods),
      hp_remaining: input.defender.hp,
      killed: false,
    };
  }

  // 2. 暴击判定
  const critRoll = rollD100();
  const crit = critRoll <= critThreshold;

  // 3. 基础伤害
  const rawDamage = rollBetween(input.attacker.weapon.damage_min, input.attacker.weapon.damage_max);
  const strengthBonus = Math.floor(input.attacker.stats.strength / 4);
  const baseDamage = rawDamage + strengthBonus;

  // 4. 元素触发
  let elementalProc = false;
  let elementalDetail: string | undefined;
  if (input.attacker.element) {
    const procRoll = rollD100();
    elementalProc = procRoll <= input.attacker.element.proc_chance * 100;
    if (elementalProc) {
      elementalDetail = `${input.attacker.element.element_type} triggered (roll: ${procRoll}, threshold: ${input.attacker.element.proc_chance * 100})`;
    }
  }

  // 5. 传奇特效 Stage 1：pre-damage 触发器（on_hit / on_crit / on_attack_start 等）
  const preLegendary = computeFinalDamage(input.defender.armor, baseDamage, crit, createEmptyMods());
  const ctxPre: TriggerContext = {
    hit, crit, killed: false, elementalProc, flags,
    attacker: input.attacker, defender: input.defender,
    baseDamage, finalDamageBeforeLegendary: preLegendary.final,
  };
  let legendaryTriggered = resolveLegendary(input, ctxPre, mods);

  // 6. 合并 modifications 并计算最终伤害
  let { absorbed, final: finalDamage } = computeFinalDamage(input.defender.armor, baseDamage, crit, mods);
  let hpRemaining = Math.max(0, input.defender.hp - finalDamage);
  let killed = hpRemaining <= 0;

  // 7. 传奇特效 Stage 2：post-damage 触发器（on_kill / on_overkill / on_finishing_blow 等）
  if (!legendaryTriggered && input.attacker.legendary) {
    const ctxPost: TriggerContext = { ...ctxPre, killed, finalDamageBeforeLegendary: finalDamage };
    legendaryTriggered = resolveLegendary(input, ctxPost, mods);
    if (legendaryTriggered && modsAffectDamage(mods)) {
      ({ absorbed, final: finalDamage } = computeFinalDamage(input.defender.armor, baseDamage, crit, mods));
      hpRemaining = Math.max(0, input.defender.hp - finalDamage);
      killed = hpRemaining <= 0;
    }
  }

  // 8. 防具传奇结算（在武器传奇之后、最终 HP 落定之前）
  const armorMods = createEmptyArmorMods();
  let armorLegendaryTriggered = false;
  let armorDamageReduced = 0;
  if (input.defender.armor_legendary) {
    const armorCtx: ArmorTriggerContext = {
      hit, crit, killed, elementalProc, flags,
      attacker: input.attacker, defender: input.defender,
      baseIncomingDamage: baseDamage,
      damageAfterArmor: finalDamage,
      absorbedByArmor: absorbed,
      debuffsReceived: [...mods.statusOnDefender],
    };
    armorLegendaryTriggered = resolveArmorLegendary(input.defender.armor_legendary, armorCtx, armorMods);

    if (armorLegendaryTriggered) {
      // 8a. 减伤：先百分比减伤，再固定减伤
      if (armorMods.damageReduction > 0 || armorMods.flatBlock > 0) {
        const before = finalDamage;
        if (armorMods.damageReduction > 0) {
          finalDamage = Math.round(finalDamage * (1 - Math.min(1, armorMods.damageReduction)));
        }
        if (armorMods.flatBlock > 0) {
          finalDamage = Math.max(0, finalDamage - Math.round(armorMods.flatBlock));
        }
        armorDamageReduced = before - finalDamage;
        hpRemaining = Math.max(0, input.defender.hp - finalDamage);
        killed = hpRemaining <= 0;
      }
      // 8b. 净化：移除被 status_cleanse 清除的 debuff
      if (armorMods.cleansed.length > 0) {
        mods.statusOnDefender = mods.statusOnDefender.filter((s) => !armorMods.cleansed.includes(s));
      }
      // 8c. 治疗：元素吸收 / 紧急治疗（heal_on_kill 仅记录，不回写 HP）
      const healed = armorMods.hpRestored + armorMods.emergencyHeal;
      if (healed > 0) {
        const hpMax = input.defender.hp_max ?? input.defender.hp;
        hpRemaining = Math.min(hpMax, hpRemaining + healed);
        killed = hpRemaining <= 0;
      }
    }
  }

  return {
    hit: true,
    hit_roll: hitRoll,
    hit_threshold: hitThreshold,
    crit,
    crit_roll: critRoll,
    crit_threshold: critThreshold,
    damage_raw: rawDamage,
    strength_bonus: strengthBonus,
    damage_absorbed: absorbed,
    damage_final: finalDamage,
    damage_type: input.attacker.weapon.damage_type,
    elemental_proc: elementalProc,
    elemental_detail: elementalDetail,
    legendary_triggered: legendaryTriggered,
    ...legendaryResultFields(mods),
    armor_legendary_triggered: armorLegendaryTriggered,
    ...armorResultFields(armorMods, armorDamageReduced),
    ...accessoryResultFields(resolveAccessories(input, {
      hit, killed, flags,
      attacker: input.attacker, defender: input.defender,
    })),
    hp_remaining: hpRemaining,
    killed,
  };
}
