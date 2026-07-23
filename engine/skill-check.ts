export interface SkillCheckInput {
  difficulty: number;
  modifier?: number;
}

export interface SkillCheckResult {
  success: boolean;
  roll: number;
  total: number;
  difficulty: number;
  margin: number;
  critical: boolean;
}

function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1;
}

export function skillCheck(input: SkillCheckInput): SkillCheckResult {
  const modifier = input.modifier ?? 0;
  const roll = rollD20();
  const total = roll + modifier;
  const margin = total - input.difficulty;
  const success = total >= input.difficulty;
  const critical = margin >= 10 || margin <= -10;

  return {
    success,
    roll,
    total,
    difficulty: input.difficulty,
    margin,
    critical,
  };
}
