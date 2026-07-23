/**
 * world-gen.test.ts — RED phase: world-gen 核心引擎测试
 *
 * 测试 generateWorld() 的期望行为:
 *   1. 接受 WorldGenInput，运行所有校验器
 *   2. 校验通过后写入 SQLite 数据库（事务性：全部写入或全部回滚）
 *   3. 返回 WorldGenResult（ok、errors、warnings、stats）
 *
 * 当前 generateWorld 是一个桩（stub），抛出 NOT IMPLEMENTED，
 * 因此全部测试处于 RED（失败）状态。
 *
 * coder 实现 generateWorld 后，这些测试将逐条变绿。
 */

import { describe, it, before } from "node:test";
import assert from "node:assert";
import { getSQL } from "../../db/connection.ts";
import { DDL_STATEMENTS } from "../../db/schema.ts";
import type { SqlJsStatic, Database } from "sql.js";
import { generateWorld } from "../../engine/world-gen.ts";
import type { WorldGenInput, WorldGenResult } from "../../engine/world-gen.ts";

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------

let SQL: SqlJsStatic;

async function createDB(): Promise<Database> {
  const sql = await getSQL();
  const db = new sql.Database();
  db.run("PRAGMA foreign_keys = ON");
  db.run(DDL_STATEMENTS);
  return db;
}

// ---------------------------------------------------------------------------
// 合法实体模板（happy-path 基准数据）
// ---------------------------------------------------------------------------

function validWeapon(overrides: Record<string, any> = {}) {
  return {
    name: "铁管",
    category: "melee",
    damage_type: "bludgeoning",
    damage_min: 3,
    damage_max: 7,
    accuracy: 0.75,
    tier: 1,
    rarity: "common",
    ...overrides,
  };
}

function validMonster(overrides: Record<string, any> = {}) {
  return {
    name: "废土鼠",
    category: "beast",
    hp: 20,
    damage_min: 2,
    damage_max: 5,
    accuracy: 0.6,
    evasion: 0.3,
    tier: 1,
    strength: 3,
    agility: 4,
    endurance: 3,
    perception: 3,
    intelligence: 1,
    willpower: 3,
    ...overrides,
  };
}

function validItem(overrides: Record<string, any> = {}) {
  return {
    name: "治疗针",
    item_type: "consumable",
    rarity: "common",
    value: 10,
    weight: 0.1,
    effect_type: "heal",
    effect_value: 15,
    ...overrides,
  };
}

function validStatusEffect(overrides: Record<string, any> = {}) {
  return {
    name: "中毒",
    effect_type: "dot",
    target_attribute: "hp",
    magnitude: -5,
    duration: 3,
    ...overrides,
  };
}

