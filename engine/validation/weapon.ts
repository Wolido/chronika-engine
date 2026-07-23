export interface WeaponData {
  name: string;
  category: string;
  damage_type: string;
  damage_min: number;
  damage_max: number;
  accuracy: number;
  tier: number;
  rarity: string;
  range_min?: number;
  range_max?: number;
  ammo_type?: string;
  [key: string]: any;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const VALID_CATEGORIES = ["melee", "ranged", "thrown", "explosive"] as const;
const VALID_DAMAGE_TYPES = ["slashing", "piercing", "bludgeoning", "thermal", "explosive", "chemical"] as const;
const VALID_RARITIES = ["common", "uncommon", "rare", "legendary"] as const;

export function validateWeapon(weapon: WeaponData): ValidationResult {
  const errors: string[] = [];

  // 必填字段
  if (!weapon.name || weapon.name.trim() === "") {
    errors.push("weapon name is required and must be non-empty");
  }

  // category 枚举
  if (!VALID_CATEGORIES.includes(weapon.category as any)) {
    errors.push(`weapon category must be one of: ${VALID_CATEGORIES.join(", ")}`);
  }

  // damage_type 枚举
  if (!VALID_DAMAGE_TYPES.includes(weapon.damage_type as any)) {
    errors.push(`weapon damage_type must be one of: ${VALID_DAMAGE_TYPES.join(", ")}`);
  }

  // damage_min ≥ 1
  if (weapon.damage_min === undefined || weapon.damage_min === null) {
    errors.push("weapon damage_min is required");
  } else if (weapon.damage_min < 1) {
    errors.push("weapon damage_min must be ≥ 1");
  }

  // damage_max ≤ 50
  if (weapon.damage_max === undefined || weapon.damage_max === null) {
    errors.push("weapon damage_max is required");
  } else if (weapon.damage_max > 50) {
    errors.push("weapon damage_max must be ≤ 50");
  }

  // damage_min ≤ damage_max
  if (weapon.damage_min > weapon.damage_max) {
    errors.push("weapon damage_min must be ≤ damage_max");
  }

  // accuracy ∈ [0.0, 1.0]
  if (weapon.accuracy === undefined || weapon.accuracy === null) {
    errors.push("weapon accuracy is required");
  } else if (weapon.accuracy < 0 || weapon.accuracy > 1) {
    errors.push("weapon accuracy must be between 0.0 and 1.0");
  }

  // tier ∈ [1, 5]
  if (weapon.tier === undefined || weapon.tier === null) {
    errors.push("weapon tier is required");
  } else if (weapon.tier < 1 || weapon.tier > 5) {
    errors.push("weapon tier must be between 1 and 5");
  }

  // rarity 枚举
  if (!VALID_RARITIES.includes(weapon.rarity as any)) {
    errors.push(`weapon rarity must be one of: ${VALID_RARITIES.join(", ")}`);
  }

  // 条件依赖：远程/投掷武器必须有 range + ammo
  if (weapon.category === "ranged" || weapon.category === "thrown") {
    if (weapon.range_min === undefined || weapon.range_min === null) {
      errors.push("ranged/thrown weapons must have range_min");
    }
    if (weapon.range_max === undefined || weapon.range_max === null) {
      errors.push("ranged/thrown weapons must have range_max");
    }
    if (!weapon.ammo_type) {
      errors.push("ranged/thrown weapons must have ammo_type");
    }
    if (weapon.range_min !== undefined && weapon.range_max !== undefined) {
      if (weapon.range_max <= weapon.range_min) {
        errors.push("range_max must be greater than range_min");
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
