export interface CreateQuestInput {
  db: any;
  title: string;
  description: string;
  quest_type: string;
  giver_npc: string;
  target_location?: string;
  reward_credits?: number;
  reward_item_name?: string;
  reward_weapon_name?: string;
  time_limit_minutes?: number;
}

export interface CreateQuestResult {
  success: boolean;
  quest_id: number;
  error?: string;
}

export interface QuestEntry {
  id: number;
  title: string;
  description: string;
  quest_type: string;
  giver_npc: string;
  target_location: string | null;
  reward_credits: number;
  status: string;
  accepted_at: string;
}

export interface ActiveQuestsResult {
  quests: QuestEntry[];
}

export interface CompleteQuestInput {
  db: any;
  quest_id: number;
  character_id: number;
}

export interface CompleteQuestResult {
  success: boolean;
  quest_title: string;
  credits_gained: number;
  item_gained?: string;
  weapon_gained?: string;
  error?: string;
}

export function createQuest(input: CreateQuestInput): CreateQuestResult {
  if (!input.title || input.title.trim() === "") {
    return { success: false, quest_id: 0, error: "Quest title is required" };
  }
  const VALID_TYPES = ["delivery", "exploration", "fetch", "kill"];
  if (!VALID_TYPES.includes(input.quest_type)) {
    return { success: false, quest_id: 0, error: `Invalid quest type "${input.quest_type}". Must be one of: ${VALID_TYPES.join(", ")}` };
  }

  input.db.run(
    "INSERT INTO quests (title, description, quest_type, giver_npc, target_location, reward_credits, reward_item_name, reward_weapon_name, time_limit_minutes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')",
    [input.title, input.description || null, input.quest_type, input.giver_npc || null, input.target_location || null, input.reward_credits || 0, input.reward_item_name || null, input.reward_weapon_name || null, input.time_limit_minutes || null]
  );

  // Get last insert ID
  const stmt = input.db.prepare("SELECT last_insert_rowid() as id");
  stmt.step();
  const row = stmt.getAsObject();
  stmt.free();

  return { success: true, quest_id: row.id as number };
}

export function getActiveQuests(db: any): ActiveQuestsResult {
  const stmt = db.prepare("SELECT id, title, description, quest_type, giver_npc, target_location, reward_credits, status, accepted_at FROM quests WHERE status = 'active' ORDER BY id");
  const quests: QuestEntry[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    quests.push({
      id: row.id as number,
      title: row.title as string,
      description: row.description as string,
      quest_type: row.quest_type as string,
      giver_npc: row.giver_npc as string,
      target_location: row.target_location as string | null,
      reward_credits: row.reward_credits as number,
      status: row.status as string,
      accepted_at: row.accepted_at as string,
    });
  }
  stmt.free();
  return { quests };
}

export function completeQuest(input: CompleteQuestInput): CompleteQuestResult {
  try {
    input.db.run("BEGIN");

    // Check character exists
    const charStmt = input.db.prepare("SELECT id FROM characters WHERE id = ?");
    charStmt.bind([input.character_id]);
    if (!charStmt.step()) {
      charStmt.free();
      input.db.run("ROLLBACK");
      return { success: false, quest_title: "", credits_gained: 0, error: `Character #${input.character_id} not found` };
    }
    charStmt.free();

    // Check quest exists (inside transaction)
    const checkStmt = input.db.prepare("SELECT id, title, status, reward_credits, reward_item_name, reward_weapon_name FROM quests WHERE id = ?");
    checkStmt.bind([input.quest_id]);
    if (!checkStmt.step()) {
      checkStmt.free();
      input.db.run("ROLLBACK");
      return { success: false, quest_title: "", credits_gained: 0, error: `Quest #${input.quest_id} not found` };
    }

    const quest = checkStmt.getAsObject();
    checkStmt.free();

    if (quest.status !== "active") {
      input.db.run("ROLLBACK");
      return { success: false, quest_title: quest.title as string, credits_gained: 0, error: `Quest "${quest.title}" is already completed` };
    }

    const creditsGained = (quest.reward_credits as number) || 0;
    const itemName = quest.reward_item_name as string | null;
    const weaponName = quest.reward_weapon_name as string | null;

    // Apply credits
    if (creditsGained > 0) {
      input.db.run("UPDATE characters SET credits = COALESCE(credits, 0) + ? WHERE id = ?", [creditsGained, input.character_id]);
    }

    // Apply item reward
    let itemGained: string | undefined;
    if (itemName) {
      const itemStmt = input.db.prepare("SELECT id FROM items WHERE name = ?");
      itemStmt.bind([itemName]);
      if (itemStmt.step()) {
        const itemRow = itemStmt.getAsObject();
        itemStmt.free();
        input.db.run("INSERT INTO inventory (character_id, item_id, quantity) VALUES (?, ?, 1)", [input.character_id, itemRow.id]);
        itemGained = itemName;
      } else {
        itemStmt.free();
      }
    }

    // Apply weapon reward
    let weaponGained: string | undefined;
    if (weaponName) {
      const wpnStmt = input.db.prepare("SELECT id FROM weapons WHERE name = ?");
      wpnStmt.bind([weaponName]);
      if (wpnStmt.step()) {
        const wpnRow = wpnStmt.getAsObject();
        wpnStmt.free();
        input.db.run("INSERT INTO inventory (character_id, weapon_id, quantity, is_equipped) VALUES (?, ?, 1, 0)", [input.character_id, wpnRow.id]);
        weaponGained = weaponName;
      } else {
        wpnStmt.free();
      }
    }

    // Mark quest completed
    input.db.run("UPDATE quests SET status = 'completed', completed_at = datetime('now') WHERE id = ?", [input.quest_id]);

    input.db.run("COMMIT");

    return {
      success: true,
      quest_title: quest.title as string,
      credits_gained: creditsGained,
      item_gained: itemGained,
      weapon_gained: weaponGained,
    };
  } catch (err) {
    try { input.db.run("ROLLBACK"); } catch {}
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, quest_title: "", credits_gained: 0, error: `Failed to complete quest: ${msg}` };
  }
}
