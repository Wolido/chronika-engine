import { describe, it, before } from "node:test";
import assert from "node:assert";
import { getSQL, rowsToObjects } from "../../db/connection.ts";
import { DDL_STATEMENTS } from "../../db/schema.ts";
import { takeLoot } from "../../engine/take-loot.ts";
import type { SqlJsStatic, Database } from "sql.js";

// ============================================================
// Helpers
// ============================================================

function freshDB(SQL: SqlJsStatic): Database {
  const db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON");
  db.run(DDL_STATEMENTS);
  return db;
}

/** Insert a character and return its id */
function insertCharacter(db: Database, overrides: Record<string, any> = {}): number {
  const defaults: Record<string, any> = {
    name: "测试角色",
    hp: 50,
    hp_max: 50,
    credits: 10,
  };
  const merged = { ...defaults, ...overrides };
  db.run(
    `INSERT INTO characters (name, hp, hp_max, credits) VALUES (?, ?, ?, ?)`,
    [merged.name, merged.hp, merged.hp_max, merged.credits],
  );
  const result = db.exec("SELECT last_insert_rowid() as id");
  return result[0].values[0][0] as number;
}

// ============================================================
// Tests
// ============================================================

describe("takeLoot", () => {
  let SQL: SqlJsStatic;

  before(async () => {
    SQL = await getSQL();
  });

  // --- 测试 1: 拿货币（瓶盖）-----------------------------------

  it("should add currency (瓶盖) to character credits", () => {
    // Arrange
    const db = freshDB(SQL);
    const character_id = insertCharacter(db, { credits: 10 });

    // Act
    const result = takeLoot({
      db,
      character_id,
      items: [{ type: "currency", name: "瓶盖", quantity: 20 }],
    });

    // Assert
    assert.strictEqual(result.success, true);

    const creditsResult = db.exec(
      `SELECT credits FROM characters WHERE id = ${character_id}`,
    );
    const credits = creditsResult[0].values[0][0] as number;

    assert.strictEqual(
      credits,
      30,
      `expected credits=30, got ${credits}`,
    );

    const takenBottlecap = result.taken.find(t => t.name === "瓶盖");
    assert.ok(takenBottlecap, "taken should contain 瓶盖");
    assert.strictEqual(takenBottlecap!.quantity, 20);

    db.close();
  });

  // --- 测试 2: 拿物品 ------------------------------------------

  it("should add item (治疗粉) to character inventory", () => {
    // Arrange
    const db = freshDB(SQL);
    const character_id = insertCharacter(db);

    // Insert an item into items table
    db.run(
      `INSERT INTO items (name, item_type, rarity, value) VALUES (?, ?, ?, ?)`,
      ["治疗粉", "consumable", "common", 5],
    );
    const itemResult = db.exec("SELECT last_insert_rowid() as id");
    const item_id = itemResult[0].values[0][0] as number;

    // Act
    const result = takeLoot({
      db,
      character_id,
      items: [{ type: "item", name: "治疗粉", quantity: 2 }],
    });

    // Assert
    assert.strictEqual(result.success, true);

    // Query inventory for this character
    const invResult = db.exec(
      `SELECT item_id, weapon_id, quantity FROM inventory WHERE character_id = ${character_id}`,
    );
    assert.ok(invResult.length > 0, "inventory should have records");
    const rows = rowsToObjects(invResult);

    const invRow = rows.find(r => r.item_id === item_id);
    assert.ok(invRow, `inventory should contain item_id=${item_id}`);
    assert.strictEqual(
      invRow!.quantity,
      2,
      `expected quantity=2, got ${invRow!.quantity}`,
    );

    db.close();
  });

  // --- 测试 3: 拿武器（武器已存在 weapons 表）------------------

  it("should add weapon (铁管) to character inventory with correct weapon_id", () => {
    // Arrange
    const db = freshDB(SQL);
    const character_id = insertCharacter(db);

    // Insert a weapon into weapons table
    db.run(
      `INSERT INTO weapons (name, category, damage_type, damage_min, damage_max, accuracy, rarity)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ["铁管", "melee", "bludgeoning", 3, 8, 0.75, "common"],
    );
    const weaponResult = db.exec("SELECT last_insert_rowid() as id");
    const weapon_id = weaponResult[0].values[0][0] as number;

    // Act
    const result = takeLoot({
      db,
      character_id,
      items: [{ type: "weapon", name: "铁管", quantity: 1 }],
    });

    // Assert
    assert.strictEqual(result.success, true);

    // Query inventory for this character
    const invResult = db.exec(
      `SELECT weapon_id, quantity FROM inventory WHERE character_id = ${character_id}`,
    );
    assert.ok(invResult.length > 0, "inventory should have records");
    const rows = rowsToObjects(invResult);

    const invRow = rows.find(r => r.weapon_id === weapon_id);
    assert.ok(invRow, `inventory should contain weapon_id=${weapon_id}`);
    assert.strictEqual(
      invRow!.quantity,
      1,
      `expected quantity=1, got ${invRow!.quantity}`,
    );

    db.close();
  });

  // --- 测试 4: 拿不存在的物品 → 报错 --------------------------

  it("should fail with error when taking a non-existent item", () => {
    // Arrange
    const db = freshDB(SQL);
    const character_id = insertCharacter(db);

    // Act
    const result = takeLoot({
      db,
      character_id,
      items: [{ type: "item", name: "不存在的东西", quantity: 1 }],
    });

    // Assert
    assert.strictEqual(
      result.success,
      false,
      "expected success=false for non-existent item",
    );
    assert.ok(
      result.errors.length > 0,
      "errors should be non-empty",
    );
    assert.ok(
      result.errors.some(e => e.includes("不存在的东西")),
      `errors should mention the missing item, got: ${JSON.stringify(result.errors)}`,
    );

    db.close();
  });

  // --- 测试 5: 部分成功（一个存在一个不存在）-------------------

  it("should partially succeed with one valid and one missing item", () => {
    // Arrange
    const db = freshDB(SQL);
    const character_id = insertCharacter(db);

    db.run(
      `INSERT INTO items (name, item_type, rarity, value) VALUES (?, ?, ?, ?)`,
      ["治疗粉", "consumable", "common", 5],
    );

    // Act
    const result = takeLoot({
      db,
      character_id,
      items: [
        { type: "item", name: "治疗粉", quantity: 1 },
        { type: "item", name: "不存在的", quantity: 1 },
      ],
    });

    // Assert
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.taken.length, 1);
    assert.strictEqual(result.errors.length, 1);
    assert.strictEqual(result.taken[0].name, "治疗粉");
    assert.ok(result.errors[0].includes("不存在的"));

    db.close();
  });

  // --- 测试 6: 负数量被拒绝 ----------------------------------

  it("should reject negative quantity", () => {
    // Arrange
    const db = freshDB(SQL);
    const character_id = insertCharacter(db);

    // Act
    const result = takeLoot({
      db,
      character_id,
      items: [{ type: "currency", name: "瓶盖", quantity: -5 }],
    });

    // Assert
    assert.strictEqual(result.success, false);
    assert.ok(result.errors.length > 0, "errors should be non-empty");
    assert.ok(
      result.errors.some(e => e.includes("Invalid quantity")),
      `errors should mention invalid quantity, got: ${JSON.stringify(result.errors)}`,
    );

    db.close();
  });

  // --- 测试 7: 武器缺失 --------------------------------------

  it("should fail with error when weapon not found", () => {
    // Arrange
    const db = freshDB(SQL);
    const character_id = insertCharacter(db);

    // Act
    const result = takeLoot({
      db,
      character_id,
      items: [{ type: "weapon", name: "不存在的武器", quantity: 1 }],
    });

    // Assert
    assert.strictEqual(result.success, false);
    assert.ok(
      result.errors.some(e => e.includes("Weapon")),
      `errors should contain "Weapon", got: ${JSON.stringify(result.errors)}`,
    );

    db.close();
  });

  // --- 测试 8: 未知 type -------------------------------------

  it("should reject unknown item type", () => {
    // Arrange
    const db = freshDB(SQL);
    const character_id = insertCharacter(db);

    // Act
    const result = takeLoot({
      db,
      character_id,
      items: [{ type: "armor", name: "什么甲", quantity: 1 }],
    });

    // Assert
    assert.strictEqual(result.success, false);
    assert.ok(
      result.errors.some(e => e.includes("Unknown")),
      `errors should contain "Unknown", got: ${JSON.stringify(result.errors)}`,
    );

    db.close();
  });
});
