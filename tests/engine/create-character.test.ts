/**
 * create-character.test.ts — 角色创建引擎测试（v0.9.0 RED phase）
 *
 * 验证 buildCharacterSQL 输出以及 createCharacter 在创建角色后
 * 自动生成初始武器（生锈匕首）并写入已装备 inventory。
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { getSQL } from "../../db/connection.ts";
import { DDL_STATEMENTS } from "../../db/schema.ts";
import type { SqlJsStatic, Database } from "sql.js";
import { buildCharacterSQL } from "../../engine/create-character.ts";
import type { CreateCharacterParams } from "../../engine/create-character.ts";

// Extended input type for RED phase: skip initial weapon.
interface CreateCharacterInput extends CreateCharacterParams {
  skip_initial_weapon?: boolean;
}

let SQL: SqlJsStatic;

async function createDB(): Promise<Database> {
  const sql = await getSQL();
  const db = new sql.Database();
  db.run("PRAGMA foreign_keys = ON");
  db.run(DDL_STATEMENTS);
  return db;
}

function queryOne(db: Database, sql: string, params: any[] = []): Record<string, any> | null {
  const stmt = (db as any).prepare(sql);
  if (params.length > 0) stmt.bind(params);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const obj = stmt.getAsObject();
  stmt.free();
  return obj as Record<string, any>;
}

function queryAll(db: Database, sql: string, params: any[] = []): Record<string, any>[] {
  const stmt = (db as any).prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const rows: Record<string, any>[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as Record<string, any>);
  }
  stmt.free();
  return rows;
}

function countRows(db: Database, sql: string, params: any[] = []): number {
  const row = queryOne(db, sql, params);
  return row ? (row.c as number) : 0;
}

async function getCreateCharacter() {
  const mod = (await import("../../engine/create-character.ts")) as any;
  return mod.createCharacter as (db: any, params: CreateCharacterParams) => any;
}

// ---------------------------------------------------------------------------
// buildCharacterSQL
// ---------------------------------------------------------------------------

describe("buildCharacterSQL", () => {
  it("should return sql that includes the characters INSERT", () => {
    // Arrange
    const params: CreateCharacterParams = { name: "流浪者" };

    // Act
    const { sql } = buildCharacterSQL(params);

    // Assert
    assert.ok(sql.includes("INSERT INTO characters"));
  });
});

// ---------------------------------------------------------------------------
// createCharacter initial weapon
// ---------------------------------------------------------------------------

describe("createCharacter", () => {
  it("should create an inventory weapon record with is_equipped=1", async () => {
    // Arrange
    const db = await createDB();
    const params: CreateCharacterInput = { name: "艾丽丝" };

    // Act
    const createCharacter = await getCreateCharacter();
    const result = createCharacter(db, params as CreateCharacterParams);

    // Assert
    assert.strictEqual(result.success, true);
    assert.ok(result.character_id > 0);

    const inv = queryOne(
      db,
      "SELECT weapon_id, is_equipped FROM inventory WHERE character_id = ?",
      [result.character_id]
    );
    assert.ok(inv, "Expected an inventory row for the new character");
    assert.ok((inv!.weapon_id as number) > 0);
    assert.strictEqual(inv!.is_equipped, 1);

    db.close();
  });

  it("should generate a common tier-1 initial weapon with a name", async () => {
    // Arrange
    const db = await createDB();
    const params: CreateCharacterInput = { name: "鲍勃" };

    // Act
    const createCharacter = await getCreateCharacter();
    const result = createCharacter(db, params as CreateCharacterParams);

    // Assert
    assert.strictEqual(result.success, true);

    const inv = queryOne(
      db,
      "SELECT weapon_id FROM inventory WHERE character_id = ?",
      [result.character_id]
    );
    assert.ok(inv);

    const weapon = queryOne(db, "SELECT name, tier, rarity FROM weapons WHERE id = ?", [
      inv!.weapon_id as number,
    ]);
    assert.ok(weapon, "Expected the initial weapon to exist in weapons table");
    assert.ok((weapon!.name as string).length > 0);
    assert.strictEqual(weapon!.tier, 1);
    assert.strictEqual(weapon!.rarity, "common");

    db.close();
  });

  it("should not generate a weapon when skip_initial_weapon is true", async () => {
    // Arrange
    const db = await createDB();
    const params: CreateCharacterInput = { name: "卡罗尔", skip_initial_weapon: true };

    // Act
    const createCharacter = await getCreateCharacter();
    const result = createCharacter(db, params as CreateCharacterParams);

    // Assert
    assert.strictEqual(result.success, true);
    assert.ok(result.character_id > 0);
    assert.strictEqual(result.weapon_id, undefined);

    const invCount = countRows(
      db,
      "SELECT COUNT(*) as c FROM inventory WHERE character_id = ?",
      [result.character_id]
    );
    assert.strictEqual(invCount, 0);

    const weaponCount = countRows(db, "SELECT COUNT(*) as c FROM weapons");
    assert.strictEqual(weaponCount, 0);

    db.close();
  });

  it("should succeed when creating a second character (no UNIQUE conflict on weapon name)", async () => {
    // Arrange
    const db = await createDB();
    const createCharacter = await getCreateCharacter();
    const first = createCharacter(db, { name: "第一人" } as CreateCharacterParams);
    assert.strictEqual(first.success, true);

    // Act: weapons.name has a UNIQUE constraint — second creation must reuse the weapon
    const second = createCharacter(db, { name: "第二人" } as CreateCharacterParams);

    // Assert
    assert.strictEqual(second.success, true);
    assert.ok(second.character_id > 0);
    assert.strictEqual(second.weapon_id, first.weapon_id, "Both characters should share the same 生锈匕首 weapon row");

    const weaponCount = countRows(db, "SELECT COUNT(*) as c FROM weapons WHERE name = ?", ["生锈匕首"]);
    assert.strictEqual(weaponCount, 1);

    const inv = queryOne(
      db,
      "SELECT weapon_id, is_equipped FROM inventory WHERE character_id = ?",
      [second.character_id]
    );
    assert.ok(inv, "Expected an inventory row for the second character");
    assert.strictEqual(inv!.is_equipped, 1);

    db.close();
  });

  it("should not affect existing characters without initial weapons", async () => {
    // Arrange: simulate an old character created before initial weapons existed
    const db = await createDB();
    db.run(
      "INSERT INTO characters (name, is_player, hp, hp_max) VALUES (?, ?, ?, ?)",
      ["老角色", 1, 30, 30]
    );
    const oldCharId = (
      db.exec("SELECT last_insert_rowid() as id")[0].values[0][0] as number
    );

    // Act: create a new character with default settings
    const createCharacter = await getCreateCharacter();
    const result = createCharacter(db, { name: "新角色" } as CreateCharacterParams);

    // Assert
    assert.strictEqual(result.success, true);

    const oldInv = queryAll(
      db,
      "SELECT * FROM inventory WHERE character_id = ?",
      [oldCharId]
    );
    assert.deepStrictEqual(oldInv, [], "Old character inventory should remain empty");

    const newInv = queryAll(
      db,
      "SELECT * FROM inventory WHERE character_id = ?",
      [result.character_id]
    );
    assert.strictEqual(newInv.length, 1, "New character should still receive initial weapon");

    db.close();
  });
});
