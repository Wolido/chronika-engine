export interface MonsterData {
  name: string;
  category: string;
  hp: number;
  damage_min: number;
  damage_max: number;
  accuracy: number;
  evasion: number;
  tier: number;
  strength: number;
  agility: number;
  endurance: number;
  perception: number;
  intelligence: number;
  willpower: number;
  [key: string]: any;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const VALID_CATEGORIES: readonly string[] = ["beast", "mutant", "humanoid", "mechanical", "abomination"];
const ATTRIBUTES = ["strength", "agility", "endurance", "perception", "intelligence", "willpower"] as const;

export function validateMonster(monster: MonsterData): ValidationResult {
  const errors: string[] = [];

  // name
  if (!monster.name || monster.name.trim() === "") {
    errors.push("monster name is required");
  }

  // category
  if (!VALID_CATEGORIES.includes(monster.category)) {
    errors.push(`monster category must be one of: ${VALID_CATEGORIES.join(", ")}`);
  }

  // hp
  if (monster.hp === undefined || monster.hp === null) {
    errors.push("monster hp is required");
  } else if (monster.hp <= 0) {
    errors.push("monster hp must be > 0");
  }

  // damage_min
  if (monster.damage_min === undefined || monster.damage_min === null) {
    errors.push("monster damage_min is required");
  } else if (monster.damage_min < 1) {
    errors.push("monster damage_min must be ≥ 1");
  }

  // damage_max
  if (monster.damage_max === undefined || monster.damage_max === null) {
    errors.push("monster damage_max is required");
  } else if (monster.damage_max > 50) {
    errors.push("monster damage_max must be ≤ 50");
  }

  // damage_min ≤ damage_max (only if both are defined)
  if (monster.damage_min !== undefined && monster.damage_max !== undefined &&
      monster.damage_min !== null && monster.damage_max !== null &&
      monster.damage_min > monster.damage_max) {
    errors.push("monster damage_min must be ≤ damage_max");
  }

  // accuracy
  if (monster.accuracy === undefined || monster.accuracy === null) {
    errors.push("monster accuracy is required");
  } else if (monster.accuracy < 0 || monster.accuracy > 1) {
    errors.push("monster accuracy must be between 0.0 and 1.0");
  }

  // evasion
  if (monster.evasion === undefined || monster.evasion === null) {
    errors.push("monster evasion is required");
  } else if (monster.evasion < 0 || monster.evasion > 1) {
    errors.push("monster evasion must be between 0.0 and 1.0");
  }

  // tier
  if (monster.tier === undefined || monster.tier === null) {
    errors.push("monster tier is required");
  } else if (monster.tier < 1 || monster.tier > 5) {
    errors.push("monster tier must be between 1 and 5");
  }

  // balance: accuracy + evasion ≤ 1.3
  if (monster.accuracy !== undefined && monster.accuracy !== null &&
      monster.evasion !== undefined && monster.evasion !== null &&
      monster.accuracy + monster.evasion > 1.3) {
    errors.push("monster accuracy + evasion must be ≤ 1.3");
  }

  // attribute checks
  let statSum = 0;
  for (const attr of ATTRIBUTES) {
    const val = monster[attr];
    if (val === undefined || val === null) {
      errors.push(`monster ${attr} is required`);
    } else if (val < 1) {
      errors.push(`monster ${attr} must be ≥ 1`);
    } else if (val > 20) {
      errors.push(`monster ${attr} must be ≤ 20`);
    } else {
      statSum += val;
    }
  }

  // balance: stat sum ≤ tier × 17
  if (monster.tier !== undefined && monster.tier !== null) {
    const maxStatSum = monster.tier * 17;
    if (statSum > maxStatSum) {
      errors.push(`monster stat sum (${statSum}) must be ≤ tier × 17 (${maxStatSum})`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
