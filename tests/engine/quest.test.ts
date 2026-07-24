/**
 * quest.test.ts — 任务系统引擎测试
 *
 * RED phase: 所有测试当前预期失败（NOT IMPLEMENTED）。
 */

import { describe, it, before } from "node:test";
import assert from "node:assert";
import { getSQL, rowsToObjects } from "../../db/connection.ts";
import type { SqlJsStatic, Database } from "sql.js";
import {
  createQuest,
  getActiveQuests,
  completeQuest,
} from "../../engine/quest.ts";
import type {
  CreateQuestInput,
  CompleteQuestInput,
} from "../../engine/quest.ts";

// ============================================================
// DDL
// ============================================================

const QUESTS_DDL = `
CREATE TABLE IF NOT EXISTS quests (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  quest_type TEXT NOT NULL,
  giver_npc TEXT,
  target_location TEXT,
  reward_credits INTEGER DEFAULT 0,
  reward_item_name TEXT,
  reward_weapon_name TEXT,
  time_limit_minutes INTEGER,
  status TEXT DEFAULT 'active',
  accepted_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS characters (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  credits INTEGER DEFAULT 0,
  hp INTEGER DEFAULT 100,
  hp_max INTEGER DEFAULT 100
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  item_type TEXT NOT NULL,
  rarity TEXT NOT NULL,
  value INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS weapons (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  damage_type TEXT NOT NULL,
  damage_min INTEGER NOT NULL,
  damage_max INTEGER NOT NULL,
  accuracy REAL NOT NULL,
  rarity TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory (
  id INTEGER PRIMARY KEY,
  character_id INTEGER NOT NULL,
  item_id INTEGER,
  weapon_id INTEGER,
  quantity INTEGER DEFAULT 1,
  is_equipped INTEGER DEFAULT 0,
  FOREIGN KEY (character_id) REFERENCES characters(id)
);
`;

// ============================================================
// 辅助函数
// ============================================================

let SQL: SqlJsStatic;

async function createDB(): Promise<Database> {
  const sql = await getSQL();
  const db = new sql.Database();
  db.run("PRAGMA foreign_keys = ON");
  db.run(QUESTS_DDL);
  return db;
}

function sampleCreateQuest(overrides: Partial<CreateQuestInput> = {}): CreateQuestInput {
  return {
    db: null!, // 由各测试注入
    title: "寻找失落的零件",
    description: "铁锈镇的技师需要你找到一枚旧型号的转换器，可能在东部废墟附近。",
    quest_type: "fetch",
    giver_npc: "老技师",
    target_location: "东部废墟",
    reward_credits: 50,
    ...overrides,
  };
}

// ============================================================
// Tests
// ============================================================

describe("createQuest", () => {

  it("should create a new quest and persist it with status 'active'", async () => {
    // Arrange
    const db = await createDB();
    const input = sampleCreateQuest({ db });

    // Act
    const result = createQuest(input);

    // Assert
    assert.strictEqual(result.success, true, `Expected success=true, got: ${result.success}`);
    assert.ok(typeof result.quest_id === "number" && result.quest_id > 0,
      `Expected valid quest_id > 0, got: ${result.quest_id}`);

    // 验证 quests 表中有对应记录
    const rows = rowsToObjects(
      db.exec("SELECT id, title, status, quest_type, giver_npc FROM quests WHERE id = ?", [result.quest_id])
    );
    assert.strictEqual(rows.length, 1, `Expected 1 quest row, got ${rows.length}`);
    assert.strictEqual(rows[0].title, "寻找失落的零件");
    assert.strictEqual(rows[0].status, "active");
    assert.strictEqual(rows[0].quest_type, "fetch");
    assert.strictEqual(rows[0].giver_npc, "老技师");

    db.close();
  });

});

