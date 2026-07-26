export interface CreateCharacterParams {
  name: string;
  hp_max?: number;
  stats?: {
    strength?: number;
    agility?: number;
    endurance?: number;
    perception?: number;
    intelligence?: number;
    willpower?: number;
  };
  skills?: {
    persuasion?: number;
    survival?: number;
    medicine?: number;
    mechanics?: number;
    barter?: number;
    stealth?: number;
    locksmith?: number;
    tracking?: number;
  };
  credits?: number;
  current_location?: string;
}

export function buildCharacterSQL(params: CreateCharacterParams): { sql: string; values: any[] } {
  const hpMax = params.hp_max ?? 30;
  const defaults = {
    strength: 5, agility: 5, endurance: 5, perception: 5, intelligence: 5, willpower: 5,
    persuasion: 5, survival: 5, medicine: 5, mechanics: 5, barter: 5, stealth: 5, locksmith: 5, tracking: 5,
  };
  const s = { ...defaults, ...params.stats };
  const sk = { ...defaults, ...params.skills };
  const credits = params.credits ?? 0;
  const location = params.current_location ?? null;

  const cols = ["name","is_player","level","xp","hp","hp_max",
    "strength","agility","endurance","perception","intelligence","willpower",
    "persuasion","survival","medicine","mechanics","barter","stealth","locksmith","tracking",
    "credits","current_location"];

  const values = [
    params.name, 1, 1, 0, hpMax, hpMax,
    s.strength, s.agility, s.endurance, s.perception, s.intelligence, s.willpower,
    sk.persuasion, sk.survival, sk.medicine, sk.mechanics, sk.barter, sk.stealth, sk.locksmith, sk.tracking,
    credits, location,
  ];

  const placeholders = values.map(() => "?").join(", ");
  return {
    sql: `INSERT INTO characters (${cols.join(", ")}) VALUES (${placeholders})`,
    values,
  };
}
