export interface LevelUpInput {
  level: number;
  xp: number;
  xp_for_next?: number;
  attribute_points?: number;
  skill_points?: number;
}

export interface LevelUpResult {
  leveled_up: boolean;
  new_level: number;
  xp_remaining: number;
  xp_for_next: number;
  attribute_points_gained: number;
  total_attribute_points: number;
  skill_points_gained: number;
  total_skill_points: number;
}

export function levelUp(input: LevelUpInput): LevelUpResult {
  let currentLevel = input.level;
  let remainingXp = input.xp;
  const xpBase = input.xp_for_next ?? 100;
  const attrPerLevel = input.attribute_points ?? 1;
  const skillPerLevel = input.skill_points ?? 3;
  let totalAttrPoints = 0;
  let totalSkillPoints = 0;

  while (true) {
    const needed = currentLevel * xpBase;
    if (remainingXp < needed) {
      return {
        leveled_up: currentLevel > input.level,
        new_level: currentLevel,
        xp_remaining: remainingXp,
        xp_for_next: needed,
        attribute_points_gained: totalAttrPoints,
        total_attribute_points: totalAttrPoints,
        skill_points_gained: totalSkillPoints,
        total_skill_points: totalSkillPoints,
      };
    }
    remainingXp -= needed;
    currentLevel++;
    totalAttrPoints += attrPerLevel;
    totalSkillPoints += skillPerLevel;
  }
}