describe("getActiveQuests", () => {

  it("should return only active quests, excluding completed ones", async () => {
    // Arrange
    const db = await createDB();
    // 插入 2 个活跃任务
    db.run(
      "INSERT INTO quests (title, quest_type, giver_npc, status) VALUES (?, ?, ?, ?), (?, ?, ?, ?)",
      ["送信到哨站", "delivery", "邮差", "active", "清除变异鼠", "kill", "守卫队长", "active"]
    );
    // 插入一个已完成任务
    db.run(
      "INSERT INTO quests (title, quest_type, giver_npc, status, completed_at) VALUES (?, ?, ?, ?, datetime('now'))",
      ["收集废铁", "fetch", "拾荒者", "completed"]
    );

    // Act
    const result = getActiveQuests(db);

    // Assert
    assert.strictEqual(result.quests.length, 2,
      `Expected 2 active quests, got ${result.quests.length}`);
    // 每个条目的 status 应为 "active"
    for (const q of result.quests) {
      assert.strictEqual(q.status, "active",
        `Expected status 'active' for quest ${q.id}, got '${q.status}'`);
    }
    // 验证返回的 quest 包含必要字段
    const q = result.quests[0];
    assert.ok(typeof q.id === "number");
    assert.ok(typeof q.title === "string");
    assert.ok(typeof q.quest_type === "string");

    db.close();
  });

  it("should return empty array when all quests are completed", async () => {
    // Arrange
    const db = await createDB();
    db.run(
      "INSERT INTO quests (title, quest_type, giver_npc, status, completed_at) VALUES (?, ?, ?, ?, datetime('now'))",
      ["已完成的采集", "fetch", "老猎人", "completed"]
    );

    // Act
    const result = getActiveQuests(db);

    // Assert
    assert.deepStrictEqual(result.quests, [],
      `Expected empty array, got ${result.quests.length} quests`);

    db.close();
  });

});