function validAction(overrides: Record<string, any> = {}) {
  return {
    name: "猛击",
    action_type: "combat",
    primary_attr: "strength",
    difficulty: 15,
    cooldown: 2,
    success_result: { damage: "2d8" },
    failure_result: { description: "未命中" },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 测试用例
// ---------------------------------------------------------------------------

describe("generateWorld", () => {
  before(async () => {
    SQL = await getSQL();
  });

  // =========================================================================
  // 测试 1: 空数据
  // =========================================================================

  it("should return ok=true with all stats zero when input is empty", async () => {
    const db = await createDB();

    const result = generateWorld(db, {});

    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(result.errors, []);
    assert.strictEqual(result.stats.weapons_written, 0);
    assert.strictEqual(result.stats.monsters_written, 0);
    assert.strictEqual(result.stats.items_written, 0);
    assert.strictEqual(result.stats.status_effects_written, 0);
    assert.strictEqual(result.stats.actions_written, 0);

    db.close();
  });

  // =========================================================================
  // 测试 2: 写入一把合法武器
  // =========================================================================

  it("should write a valid weapon to the database", async () => {
    const db = await createDB();

    const input: WorldGenInput = {
      weapons: [validWeapon({ name: "铁管" })],
    };

    const result = generateWorld(db, input);

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.stats.weapons_written, 1);

    const stmt = db.prepare("SELECT name, damage_min, damage_max FROM weapons WHERE name = ?");
    stmt.bind(["铁管"]);
    let count = 0;
    while (stmt.step()) {
      const row = stmt.getAsObject();
      assert.strictEqual(row.name, "铁管");
      assert.strictEqual(row.damage_min, 3);
      assert.strictEqual(row.damage_max, 7);
      count++;
    }
    stmt.free();
    assert.strictEqual(count, 1);

    db.close();
  });

  // =========================================================================
  // 测试 3: 写入多类型实体（武器 + 怪物 + 物品）
  // =========================================================================

  it("should write one weapon, one monster, and one item when all are valid", async () => {
    const db = await createDB();

    const input: WorldGenInput = {
      weapons: [validWeapon({ name: "铁管" })],
      monsters: [validMonster({ name: "废土鼠" })],
      items: [validItem({ name: "治疗针" })],
    };

    const result = generateWorld(db, input);

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.stats.weapons_written, 1);
    assert.strictEqual(result.stats.monsters_written, 1);
    assert.strictEqual(result.stats.items_written, 1);

    // 验证武器
    let stmt = db.prepare("SELECT name FROM weapons WHERE name = ?");
    stmt.bind(["铁管"]);
    assert.strictEqual(stmt.step(), true, "weapon '铁管' should exist");
    stmt.free();

    // 验证怪物
    stmt = db.prepare("SELECT name FROM monsters WHERE name = ?");
    stmt.bind(["废土鼠"]);
    assert.strictEqual(stmt.step(), true, "monster '废土鼠' should exist");
    stmt.free();

    // 验证物品
    stmt = db.prepare("SELECT name FROM items WHERE name = ?");
    stmt.bind(["治疗针"]);
    assert.strictEqual(stmt.step(), true, "item '治疗针' should exist");
    stmt.free();

    db.close();
  });

  // =========================================================================
  // 测试 4: 非法武器导致全盘拒绝
  // =========================================================================

  it("should reject all writes when any weapon is invalid (damage_min > damage_max)", async () => {
    const db = await createDB();

    const input: WorldGenInput = {
      weapons: [
        validWeapon({ name: "合法武器", damage_min: 4, damage_max: 8 }),
        {
          // 非法武器：damage_min > damage_max
          name: "非法武器",
          category: "melee",
          damage_type: "bludgeoning",
          damage_min: 10,
          damage_max: 5,
          accuracy: 0.5,
          tier: 1,
          rarity: "common",
        },
      ],
    };

    const result = generateWorld(db, input);

    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.length > 0, "errors should not be empty");
    assert.strictEqual(result.stats.weapons_written, 0);
    assert.strictEqual(result.stats.monsters_written, 0);
    assert.strictEqual(result.stats.items_written, 0);

    // 验证没有任何数据写入 weapons 表
    const stmt = db.prepare("SELECT COUNT(*) AS cnt FROM weapons");
    stmt.step();
    const row = stmt.getAsObject();
    assert.strictEqual(row.cnt, 0, "weapons table should be empty");
    stmt.free();

    db.close();
  });

  // =========================================================================
  // 测试 5: 写入 world_meta
  // =========================================================================

  it("should write world_meta to the database", async () => {
    const db = await createDB();

    const input: WorldGenInput = {
      world_meta: {
        world_name: "废土纪元",
        world_desc: "一个核战后世界",
        tone: "dark",
      },
    };

    const result = generateWorld(db, input);

    assert.strictEqual(result.ok, true);

    const stmt = db.prepare("SELECT world_name, world_desc, tone FROM world_meta WHERE world_name = ?");
    stmt.bind(["废土纪元"]);
    let count = 0;
    while (stmt.step()) {
      const row = stmt.getAsObject();
      assert.strictEqual(row.world_name, "废土纪元");
      assert.strictEqual(row.world_desc, "一个核战后世界");
      assert.strictEqual(row.tone, "dark");
      count++;
    }
    stmt.free();
    assert.strictEqual(count, 1);

    db.close();
  });

  // =========================================================================
  // 测试 6: 混合合法和非法实体（全盘拒绝，不部分写入）
  // =========================================================================

  it("should reject all writes when valid weapons are mixed with invalid monsters", async () => {
    const db = await createDB();

    const input: WorldGenInput = {
      weapons: [validWeapon({ name: "铁管" })],
      monsters: [
        {
          // 非法怪物：category 不在枚举中
          name: "非法怪物",
          category: "invalid_category",
          hp: 20,
          damage_min: 2,
          damage_max: 5,
          accuracy: 0.6,
          evasion: 0.3,
          tier: 1,
          strength: 3,
          agility: 4,
          endurance: 3,
          perception: 3,
          intelligence: 1,
          willpower: 3,
        },
      ],
    };

    const result = generateWorld(db, input);

    assert.strictEqual(result.ok, false);
    assert.ok(
      result.errors.some(
        (e: string) => e.toLowerCase().includes("monster") || e.toLowerCase().includes("category")
      ),
      `errors should mention monster-related issue, got: ${JSON.stringify(result.errors)}`
    );

    // 验证 weapons 表为空（全盘拒绝）
    const stmt = db.prepare("SELECT COUNT(*) AS cnt FROM weapons");
    stmt.step();
    const row = stmt.getAsObject();
    assert.strictEqual(row.cnt, 0, "weapons table should be empty due to full rejection");
    stmt.free();

    db.close();
  });

  // =========================================================================
  // 测试 7: 多个实体类型同时写入
  // =========================================================================

  it("should write 2 weapons, 1 monster, 2 items, 1 status effect, and 1 action", async () => {
    const db = await createDB();

    const input: WorldGenInput = {
      weapons: [
        validWeapon({ name: "铁管" }),
        validWeapon({ name: "短刀", damage_type: "piercing" }),
      ],
      monsters: [validMonster({ name: "废土鼠" })],
      items: [
        validItem({ name: "治疗针" }),
        validItem({ name: "废铁", item_type: "material", effect_type: undefined, effect_value: undefined }),
      ],
      status_effects: [validStatusEffect({ name: "中毒" })],
      actions: [validAction({ name: "猛击" })],
    };

    const result = generateWorld(db, input);

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.stats.weapons_written, 2);
    assert.strictEqual(result.stats.monsters_written, 1);
    assert.strictEqual(result.stats.items_written, 2);
    assert.strictEqual(result.stats.status_effects_written, 1);
    assert.strictEqual(result.stats.actions_written, 1);

    // 验证 2 把武器
    for (const name of ["铁管", "短刀"]) {
      const stmt = db.prepare("SELECT name FROM weapons WHERE name = ?");
      stmt.bind([name]);
      assert.strictEqual(stmt.step(), true, `weapon '${name}' should exist`);
      stmt.free();
    }

    // 验证 1 个怪物
    let stmt = db.prepare("SELECT name FROM monsters WHERE name = ?");
    stmt.bind(["废土鼠"]);
    assert.strictEqual(stmt.step(), true, "monster '废土鼠' should exist");
    stmt.free();

    // 验证 2 个物品
    for (const name of ["治疗针", "废铁"]) {
      stmt = db.prepare("SELECT name FROM items WHERE name = ?");
      stmt.bind([name]);
      assert.strictEqual(stmt.step(), true, `item '${name}' should exist`);
      stmt.free();
    }

    // 验证 1 个状态效果
    stmt = db.prepare("SELECT name FROM status_effects WHERE name = ?");
    stmt.bind(["中毒"]);
    assert.strictEqual(stmt.step(), true, "status_effect '中毒' should exist");
    stmt.free();

    // 验证 1 个行为
    stmt = db.prepare("SELECT name FROM actions WHERE name = ?");
    stmt.bind(["猛击"]);
    assert.strictEqual(stmt.step(), true, "action '猛击' should exist");
    stmt.free();

    db.close();
  });

  // =========================================================================
  // 测试 8: 警告不阻断写入（边界值武器）
  // =========================================================================

  it("should write weapon with boundary values (tier=5, damage_max=50) without blocking", async () => {
    const db = await createDB();

    const input: WorldGenInput = {
      weapons: [
        validWeapon({
          name: "边界武器",
          damage_min: 30,
          damage_max: 50,
          accuracy: 0.5,
          tier: 5,
          rarity: "legendary",
        }),
      ],
    };

    const result = generateWorld(db, input);

    assert.strictEqual(result.ok, true, "boundary values should not block writes");
    assert.strictEqual(result.stats.weapons_written, 1);

    // 验证武器已写入
    const stmt = db.prepare("SELECT name, damage_max, tier FROM weapons WHERE name = ?");
    stmt.bind(["边界武器"]);
    let count = 0;
    while (stmt.step()) {
      const row = stmt.getAsObject();
      assert.strictEqual(row.name, "边界武器");
      assert.strictEqual(row.damage_max, 50);
      assert.strictEqual(row.tier, 5);
      count++;
    }
    stmt.free();
    assert.strictEqual(count, 1);

    db.close();
  });
});
