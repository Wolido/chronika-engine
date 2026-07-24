import { generateSeed } from "./legendary-gen.ts";

export interface GenerateWeaponInput {
  weapon_type?: string;
  min_rarity?: string;
  max_rarity?: string;
  name_hint?: string;
  tier?: number;
}

export interface GeneratedWeapon {
  name: string;
  category: string;
  damage_type: string;
  damage_min: number;
  damage_max: number;
  accuracy: number;
  tier: number;
  rarity: string;
  weight: number;
  value: number;
  description: string;
  range_min?: number;
  range_max?: number;
  ammo_type?: string;
  element?: { element_type: string; proc_chance: number };
  legendary_effect?: {
    effect_name: string;
    trigger: string;
    effect_type: string;
    magnitude: number;
    description: string;
  };
}

export interface GenerateWeaponResult {
  success: boolean;
  weapon: GeneratedWeapon;
  rolls: {
    rarity_roll: number;
    type_roll: number;
    damage_roll: number;
    element_roll?: number;
    legendary_roll?: number;
  };
}

const RARITIES = ["common", "uncommon", "rare", "legendary"];
const WEAPON_TYPES = ["melee", "ranged", "thrown"];
const DAMAGE_TYPES = ["slashing", "piercing", "bludgeoning", "thermal", "explosive", "chemical"];
const ELEMENT_TYPES = [
  { type: "fire", proc: 0.3 },
  { type: "corrosive", proc: 0.25 },
  { type: "shock", proc: 0.25 },
  { type: "frost", proc: 0.2 },
  { type: "explosive", proc: 0.15 },
];

const NAME_PREFIXES: Record<string, string[]> = {
  common: ["破旧的", "生锈的", "磨损的"],
  uncommon: ["坚固的", "改装的", "战术"],
  rare: ["精制", "强化", "原型"],
  legendary: ["末日", "天罚", "不朽", "虚空", "龙息"],
};

const NAME_SUFFIXES: Record<string, string[]> = {
  melee: ["砍刀", "铁管", "匕首", "战斧", "棍棒"],
  ranged: ["手枪", "步枪", "霰弹枪", "冲锋枪", "猎枪"],
  thrown: ["飞刀", "手榴弹", "燃烧瓶"],
};

// Damage ranges by type and rarity
const DAMAGE_BY_RARITY: Record<string, { min: number; max: number }> = {
  common: { min: 2, max: 8 },
  uncommon: { min: 5, max: 14 },
  rare: { min: 9, max: 22 },
  legendary: { min: 14, max: 35 },
};

// Accuracy by type
const ACCURACY_BY_TYPE: Record<string, number> = {
  melee: 0.75,
  ranged: 0.6,
  thrown: 0.5,
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rollBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function rollRarity(minRarity: string, maxRarity: string): { rarity: string; roll: number } {
  const minIdx = RARITIES.indexOf(minRarity);
  const maxIdx = RARITIES.indexOf(maxRarity);
  const roll = Math.floor(Math.random() * (maxIdx - minIdx + 1)) + minIdx;
  return { rarity: RARITIES[roll], roll };
}

export function generateWeapon(input: GenerateWeaponInput): GenerateWeaponResult {
  const weaponType = input.weapon_type || pick(WEAPON_TYPES);
  const minRarity = input.min_rarity || "common";
  const maxRarity = input.max_rarity || "legendary";

  const { rarity, roll: rarityRoll } = rollRarity(minRarity, maxRarity);
  const damageType = pick(DAMAGE_TYPES);
  const tier = input.tier || (RARITIES.indexOf(rarity) + 1);
  
  const dmgRange = DAMAGE_BY_RARITY[rarity];
  const dmgMin = rollBetween(dmgRange.min, Math.floor(dmgRange.max * 0.6));
  const dmgMax = rollBetween(Math.max(dmgMin + 1, Math.floor(dmgRange.max * 0.5)), dmgRange.max);
  const accuracy = ACCURACY_BY_TYPE[weaponType] + (Math.random() * 0.2 - 0.1);
  const clippedAccuracy = Math.max(0.3, Math.min(0.95, accuracy));
  const weight = weaponType === "melee" ? rollBetween(2, 6) : rollBetween(1, 4);
  const value = (RARITIES.indexOf(rarity) + 1) * dmgMax * 2;

  // Generate name
  const prefix = pick(NAME_PREFIXES[rarity] || NAME_PREFIXES.common);
  const suffix = pick(NAME_SUFFIXES[weaponType] || NAME_SUFFIXES.melee);
  const name = input.name_hint || `${prefix}${suffix}`;

  // Ranged extras
  let rangeMin: number | undefined;
  let rangeMax: number | undefined;
  let ammoType: string | undefined;
  if (weaponType === "ranged") {
    rangeMin = rollBetween(2, 5);
    rangeMax = rollBetween(10, 30);
    ammoType = pick(["9mm", "556", "308", "shotgun", "energy"]);
  } else if (weaponType === "thrown") {
    rangeMin = 1;
    rangeMax = rollBetween(3, 8);
    ammoType = pick(["throwing_knife", "grenade", "molotov"]);
  }

  // Element (uncommon+ has chance)
  let element: { element_type: string; proc_chance: number } | undefined;
  let elementRoll: number | undefined;
  const rarityIdx = RARITIES.indexOf(rarity);
  if (rarityIdx >= 1 && Math.random() < rarityIdx * 0.25) {
    const el = pick(ELEMENT_TYPES);
    element = { element_type: el.type, proc_chance: el.proc };
    elementRoll = Math.floor(Math.random() * 100);
  }

  // Legendary effect
  let legendaryEffect: GeneratedWeapon["legendary_effect"] | undefined;
  let legendaryRoll: number | undefined;
  if (rarity === "legendary") {
    const seed = generateSeed();
    const mag = rollBetween(Math.ceil(seed.magnitude_min), Math.floor(seed.magnitude_max));
    legendaryEffect = {
      effect_name: pick(["穷途末路", "弹射弹头", "天降正义", "吸血鬼之吻", "元素风暴", "杀戮狂欢", "无限弹药", "狂暴模式"]),
      trigger: seed.trigger,
      effect_type: seed.effect_type,
      magnitude: mag,
      description: seed.description_template.replace("{magnitude}", String(mag)),
    };
    legendaryRoll = Math.floor(Math.random() * 100);
  }

  const weapon: GeneratedWeapon = {
    name, category: weaponType, damage_type: damageType,
    damage_min: dmgMin, damage_max: dmgMax,
    accuracy: Math.round(clippedAccuracy * 100) / 100,
    tier, rarity, weight, value,
    description: `A ${rarity} ${weaponType} weapon that deals ${dmgMin}-${dmgMax} ${damageType} damage.`,
    range_min: rangeMin, range_max: rangeMax, ammo_type: ammoType,
    element, legendary_effect: legendaryEffect,
  };

  return {
    success: true,
    weapon,
    rolls: {
      rarity_roll: rarityRoll,
      type_roll: WEAPON_TYPES.indexOf(weaponType),
      damage_roll: dmgMin,
      element_roll: elementRoll,
      legendary_roll: legendaryRoll,
    },
  };
}
