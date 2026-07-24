/**
 * exploration.test.ts — RED phase: 探索 / 地图系统引擎测试
 *
 * 测试 discoverLocation / travel / explore / getKnownMap 的期望行为。
 * 当前四个函数均为抛出 "NOT IMPLEMENTED" 的桩实现，
 * 因此全部 11 个测试处于 RED（失败）状态。
 */

import { describe, it, before } from "node:test";
import assert from "node:assert";
import { getSQL } from "../../db/connection.ts";
import type { SqlJsStatic, Database } from "sql.js";
import {
  discoverLocation,
  travel,
  explore,
  getKnownMap,
  discoverPOI,
  moveTo,
} from "../../engine/exploration.ts";
import type {
  DiscoverInput,
  TravelInput,
  ExploreInput,
  DiscoverPOIInput,
  MoveToInput,
} from "../../engine/exploration.ts";

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
`;

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------

let SQL: SqlJsStatic;

async function createDB(): Promise<Database> {
  const sql = await getSQL();
  const db = new sql.Database();
  db.run("PRAGMA foreign_keys = ON");
  db.run(EXPLORATION_DDL);
  return db;
}

// ---------------------------------------------------------------------------
// discoverLocation
// ---------------------------------------------------------------------------

describe("discoverLocation", () => {
  it("should discover a new location from an existing one", async () => {
    // Arrange
    const db = await createDB();
    db.run(
      "INSERT INTO locations (name, description, discovered) VALUES (?, ?, ?)",
      ["铁锈镇", "一个破旧的聚居地", 0]
    );
    const input: DiscoverInput = {
      name: "东部废墟",
      connected_to: "铁锈镇",
      description: "坍塌的高楼与游荡的变异生物",
      region: "东部废土",
      danger_level: 3,
      distance_km: 5,
      connection_description: "沿着破败的公路向东",
    };

    // Act
    const result = discoverLocation(db, input);

    // Assert
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.location_name, "东部废墟");
    assert.deepStrictEqual(result.connection, { from: "铁锈镇", to: "东部废墟" });
    assert.strictEqual(result.total_locations, 1);

    db.close();
  });

  it("should fail when discovering a location that already exists", async () => {
    // Arrange
    const db = await createDB();
    db.run(
      "INSERT INTO locations (name, description, discovered) VALUES (?, ?, ?)",
      ["东部废墟", "坍塌的高楼", 1]
    );
    const input: DiscoverInput = {
      name: "东部废墟",
      connected_to: "铁锈镇",
      description: "重复描述",
    };

    // Act
    const result = discoverLocation(db, input);

    // Assert
    assert.strictEqual(result.success, false);
    assert.ok(
      result.error && result.error.toLowerCase().includes("already exists"),
      `Expected error to include "already exists", got: ${result.error}`
    );

    db.close();
  });

  it("should fail when connected_to location does not exist", async () => {
    // Arrange
    const db = await createDB();
    const input: DiscoverInput = {
      name: "旧水坝",
      connected_to: "不存在的起点",
      description: "一座废弃水坝",
    };

    // Act
    const result = discoverLocation(db, input);

    // Assert
    assert.strictEqual(result.success, false);
    assert.ok(
      result.error && result.error.toLowerCase().includes("not found"),
      `Expected error to include "not found", got: ${result.error}`
    );

    db.close();
  });

  it("should discover multiple locations in sequence", async () => {
    // Arrange
    const db = await createDB();
    db.run(
      "INSERT INTO locations (name, description, discovered) VALUES (?, ?, ?)",
      ["铁锈镇", "一个破旧的聚居地", 0]
    );
    const first: DiscoverInput = {
      name: "东部废墟",
      connected_to: "铁锈镇",
      description: "坍塌的高楼",
      distance_km: 4,
    };
    const second: DiscoverInput = {
      name: "旧水坝",
      connected_to: "东部废墟",
      description: "废弃水坝",
      distance_km: 6,
    };

    // Act
    const result1 = discoverLocation(db, first);
    const result2 = discoverLocation(db, second);

    // Assert
    assert.strictEqual(result1.success, true);
    assert.strictEqual(result1.total_locations, 1);

    assert.strictEqual(result2.success, true);
    assert.strictEqual(result2.location_name, "旧水坝");
    assert.deepStrictEqual(result2.connection, { from: "东部废墟", to: "旧水坝" });
    assert.strictEqual(result2.total_locations, 2);

    db.close();
  });
});

// ---------------------------------------------------------------------------
// travel
// ---------------------------------------------------------------------------

describe("travel", () => {
  it("should travel to a connected location", async () => {
    // Arrange
    const db = await createDB();
    db.run(
      "INSERT INTO locations (name, description, discovered, visited) VALUES (?, ?, ?, ?), (?, ?, ?, ?)",
      ["铁锈镇", "起点", 1, 1, "旧水坝", "目标", 1, 0]
    );
    db.run(
      "INSERT INTO location_connections (from_location, to_location, distance_km) VALUES (?, ?, ?)",
      ["铁锈镇", "旧水坝", 7]
    );
    const input: TravelInput = {
      current_location: "铁锈镇",
      target_location: "旧水坝",
    };

    // Act
    const result = travel(db, input);

    // Assert
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.from, "铁锈镇");
    assert.strictEqual(result.to, "旧水坝");
    assert.ok(
      result.distance_km > 0,
      `Expected distance_km > 0, got ${result.distance_km}`
    );
    assert.strictEqual(typeof result.encounter, "object");

    db.close();
  });

  it("should fail to travel to a location with no connection", async () => {
    // Arrange
    const db = await createDB();
    db.run(
      "INSERT INTO locations (name, description, discovered, visited) VALUES (?, ?, ?, ?), (?, ?, ?, ?)",
      ["铁锈镇", "起点", 1, 1, "旧水坝", "目标", 1, 0]
    );
    const input: TravelInput = {
      current_location: "铁锈镇",
      target_location: "旧水坝",
    };

    // Act
    const result = travel(db, input);

    // Assert
    assert.strictEqual(result.success, false);
    assert.ok(
      result.error && result.error.toLowerCase().includes("no connection"),
      `Expected error to include "no connection", got: ${result.error}`
    );

    db.close();
  });

  it("should fail to travel to a non-existent target", async () => {
    // Arrange
    const db = await createDB();
    db.run(
      "INSERT INTO locations (name, description, discovered, visited) VALUES (?, ?, ?, ?)",
      ["铁锈镇", "起点", 1, 1]
    );
    const input: TravelInput = {
      current_location: "铁锈镇",
      target_location: "不存在的地点",
    };

    // Act
    const result = travel(db, input);

    // Assert
    assert.strictEqual(result.success, false);
    assert.ok(
      result.error && result.error.toLowerCase().includes("not found"),
      `Expected error to include "not found", got: ${result.error}`
    );

    db.close();
  });
});

// ---------------------------------------------------------------------------
// explore
// ---------------------------------------------------------------------------

describe("explore", () => {
  it("should explore a known location", async () => {
    // Arrange
    const db = await createDB();
    db.run(
      "INSERT INTO locations (name, description, danger_level, has_shelter, discovered) VALUES (?, ?, ?, ?, ?)",
      ["东部废墟", "坍塌的高楼", 3, 1, 1]
    );
    const input: ExploreInput = { location_name: "东部废墟" };

    // Act
    const result = explore(db, input);

    // Assert
    assert.strictEqual(result.location_name, "东部废墟");
    assert.strictEqual(result.description, "坍塌的高楼");
    assert.strictEqual(result.danger_level, 3);
    assert.strictEqual(result.has_shelter, true);
    assert.ok(Array.isArray(result.discoveries));

    db.close();
  });

  it("should return an error when exploring a non-existent location", async () => {
    // Arrange
    const db = await createDB();
    const input: ExploreInput = { location_name: "不存在之地" };

    // Act
    const result = explore(db, input);

    // Assert
    assert.ok(
      result.error && result.error.length > 0,
      `Expected non-empty error for missing location, got: ${result.error}`
    );
    assert.ok(Array.isArray(result.discoveries));
    assert.deepStrictEqual(result.discoveries, []);

    db.close();
  });
});

// ---------------------------------------------------------------------------
// getKnownMap
// ---------------------------------------------------------------------------

describe("getKnownMap", () => {
  it("should return all discovered locations and connections", async () => {
    // Arrange
    const db = await createDB();
    db.run(
      "INSERT INTO locations (name, description, discovered) VALUES (?, ?, ?), (?, ?, ?)",
      ["铁锈镇", "起点", 1, "旧水坝", "目标", 1]
    );
    db.run(
      "INSERT INTO location_connections (from_location, to_location, distance_km) VALUES (?, ?, ?)",
      ["铁锈镇", "旧水坝", 7]
    );

    // Act
    const result = getKnownMap(db);

    // Assert
    assert.strictEqual(result.locations.length, 2);
    assert.strictEqual(result.connections.length, 1);
    assert.deepStrictEqual(result.connections[0], {
      from: "铁锈镇",
      to: "旧水坝",
      distance_km: 7,
    });

    db.close();
  });

  it("should return empty map when no locations exist", async () => {
    // Arrange
    const db = await createDB();

    // Act
    const result = getKnownMap(db);

    // Assert
    assert.deepStrictEqual(result.locations, []);
    assert.deepStrictEqual(result.connections, []);

    db.close();
  });
});

// ---------------------------------------------------------------------------
// discoverPOI
// ---------------------------------------------------------------------------

describe("discoverPOI", () => {
  it("should add a POI to an existing location", async () => {
    // Arrange
    const db = await createDB();
    db.run(
      "INSERT INTO locations (name, description, discovered) VALUES (?, ?, ?)",
      ["铁锈镇", "一个破旧的聚居地", 1]
    );
    const input: DiscoverPOIInput = {
      location_name: "铁锈镇",
      name: "老酒馆",
      description: "满是灰尘与劣质酒精的避风港",
      has_shelter: true,
    };

    // Act
    const result = discoverPOI(db, input);

    // Assert
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.location, "铁锈镇");
    assert.strictEqual(result.poi, "老酒馆");
    assert.strictEqual(result.total_pois, 1);

    db.close();
  });

  it("should fail when POI name already exists in the location", async () => {
    // Arrange
    const db = await createDB();
    db.run(
      "INSERT INTO locations (name, description, discovered) VALUES (?, ?, ?)",
      ["铁锈镇", "一个破旧的聚居地", 1]
    );
    db.run(
      "INSERT INTO location_pois (location_name, name, description, discovered) VALUES (?, ?, ?, ?)",
      ["铁锈镇", "老酒馆", "原有酒馆", 1]
    );
    const input: DiscoverPOIInput = {
      location_name: "铁锈镇",
      name: "老酒馆",
      description: "重复描述",
    };

    // Act
    const result = discoverPOI(db, input);

    // Assert
    assert.strictEqual(result.success, false);
    assert.ok(
      result.error && result.error.toLowerCase().includes("already exists"),
      `Expected error to include "already exists", got: ${result.error}`
    );

    db.close();
  });

  it("should fail when location does not exist", async () => {
    // Arrange
    const db = await createDB();
    const input: DiscoverPOIInput = {
      location_name: "不存在的地点",
      name: "老酒馆",
      description: "无处安放",
    };

    // Act
    const result = discoverPOI(db, input);

    // Assert
    assert.strictEqual(result.success, false);
    assert.ok(
      result.error && result.error.length > 0,
      `Expected non-empty error for missing location, got: ${result.error}`
    );

    db.close();
  });
});

// ---------------------------------------------------------------------------
// moveTo
// ---------------------------------------------------------------------------

describe("moveTo", () => {
  it("should move to another POI in the same location", async () => {
    // Arrange
    const db = await createDB();
    db.run(
      "INSERT INTO locations (name, description, discovered, visited) VALUES (?, ?, ?, ?)",
      ["东部废墟", "坍塌的高楼", 1, 1]
    );
    db.run(
      "INSERT INTO location_pois (location_name, name, description, discovered) VALUES (?, ?, ?, ?), (?, ?, ?, ?)",
      ["东部废墟", "入口", "破碎的大门", 1, "东部废墟", "地下仓库", "堆满杂物的地下室", 1]
    );
    const input: MoveToInput = {
      location_name: "东部废墟",
      target_poi: "地下仓库",
    };

    // Act
    const result = moveTo(db, input);

    // Assert
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.location, "东部废墟");
    assert.strictEqual(result.poi, "地下仓库");
    assert.deepStrictEqual(result.pois_available.sort(), ["入口", "地下仓库"].sort());

    db.close();
  });

  it("should fail when target POI does not exist", async () => {
    // Arrange
    const db = await createDB();
    db.run(
      "INSERT INTO locations (name, description, discovered, visited) VALUES (?, ?, ?, ?)",
      ["东部废墟", "坍塌的高楼", 1, 1]
    );
    db.run(
      "INSERT INTO location_pois (location_name, name, description, discovered) VALUES (?, ?, ?, ?)",
      ["东部废墟", "入口", "破碎的大门", 1]
    );
    const input: MoveToInput = {
      location_name: "东部废墟",
      target_poi: "不存在的POI",
    };

    // Act
    const result = moveTo(db, input);

    // Assert
    assert.strictEqual(result.success, false);
    assert.ok(
      result.error && result.error.toLowerCase().includes("not found"),
      `Expected error to include "not found", got: ${result.error}`
    );

    db.close();
  });

  it("should fail when location has no POIs", async () => {
    // Arrange
    const db = await createDB();
    db.run(
      "INSERT INTO locations (name, description, discovered, visited) VALUES (?, ?, ?, ?)",
      ["空地点", "什么都没有", 1, 1]
    );
    const input: MoveToInput = {
      location_name: "空地点",
      target_poi: "任意",
    };

    // Act
    const result = moveTo(db, input);

    // Assert
    assert.strictEqual(result.success, false);
    assert.ok(
      result.error && result.error.length > 0,
      `Expected non-empty error for location without POIs, got: ${result.error}`
    );

    db.close();
  });
});

// ---------------------------------------------------------------------------
// explore POIs
// ---------------------------------------------------------------------------

describe("explore POIs", () => {
  it("should include the list of POIs for a location that has POIs", async () => {
    // Arrange
    const db = await createDB();
    db.run(
      "INSERT INTO locations (name, description, danger_level, has_shelter, discovered) VALUES (?, ?, ?, ?, ?)",
      ["东部废墟", "坍塌的高楼", 3, 0, 1]
    );
    db.run(
      "INSERT INTO location_pois (location_name, name, description, discovered) VALUES (?, ?, ?, ?), (?, ?, ?, ?)",
      ["东部废墟", "入口", "破碎的大门", 1, "东部废墟", "地下仓库", "堆满杂物的地下室", 0]
    );
    const input: ExploreInput = { location_name: "东部废墟" };

    // Act
    const result = explore(db, input);

    // Assert
    assert.ok(Array.isArray(result.pois));
    assert.strictEqual(result.pois.length, 2);
    assert.ok(
      result.pois.every(
        (p) =>
          typeof p.name === "string" &&
          typeof p.description === "string" &&
          typeof p.discovered === "boolean"
      ),
      `Expected POIs to have name, description, and discovered fields, got: ${JSON.stringify(result.pois)}`
    );

    db.close();
  });

  it("should return an empty POI list for a location without POIs", async () => {
    // Arrange
    const db = await createDB();
    db.run(
      "INSERT INTO locations (name, description, danger_level, has_shelter, discovered) VALUES (?, ?, ?, ?, ?)",
      ["东部废墟", "坍塌的高楼", 3, 0, 1]
    );
    const input: ExploreInput = { location_name: "东部废墟" };

    // Act
    const result = explore(db, input);

    // Assert
    assert.ok(Array.isArray(result.pois));
    assert.deepStrictEqual(result.pois, []);

    db.close();
  });
});
