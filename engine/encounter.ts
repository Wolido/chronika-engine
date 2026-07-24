export interface EncounterRequest {
  danger_level: number;
  db: any;
}

export interface EncounterMonster {
  name: string;
  category: string;
  hp: number;
  damage_min: number;
  damage_max: number;
  accuracy: number;
  evasion: number;
  armor: number;
  tier: number;
  xp_reward: number;
}

export interface EncounterResult {
  success: boolean;
  monster: EncounterMonster;
  approximate: boolean;
  note: string;
  error?: string;
}

export function getEncounter(input: EncounterRequest): EncounterResult {
  const { danger_level, db } = input;

  // 1. Try exact tier match
  const exactResult = db.exec(`SELECT name, category, hp, damage_min, damage_max, accuracy, evasion, armor, tier, xp_reward FROM monsters WHERE tier = ${danger_level}`);

  if (exactResult.length > 0 && exactResult[0].values.length > 0) {
    const row = exactResult[0].values[Math.floor(Math.random() * exactResult[0].values.length)];
    return {
      success: true,
      monster: {
        name: row[0] as string, category: row[1] as string, hp: row[2] as number,
        damage_min: row[3] as number, damage_max: row[4] as number,
        accuracy: row[5] as number, evasion: row[6] as number,
        armor: row[7] as number, tier: row[8] as number, xp_reward: row[9] as number,
      },
      approximate: false,
      note: `Exact tier ${danger_level} match.`,
    };
  }

  // 2. Find closest tier
  const allResult = db.exec("SELECT name, category, hp, damage_min, damage_max, accuracy, evasion, armor, tier, xp_reward FROM monsters ORDER BY ABS(tier - " + danger_level + ") LIMIT 1");

  if (allResult.length > 0 && allResult[0].values.length > 0) {
    const row = allResult[0].values[0];
    const foundTier = row[8] as number;
    return {
      success: true,
      monster: {
        name: row[0] as string, category: row[1] as string, hp: row[2] as number,
        damage_min: row[3] as number, damage_max: row[4] as number,
        accuracy: row[5] as number, evasion: row[6] as number,
        armor: row[7] as number, tier: foundTier, xp_reward: row[9] as number,
      },
      approximate: true,
      note: `No exact tier ${danger_level} match. Using closest (tier ${foundTier}).`,
    };
  }

  // 3. No monsters at all
  return {
    success: false,
    monster: { name: "", category: "", hp: 0, damage_min: 0, damage_max: 0, accuracy: 0, evasion: 0, armor: 0, tier: 0, xp_reward: 0 },
    approximate: false,
    note: "",
    error: "No monsters found in database. Use world_gen to add monsters first, or create custom combat encounters manually.",
  };
}
