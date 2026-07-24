// ============================================================
// take_loot — add selected loot to character inventory/credits
// ============================================================

export interface TakeLootItem {
  type: "currency" | "item" | "weapon";
  name: string;
  quantity: number;
  rarity?: string;
}

export interface TakeLootInput {
  db: any;
  character_id: number;
  items: TakeLootItem[];
}

export interface TakeLootResult {
  success: boolean;
  taken: { name: string; quantity: number }[];
  errors: string[];
}

export function takeLoot(input: TakeLootInput): TakeLootResult {
  const taken: { name: string; quantity: number }[] = [];
  const errors: string[] = [];

  for (const item of input.items) {
    if (!Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isInteger(item.quantity)) {
      errors.push(`Invalid quantity ${item.quantity} for "${item.name}"`);
      continue;
    }

    if (item.type === "currency") {
      const stmt = input.db.prepare("UPDATE characters SET credits = COALESCE(credits, 0) + ? WHERE id = ?");
      stmt.bind([item.quantity, input.character_id]);
      stmt.step();
      stmt.free();
      taken.push({ name: item.name, quantity: item.quantity });
    } else if (item.type === "item") {
      const stmt = input.db.prepare("SELECT id FROM items WHERE name = ?");
      stmt.bind([item.name]);
      if (stmt.step()) {
        const row = stmt.getAsObject();
        const itemId = row.id as number;
        stmt.free();

        // Check if already in inventory
        const checkStmt = input.db.prepare("SELECT id, quantity FROM inventory WHERE character_id = ? AND item_id = ?");
        checkStmt.bind([input.character_id, itemId]);
        if (checkStmt.step()) {
          const existing = checkStmt.getAsObject();
          checkStmt.free();
          input.db.run("UPDATE inventory SET quantity = quantity + ? WHERE id = ?", [item.quantity, existing.id]);
        } else {
          checkStmt.free();
          input.db.run("INSERT INTO inventory (character_id, item_id, quantity) VALUES (?, ?, ?)", [input.character_id, itemId, item.quantity]);
        }
        taken.push({ name: item.name, quantity: item.quantity });
      } else {
        stmt.free();
        errors.push(`Item "${item.name}" not found in database`);
      }
    } else if (item.type === "weapon") {
      const stmt = input.db.prepare("SELECT id FROM weapons WHERE name = ?");
      stmt.bind([item.name]);
      if (stmt.step()) {
        const row = stmt.getAsObject();
        const weaponId = row.id as number;
        stmt.free();
        input.db.run("INSERT INTO inventory (character_id, weapon_id, quantity, is_equipped) VALUES (?, ?, ?, 0)", [input.character_id, weaponId, item.quantity]);
        taken.push({ name: item.name, quantity: item.quantity });
      } else {
        stmt.free();
        errors.push(`Weapon "${item.name}" not found in database`);
      }
    } else {
      errors.push(`Unknown item type "${item.type}" for "${item.name}"`);
    }
  }

  return { success: errors.length === 0, taken, errors };
}