describe("completeQuest", () => {

  it("should complete a quest, update character credits, and mark quest as completed", async () => {
    // Arrange
    const db = await createDB();
    // 创建任务
    db.run(
      "INSERT INTO quests (title, quest_type, giver_npc, reward_credits, status) VALUES (?, ?, ?, ?, ?)",
      ["护送商队", "delivery", "商队首领", 100, "active"]
    );
    const questId = db.exec("SELECT last_insert_rowid()")[0].values[0][0] as number;

    // 创建角色 (credits=50)
    db.run(
      "INSERT INTO characters (name, credits) VALUES (?, ?)",
      ["流浪者", 50]
    );
    const characterId = db.exec("SELECT last_insert_rowid()")[0].values[0][0] as number;

    const input: CompleteQuestInput = {
      db,
      quest_id: questId,
      character_id: characterId,
    };

    // Act
    const result = completeQuest(input);

    // Assert
    assert.strictEqual(result.success, true,
      `Expected success=true, got: ${result.success}`);
    assert.strictEqual(result.quest_title, "护送商队");
    assert.strictEqual(result.credits_gained, 100);

    // 验证角色 credits 增加
    const charRows = rowsToObjects(
      db.exec("SELECT credits FROM characters WHERE id = ?", [characterId])
    );
    assert.strictEqual(charRows[0].credits, 150,
      `Expected credits=150, got ${charRows[0].credits}`);

    // 验证任务状态变为 "completed"，且 completed_at 已设置
    const questRows = rowsToObjects(
      db.exec("SELECT status, completed_at FROM quests WHERE id = ?", [questId])
    );
    assert.strictEqual(questRows[0].status, "completed");
    assert.ok(
      typeof questRows[0].completed_at === "string" && questRows[0].completed_at.length > 0,
      `Expected completed_at to be set, got: ${questRows[0].completed_at}`
    );

    db.close();
  });

  it("should grant item reward to character inventory when reward_item_name is set", async () => {
    // Arrange
    const db = await createDB();
    // 插入物品
    db.run(
      "INSERT INTO items (name, item_type, rarity) VALUES (?, ?, ?)",
      ["治疗粉", "consumable", "common"]
    );
    const itemId = db.exec("SELECT last_insert_rowid()")[0].values[0][0] as number;

    // 创建任务，reward_item_name 指向该物品
    db.run(
      "INSERT INTO quests (title, quest_type, giver_npc, reward_credits, reward_item_name, status) VALUES (?, ?, ?, ?, ?, ?)",
      ["采集草药", "fetch", "药师", 10, "治疗粉", "active"]
    );
    const questId = db.exec("SELECT last_insert_rowid()")[0].values[0][0] as number;

    // 创建角色
    db.run(
      "INSERT INTO characters (name, credits) VALUES (?, ?)",
      ["流浪者", 50]
    );
    const characterId = db.exec("SELECT last_insert_rowid()")[0].values[0][0] as number;

    const input: CompleteQuestInput = {
      db,
      quest_id: questId,
      character_id: characterId,
    };

    // Act
    const result = completeQuest(input);

    // Assert
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.item_gained, "治疗粉");

    // 验证 inventory 表中有对应记录
    const invRows = rowsToObjects(
      db.exec(
        "SELECT character_id, item_id, weapon_id, quantity FROM inventory WHERE character_id = ?",
        [characterId]
      )
    );
    assert.strictEqual(invRows.length, 1,
      `Expected 1 inventory row, got ${invRows.length}`);
    assert.strictEqual(invRows[0].character_id, characterId);
    assert.strictEqual(invRows[0].item_id, itemId);
    assert.strictEqual(invRows[0].weapon_id, null);
    assert.strictEqual(invRows[0].quantity, 1);

    db.close();
  });

  it("should grant weapon reward to character inventory when reward_weapon_name is set", async () => {
    // Arrange
    const db = await createDB();
    // 插入武器
    db.run(
      "INSERT INTO weapons (name, category, damage_type, damage_min, damage_max, accuracy, rarity) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ["铁管", "melee", "blunt", 3, 8, 0.7, "common"]
    );
    const weaponId = db.exec("SELECT last_insert_rowid()")[0].values[0][0] as number;

    // 创建任务，reward_weapon_name 指向该武器
    db.run(
      "INSERT INTO quests (title, quest_type, giver_npc, reward_credits, reward_weapon_name, status) VALUES (?, ?, ?, ?, ?, ?)",
      ["清理下水道", "kill", "守卫队长", 20, "铁管", "active"]
    );
    const questId = db.exec("SELECT last_insert_rowid()")[0].values[0][0] as number;

    // 创建角色
    db.run(
      "INSERT INTO characters (name, credits) VALUES (?, ?)",
      ["流浪者", 50]
    );
    const characterId = db.exec("SELECT last_insert_rowid()")[0].values[0][0] as number;

    const input: CompleteQuestInput = {
      db,
      quest_id: questId,
      character_id: characterId,
    };

    // Act
    const result = completeQuest(input);

    // Assert
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.weapon_gained, "铁管");

    // 验证 inventory 表中有武器记录
    const invRows = rowsToObjects(
      db.exec(
        "SELECT character_id, item_id, weapon_id, quantity FROM inventory WHERE character_id = ?",
        [characterId]
      )
    );
    assert.strictEqual(invRows.length, 1,
      `Expected 1 inventory row, got ${invRows.length}`);
    assert.strictEqual(invRows[0].character_id, characterId);
    assert.strictEqual(invRows[0].weapon_id, weaponId);
    assert.strictEqual(invRows[0].item_id, null);
    assert.strictEqual(invRows[0].quantity, 1);

    db.close();
  });

  it("should return error when completing a quest that does not exist", async () => {
    // Arrange
    const db = await createDB();
    db.run("INSERT INTO characters (name, credits) VALUES ('test', 0)");
    const charResult = db.exec("SELECT last_insert_rowid() as id");
    const charId = charResult[0].values[0][0] as number;
    const result = completeQuest({ db, quest_id: 999, character_id: charId });

    // Assert
    assert.strictEqual(result.success, false);
    assert.ok(result.error && result.error.includes("Quest #999 not found"));

    db.close();
  });

});
