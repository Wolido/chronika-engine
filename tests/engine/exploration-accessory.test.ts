/**
 * exploration-accessory.test.ts — Cycle 2 饰品探索效果 RED 阶段测试
 *
 * 覆盖范围：
 * - travel + stealth_field：降低遭遇概率
 * - travel + danger_sense：遭遇触发时提前获知 danger_level
 * - travel + movement_speed：返回速度加成值
 * - explore + resource_sense：返回额外发现的资源
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { getSQL } from "../../db/connection.ts";
import type { SqlJsStatic, Database } from "sql.js";
import { travel, explore } from "../../engine/exploration.ts";
import type {
  TravelInput,
  ExploreInput,
} from "../../engine/exploration.ts";

interface AccessoryData {
  name: string;
  trigger: string;
  effect_type: string;
  magnitude: number;
}

interface TravelInputWithAccessories extends TravelInput {
  accessories?: AccessoryData[];
}

interface ExploreInputWithAccessories extends ExploreInput {
  accessories?: AccessoryData[];
}

// ---------------------------------------------------------------------------
// DDL
// ---------------------------------------------------------------------------

const EXPLORATION_DDL = `
CREATE TABLE IF NOT EXISTS locations (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  region TEXT,
  description TEXT,
  danger_level INTEGER DEFAULT 1,
  has_shelter INTEGER DEFAULT 0,
  discovered INTEGER DEFAULT 0,
  visited INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS location_connections (
  id INTEGER PRIMARY KEY,
  from_location TEXT NOT NULL,
  to_location TEXT NOT NULL,
  distance_km REAL DEFAULT 1,
  description TEXT
);

CREATE TABLE IF NOT EXISTS location_encounters (
  id INTEGER PRIMARY KEY,
  location_name TEXT NOT NULL,
  encounter_type TEXT NOT NULL,
  description TEXT,
  probability REAL DEFAULT 0.3,
  monster_id INTEGER
);

CREATE TABLE IF NOT EXISTS location_pois (
  id INTEGER PRIMARY KEY,
  location_name TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  has_shelter INTEGER DEFAULT 0,
  discovered INTEGER DEFAULT 0,
  UNIQUE(location_name, name)
);

CREATE TABLE IF NOT EXISTS poi_connections (
  id INTEGER PRIMARY KEY,
  location_name TEXT NOT NULL,
  from_poi TEXT NOT NULL,
  to_poi TEXT,
  to_location TEXT,
  description TEXT
);
`;

let SQL: SqlJsStatic;

async function createDB(): Promise<Database> {
  const sql = await getSQL();
  const db = new sql.Database();
  db.run("PRAGMA foreign_keys = ON");
  db.run(EXPLORATION_DDL);
  return db;
}

// ---------------------------------------------------------------------------
// travel accessory tests
// ---------------------------------------------------------------------------

describe("travel accessories", () => {
  it("should reduce encounter chance when stealth_field accessory is present", async () => {
    // Arrange
    const db = await createDB();
    db.run(
      "INSERT INTO locations (name, description, danger_level, discovered, visited) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)",
      ["潜行起点", "危险起点", 3, 1, 1, "潜行终点", "危险终点", 3, 1, 0]
    );
    db.run(
      "INSERT INTO location_connections (from_location, to_location, distance_km) VALUES (?, ?, ?)",
      ["潜行起点", "潜行终点", 4]
    );

    const inputWithoutAccessory: TravelInput = {
      current_location: "潜行起点",
      target_location: "潜行终点",
    };
    const inputWithStealth: TravelInputWithAccessories = {
      current_location: "潜行起点",
      target_location: "潜行终点",
      accessories: [{ name: "暗影披风", trigger: "on_travel", effect_type: "stealth_field", magnitude: 3 }],
    };

    // Base chance for danger=3: 3*0.12+0.08 = 0.44
    // With stealth_field magnitude=3: stealthMod ≈ 1.0 - 3*0.03 = 0.91 → 0.44*0.91 ≈ 0.4004
    // roll=0.42 should trigger without accessory but not with it.
    const originalRandom = Math.random;
    Math.random = () => 0.42;

    try {
      // Act
      const resultWithout = travel(db, inputWithoutAccessory);
      const resultWith = travel(db, inputWithStealth as TravelInput);

      // Assert
      assert.strictEqual(resultWithout.encounter.triggered, true);
      assert.strictEqual(resultWith.encounter.triggered, false);
      assert.ok(
        (resultWith as any).accessory_stealth_bonus ?? 0 > 0,
        `expected accessory_stealth_bonus > 0, got ${(resultWith as any).accessory_stealth_bonus}`
      );
    } finally {
      Math.random = originalRandom;
    }

    db.close();
  });

  it("should set accessory_danger_sense when an encounter triggers with danger_sense accessory", async () => {
    // Arrange
    const db = await createDB();
    db.run(
      "INSERT INTO locations (name, description, danger_level, discovered, visited) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)",
      ["预警起点", "危险起点", 4, 1, 1, "预警终点", "危险终点", 4, 1, 0]
    );
    db.run(
      "INSERT INTO location_connections (from_location, to_location, distance_km) VALUES (?, ?, ?)",
      ["预警起点", "预警终点", 5]
    );

    const input: TravelInputWithAccessories = {
      current_location: "预警起点",
      target_location: "预警终点",
      accessories: [{ name: "危险探测器", trigger: "on_travel", effect_type: "danger_sense", magnitude: 1.0 }],
    };

    // Force encounter to trigger.
    const originalRandom = Math.random;
    Math.random = () => 0.1;

    try {
      // Act
      const result = travel(db, input as TravelInput);

      // Assert
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.encounter.triggered, true);
      assert.strictEqual(typeof (result.encounter as any).danger_level, "number");
      assert.strictEqual((result as any).accessory_danger_sense, true);
    } finally {
      Math.random = originalRandom;
    }

    db.close();
  });

  it("should return accessory_movement_speed bonus from movement_speed accessory", async () => {
    // Arrange
    const db = await createDB();
    db.run(
      "INSERT INTO locations (name, description, danger_level, discovered, visited) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)",
      ["疾行起点", "平坦起点", 1, 1, 1, "疾行终点", "平坦终点", 1, 1, 0]
    );
    db.run(
      "INSERT INTO location_connections (from_location, to_location, distance_km) VALUES (?, ?, ?)",
      ["疾行起点", "疾行终点", 6]
    );

    const input: TravelInputWithAccessories = {
      current_location: "疾行起点",
      target_location: "疾行终点",
      accessories: [{ name: "疾风之靴", trigger: "passive", effect_type: "movement_speed", magnitude: 3 }],
    };

    // Act
    const result = travel(db, input as TravelInput);

    // Assert
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.distance_km, 6);
    assert.ok(
      ((result as any).accessory_movement_speed ?? 0) > 0,
      `expected accessory_movement_speed > 0, got ${(result as any).accessory_movement_speed}`
    );

    db.close();
  });
});

// ---------------------------------------------------------------------------
// explore accessory tests
// ---------------------------------------------------------------------------

describe("explore accessories", () => {
  it("should return accessory_resource_found from resource_sense accessory", async () => {
    // Arrange
    const db = await createDB();
    db.run(
      "INSERT INTO locations (name, description, danger_level, has_shelter, discovered) VALUES (?, ?, ?, ?, ?)",
      ["资源点", "富含资源", 2, 0, 1]
    );

    const input: ExploreInputWithAccessories = {
      location_name: "资源点",
      accessories: [{ name: "地质罗盘", trigger: "on_explore", effect_type: "resource_sense", magnitude: 1.0 }],
    };

    // Force resource sense to succeed.
    const originalRandom = Math.random;
    Math.random = () => 0.1;

    try {
      // Act
      const result = explore(db, input as ExploreInput);

      // Assert
      assert.strictEqual(result.location_name, "资源点");
      assert.ok(
        typeof (result as any).accessory_resource_found === "string" &&
          (result as any).accessory_resource_found.length > 0,
        `expected non-empty accessory_resource_found, got ${(result as any).accessory_resource_found}`
      );
    } finally {
      Math.random = originalRandom;
    }

    db.close();
  });
});
