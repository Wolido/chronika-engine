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

export interface CreateCharacterInput extends CreateCharacterParams {
  skip_initial_weapon?: boolean;
}

export interface CreateCharacterResult {
  success: boolean;
  character_id: number;
  name: string;
  weapon_id?: number;
  weapon_name?: string;
}

/**
 * 创建角色，自动送初始武器（生锈匕首）并装备。
 * 如果 skip_initial_weapon=true 则不送武器。
 * 全程事务：角色创建或武器写入任一失败则整体回滚。
 */
export function createCharacter(db: any, input: CreateCharacterInput): CreateCharacterResult {
  const { sql, values } = buildCharacterSQL({
    name: input.name,
    hp_max: input.hp_max,
    stats: input.stats,
    skills: input.skills,
    credits: input.credits,
    current_location: input.current_location,
  });

  // 开始事务
  db.run("BEGIN TRANSACTION");

  try {
    // 创建角色
    db.run(sql, values);
    const result = db.exec("SELECT last_insert_rowid() as id");
    const charId = result[0]?.values[0]?.[0] as number;

    let weaponId: number | undefined;
    let weaponName: string | undefined;

    if (!input.skip_initial_weapon) {
      // 生锈匕首数据
      weaponName = "生锈匕首";
      // 查找或创建初始武器（weapons.name 有 UNIQUE 约束，不能重复插入）
      const existingWeapon = db.exec("SELECT id FROM weapons WHERE name = ?", [weaponName]);
      if (existingWeapon.length > 0 && existingWeapon[0].values.length > 0) {
        weaponId = existingWeapon[0].values[0][0] as number;
      } else {
        db.run(
          `INSERT INTO weapons (name, category, damage_type, damage_min, damage_max, accuracy, rarity, tier, weight, value, description)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [weaponName, "melee", "piercing", 2, 5, 0.72, "common", 1, 1.0, 5, "一把生锈的匕首，刀刃上布满了缺口。虽然粗糙，但在废土上聊胜于无。"]
        );
        const weaponResult = db.exec("SELECT last_insert_rowid() as id");
        weaponId = weaponResult[0]?.values[0]?.[0] as number;
      }

      // 写入 inventory，标记已装备
      db.run(
        "INSERT INTO inventory (character_id, weapon_id, quantity, is_equipped) VALUES (?, ?, 1, 1)",
        [charId, weaponId]
      );
    }

    db.run("COMMIT");

    return { success: true, character_id: charId, name: input.name, weapon_id: weaponId, weapon_name: weaponName };
  } catch (err) {
    try { db.run("ROLLBACK"); } catch (_) {}
    throw err;
  }
}
