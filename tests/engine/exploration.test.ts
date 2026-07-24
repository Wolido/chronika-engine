/**
 * exploration.test.ts — 探索 / 地图系统引擎测试
 *
 * 测试 discoverLocation / travel / explore / getKnownMap / discoverPOI / moveTo 的期望行为。
 * 当前 discoverPOI / moveTo / explore 的 POI 连接功能尚未实现，
 * 因此新增 6 个连接相关测试处于 RED（失败）状态。
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

// Extended input type for RED phase: skill influences.
interface TravelInputWithStealth extends TravelInput {
  stealth?: number;
}

interface TravelInputWithTracking extends TravelInput {
  tracking?: number;
}

// Extended input type for RED phase: POI connections.
interface DiscoverPOIConnectionInput extends DiscoverPOIInput {
  connected_to?: string;
  to_location?: string;
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

  it("should occasionally trigger auto-encounter in safe areas without encounter table data", async () => {
    // Arrange
    const db = await createDB();
    db.run(
      "INSERT INTO locations (name, description, danger_level, discovered, visited) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)",
      ["安全起点", "低风险起点", 1, 1, 1, "安全终点", "低风险终点", 1, 1, 0]
    );
    db.run(
      "INSERT INTO location_connections (from_location, to_location, distance_km) VALUES (?, ?, ?)",
      ["安全起点", "安全终点", 4]
    );
    const input: TravelInput = {
      current_location: "安全起点",
      target_location: "安全终点",
    };

    // Force a deterministic roll that triggers the base 20% chance.
    const originalRandom = Math.random;
    Math.random = () => 0.15;

    try {
      // Act
      const result = travel(db, input);

      // Assert
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.encounter.triggered, true);
      assert.strictEqual(typeof result.encounter.encounter_type, "string");
      assert.ok(result.encounter.encounter_type!.length > 0);
      assert.strictEqual(typeof result.encounter.description, "string");
      assert.ok(result.encounter.description!.length > 0);
      assert.strictEqual((result.encounter as any).danger_level, 1);
    } finally {
      Math.random = originalRandom;
    }

    db.close();
  });

  it("should frequently trigger auto-encounter in high-danger areas without encounter table data", async () => {
    // Arrange
    const db = await createDB();
    db.run(
      "INSERT INTO locations (name, description, danger_level, discovered, visited) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)",
      ["高危起点", "高风险起点", 5, 1, 1, "高危终点", "高风险终点", 5, 1, 0]
    );
    db.run(
      "INSERT INTO location_connections (from_location, to_location, distance_km) VALUES (?, ?, ?)",
      ["高危起点", "高危终点", 4]
    );
    const input: TravelInput = {
      current_location: "高危起点",
      target_location: "高危终点",
    };

    // Force a deterministic roll that triggers the base 68% chance.
    const originalRandom = Math.random;
    Math.random = () => 0.5;

    try {
      // Act
      const result = travel(db, input);

      // Assert
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.encounter.triggered, true);
    } finally {
      Math.random = originalRandom;
    }

    db.close();
  });

  it("should prioritize encounter table data when available", async () => {
    // Arrange
    const db = await createDB();
    db.run(
      "INSERT INTO locations (name, description, danger_level, discovered, visited) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)",
      ["表数据起点", "有遭遇表数据", 2, 1, 1, "表数据终点", "目标", 2, 1, 0]
    );
    db.run(
      "INSERT INTO location_connections (from_location, to_location, distance_km) VALUES (?, ?, ?)",
      ["表数据起点", "表数据终点", 5]
    );
    db.run(
      "INSERT INTO location_encounters (location_name, encounter_type, description, probability) VALUES (?, ?, ?, ?)",
      ["表数据起点", "combat", "伏击的强盗", 1.0]
    );
    const input: TravelInput = {
      current_location: "表数据起点",
      target_location: "表数据终点",
    };

    const originalRandom = Math.random;
    Math.random = () => 0.5;

    try {
      // Act
      const result = travel(db, input);

      // Assert
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.encounter.triggered, true);
      assert.strictEqual(result.encounter.encounter_type, "combat");
      assert.strictEqual(result.encounter.description, "伏击的强盗");
      assert.strictEqual(typeof (result.encounter as any).danger_level, "number");
    } finally {
      Math.random = originalRandom;
    }

    db.close();
  });

  it("should allow encounters to trigger multiple times on the same route", async () => {
    // Arrange
    const db = await createDB();
    db.run(
      "INSERT INTO locations (name, description, danger_level, discovered, visited) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)",
      ["重复起点", "可重复遇敌起点", 1, 1, 1, "重复终点", "可重复遇敌终点", 1, 1, 0]
    );
    db.run(
      "INSERT INTO location_connections (from_location, to_location, distance_km) VALUES (?, ?, ?)",
      ["重复起点", "重复终点", 3]
    );
    const input: TravelInput = {
      current_location: "重复起点",
      target_location: "重复终点",
    };

    // Force deterministic rolls that always trigger the 20% chance.
    const originalRandom = Math.random;
    Math.random = () => 0.1;

    try {
      // Act
      let triggerCount = 0;
      for (let i = 0; i < 5; i++) {
        const result = travel(db, input);
        if (result.encounter.triggered) triggerCount++;
      }

      // Assert
      assert.ok(
        triggerCount > 1,
        `Expected more than 1 encounter on the same route, got ${triggerCount}`
      );
    } finally {
      Math.random = originalRandom;
    }

    db.close();
  });

  // --- 追踪发现信息 (RED phase) ----------------------------------------

  it("should have a chance to discover extra info when tracking is high", async () => {
    // Arrange
    // tracking=10 → 10 × 0.05 = 50% chance per travel
    const db = await createDB();
    db.run(
      "INSERT INTO locations (name, description, danger_level, discovered, visited) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)",
      ["追踪起点", "追踪测试起点", 1, 1, 1, "追踪终点", "追踪测试终点", 1, 1, 0]
    );
    db.run(
      "INSERT INTO location_connections (from_location, to_location, distance_km) VALUES (?, ?, ?)",
      ["追踪起点", "追踪终点", 4]
    );

    const input: TravelInputWithTracking = {
      current_location: "追踪起点",
      target_location: "追踪终点",
      tracking: 10,
    };

    // Act
    let discoveryCount = 0;
    let detailNonEmpty = true;
    for (let i = 0; i < 50; i++) {
      const result = travel(db, input as TravelInput);
      assert.strictEqual(result.success, true);
      const r = result as any;
      if (r.tracking_discovery) {
        discoveryCount++;
        if (!r.tracking_detail || r.tracking_detail.length === 0) {
          detailNonEmpty = false;
        }
      }
    }

    // Assert
    // 50 × 0.5 = 25 expected; at least 10 is very safe lower bound
    assert.ok(
      discoveryCount >= 10,
      `expected at least 10 tracking discoveries out of 50 with tracking=10, got ${discoveryCount}`,
    );
    assert.strictEqual(
      detailNonEmpty,
      true,
      "tracking_detail should be non-empty when tracking_discovery is true",
    );

    db.close();
  });

  it("should reduce encounter chance when stealth skill is high", async () => {
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

    const inputWithoutStealth: TravelInput = {
      current_location: "潜行起点",
      target_location: "潜行终点",
    };
    const inputWithStealth: TravelInputWithStealth = {
      current_location: "潜行起点",
      target_location: "潜行终点",
      stealth: 10,
    };

    // Base chance for danger=3: 3*0.12+0.08 = 0.44
    // With stealth=10: 0.44 * (1.0 - 10*0.03) = 0.308
    // roll=0.4 should trigger without stealth but not with stealth.
    const originalRandom = Math.random;
    Math.random = () => 0.4;

    try {
      // Act
      const resultWithoutStealth = travel(db, inputWithoutStealth);
      const resultWithStealth = travel(db, inputWithStealth);

      // Assert
      assert.strictEqual(
        resultWithoutStealth.encounter.triggered,
        true,
        "expected encounter to trigger without stealth when roll=0.4"
      );
      assert.strictEqual(
        resultWithStealth.encounter.triggered,
        false,
        "expected encounter not to trigger with stealth=10 when roll=0.4"
      );
    } finally {
      Math.random = originalRandom;
    }

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

// ---------------------------------------------------------------------------
// POI connections (RED phase)
// ---------------------------------------------------------------------------

describe("discoverPOI connections", () => {
  it("should create a poi_connections row when connected_to is provided", async () => {
    // Arrange
    const db = await createDB();
    db.run(
      "INSERT INTO locations (name, description, discovered) VALUES (?, ?, ?)",
      ["东部废墟", "坍塌的高楼", 1]
    );
    db.run(
      "INSERT INTO location_pois (location_name, name, description, discovered) VALUES (?, ?, ?, ?)",
      ["东部废墟", "入口", "破碎的大门", 1]
    );
    const input: DiscoverPOIConnectionInput = {
      location_name: "东部废墟",
      name: "地下仓库",
      description: "堆满杂物的地下室",
      connected_to: "入口",
    };

    // Act
    const result = discoverPOI(db, input);

    // Assert
    assert.strictEqual(result.success, true);
    assert.strictEqual((result as any).connection_created, true);

    const rows = db.exec(
      "SELECT location_name, from_poi, to_poi, to_location FROM poi_connections WHERE location_name = '东部废墟'"
    );
    assert.ok(rows.length > 0 && rows[0].values.length > 0, "Expected a poi_connections row");
    const [locName, fromPoi, toPoi, toLocation] = rows[0].values[0] as string[];
    assert.strictEqual(locName, "东部废墟");
    assert.strictEqual(fromPoi, "入口");
    assert.strictEqual(toPoi, "地下仓库");
    assert.strictEqual(toLocation, null);

    db.close();
  });

  it("should store to_location in poi_connections when provided", async () => {
    // Arrange
    const db = await createDB();
    db.run(
      "INSERT INTO locations (name, description, discovered) VALUES (?, ?, ?)",
      ["东部废墟", "坍塌的高楼", 1]
    );
    db.run(
      "INSERT INTO location_pois (location_name, name, description, discovered) VALUES (?, ?, ?, ?)",
      ["东部废墟", "入口", "破碎的大门", 1]
    );
    const input: DiscoverPOIConnectionInput = {
      location_name: "东部废墟",
      name: "逃生通道",
      description: "通往外界的裂缝",
      connected_to: "入口",
      to_location: "外部荒野",
    };

    // Act
    const result = discoverPOI(db, input);

    // Assert
    assert.strictEqual(result.success, true);
    assert.strictEqual((result as any).connection_created, true);

    const rows = db.exec(
      "SELECT to_location FROM poi_connections WHERE from_poi = '入口' AND to_poi = '逃生通道'"
    );
    assert.ok(rows.length > 0 && rows[0].values.length > 0, "Expected a poi_connections row");
    assert.strictEqual(rows[0].values[0][0], "外部荒野");

    db.close();
  });
});

describe("moveTo connections", () => {
  it("should move to a directly connected POI", async () => {
    // Arrange
    const db = await createDB();
    db.run(
      "INSERT INTO locations (name, description, discovered, visited) VALUES (?, ?, ?, ?)",
      ["东部废墟", "坍塌的高楼", 1, 1]
    );
    db.run(
      "INSERT INTO location_pois (location_name, name, description, discovered) VALUES (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)",
      [
        "东部废墟", "入口", "破碎的大门", 1,
        "东部废墟", "地下仓库", "堆满杂物的地下室", 1,
        "东部废墟", "秘密房间", "隐藏的暗室", 1,
      ]
    );
    db.run(
      "INSERT INTO poi_connections (location_name, from_poi, to_poi, description) VALUES (?, ?, ?, ?), (?, ?, ?, ?)",
      [
        "东部废墟", "入口", "地下仓库", "向下的阶梯",
        "东部废墟", "地下仓库", "秘密房间", "暗门后的通道",
      ]
    );

    // Establish current POI at 入口 before testing the connection.
    moveTo(db, { location_name: "东部废墟", target_poi: "入口" });

    // Act
    const result = moveTo(db, { location_name: "东部废墟", target_poi: "地下仓库" });

    // Assert
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.poi, "地下仓库");
    // After moving, available POIs should be those reachable from the new current POI.
    assert.deepStrictEqual(result.pois_available, ["秘密房间"]);

    db.close();
  });

  it("should fail to move to a POI without a direct connection", async () => {
    // Arrange
    const db = await createDB();
    db.run(
      "INSERT INTO locations (name, description, discovered, visited) VALUES (?, ?, ?, ?)",
      ["东部废墟", "坍塌的高楼", 1, 1]
    );
    db.run(
      "INSERT INTO location_pois (location_name, name, description, discovered) VALUES (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)",
      [
        "东部废墟", "入口", "破碎的大门", 1,
        "东部废墟", "地下仓库", "堆满杂物的地下室", 1,
        "东部废墟", "瞭望塔", "高耸的残塔", 1,
      ]
    );
    db.run(
      "INSERT INTO poi_connections (location_name, from_poi, to_poi) VALUES (?, ?, ?)",
      ["东部废墟", "入口", "地下仓库"]
    );

    // Establish current POI at 入口.
    moveTo(db, { location_name: "东部废墟", target_poi: "入口" });

    // Act
    const result = moveTo(db, { location_name: "东部废墟", target_poi: "瞭望塔" });

    // Assert
    assert.strictEqual(result.success, false);
    assert.ok(
      result.pois_available.includes("地下仓库"),
      `Expected pois_available to include '地下仓库', got: ${JSON.stringify(result.pois_available)}`
    );
    assert.ok(
      !result.pois_available.includes("瞭望塔"),
      `Expected pois_available not to include the unconnected '瞭望塔', got: ${JSON.stringify(result.pois_available)}`
    );

    db.close();
  });
});

describe("explore connections", () => {
  it("should include available_connections from the current POI", async () => {
    // Arrange
    const db = await createDB();
    db.run(
      "INSERT INTO locations (name, description, danger_level, has_shelter, discovered) VALUES (?, ?, ?, ?, ?)",
      ["东部废墟", "坍塌的高楼", 3, 0, 1]
    );
    db.run(
      "INSERT INTO location_pois (location_name, name, description, discovered) VALUES (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)",
      [
        "东部废墟", "入口", "破碎的大门", 1,
        "东部废墟", "地下仓库", "堆满杂物的地下室", 1,
        "东部废墟", "瞭望塔", "高耸的残塔", 1,
      ]
    );
    db.run(
      "INSERT INTO poi_connections (location_name, from_poi, to_poi, description) VALUES (?, ?, ?, ?), (?, ?, ?, ?)",
      [
        "东部废墟", "入口", "地下仓库", "向下的阶梯",
        "东部废墟", "入口", "瞭望塔", "向上的铁梯",
      ]
    );

    // Set current POI to 入口 so available_connections are deterministic.
    moveTo(db, { location_name: "东部废墟", target_poi: "入口" });

    // Act
    const result = explore(db, { location_name: "东部废墟" });

    // Assert
    const connections = (result as any).available_connections;
    assert.ok(Array.isArray(connections), "Expected available_connections to be an array");
    assert.strictEqual(connections.length, 2);
    const targets = connections.map((c: any) => c.to_poi).sort();
    assert.deepStrictEqual(targets, ["地下仓库", "瞭望塔"]);
    assert.ok(
      connections.some((c: any) => c.to_poi === "地下仓库" && typeof c.description === "string"),
      "Expected connection to include description"
    );

    db.close();
  });

  it("should include cross_location_exits for POIs that lead to world locations", async () => {
    // Arrange
    const db = await createDB();
    db.run(
      "INSERT INTO locations (name, description, danger_level, has_shelter, discovered) VALUES (?, ?, ?, ?, ?)",
      ["东部废墟", "坍塌的高楼", 3, 0, 1]
    );
    db.run(
      "INSERT INTO location_pois (location_name, name, description, discovered) VALUES (?, ?, ?, ?)",
      ["东部废墟", "逃生通道", "通往外界的裂缝", 1]
    );
    db.run(
      "INSERT INTO poi_connections (location_name, from_poi, to_poi, to_location) VALUES (?, ?, ?, ?)",
      ["东部废墟", "逃生通道", null, "外部荒野"]
    );

    // Act
    const result = explore(db, { location_name: "东部废墟" });

    // Assert
    const exits = (result as any).cross_location_exits;
    assert.ok(Array.isArray(exits), "Expected cross_location_exits to be an array");
    assert.ok(
      exits.some((e: any) => e.to_location === "外部荒野" && e.via === "逃生通道"),
      `Expected cross_location_exits to include exit to 外部荒野 via 逃生通道, got: ${JSON.stringify(exits)}`
    );

    db.close();
  });
});
