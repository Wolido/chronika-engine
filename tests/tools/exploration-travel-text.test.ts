import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { getSQL } from "../../db/connection.ts";
import { registerExplorationTools } from "../../tools/exploration.ts";

// ============================================================
// Helpers
// ============================================================

function mockPi() {
  const tools: Record<string, any> = {};
  return {
    tools,
    registerTool: (tool: any) => {
      tools[tool.name] = tool;
    },
  };
}

async function createTravelDbFile(filePath: string): Promise<void> {
  const SQL = await getSQL();
  const db = new SQL.Database();
  db.run(`
    CREATE TABLE IF NOT EXISTS game_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

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
      probability REAL DEFAULT 0,
      monster_id INTEGER
    );
  `);

  db.run(
    "INSERT INTO locations (name, description, danger_level, discovered, visited) VALUES (?, ?, ?, 1, 1)",
    ["Alpha", "Start location", 1],
  );
  db.run(
    "INSERT INTO locations (name, description, danger_level, discovered, visited) VALUES (?, ?, ?, 1, 0)",
    ["Beta", "Destination location", 1],
  );
  db.run(
    "INSERT INTO location_connections (from_location, to_location, distance_km) VALUES (?, ?, ?)",
    ["Alpha", "Beta", 5],
  );
  db.run(
    "INSERT INTO location_encounters (location_name, encounter_type, description, probability) VALUES (?, ?, ?, ?)",
    ["Alpha", "none", "none", 0],
  );

  writeFileSync(filePath, Buffer.from(db.export()));
  db.close();
}

async function executeTravelTool(dbPath: string): Promise<string> {
  const pi = mockPi();
  registerExplorationTools(pi);

  const tool = pi.tools["travel"];
  assert.ok(tool, "travel tool should be registered");

  const result = await tool.execute("call-1", {
    db_path: dbPath,
    current_location: "Alpha",
    target_location: "Beta",
  });

  return result.content[0].text;
}

// ============================================================
// Tests
// ============================================================

let tempDir: string;

before(() => {
  tempDir = mkdtempSync(resolve(tmpdir(), "chronika-exploration-travel-text-"));
});

after(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("travel tool output text", () => {
  it("should not suggest manual timer queries", async () => {
    // Arrange
    const dbPath = resolve(tempDir, "travel-no-query.db");
    await createTravelDbFile(dbPath);

    // Act
    const text = await executeTravelTool(dbPath);

    // Assert
    assert.ok(
      !text.toLowerCase().includes("check_timers"),
      `output should not mention check_timers, got: ${text}`,
    );
    assert.ok(
      !text.toLowerCase().includes("check_time"),
      `output should not mention check_time, got: ${text}`,
    );
  });

  it("should inform that timer status is injected automatically each turn", async () => {
    // Arrange
    const dbPath = resolve(tempDir, "travel-auto-inject.db");
    await createTravelDbFile(dbPath);

    // Act
    const text = await executeTravelTool(dbPath);

    // Assert
    assert.ok(
      text.includes("每回合自动注入"),
      `output should state timer status is injected automatically each turn, got: ${text}`,
    );
    assert.ok(
      text.includes("无需手动查询"),
      `output should state no manual query is needed, got: ${text}`,
    );
  });

  it("should retain distance, estimated arrival, and pre-arrival warnings", async () => {
    // Arrange
    const dbPath = resolve(tempDir, "travel-retained-info.db");
    await createTravelDbFile(dbPath);

    // Act
    const text = await executeTravelTool(dbPath);

    // Assert
    assert.ok(
      text.includes("5km"),
      `output should include distance, got: ${text}`,
    );
    assert.ok(
      text.includes("预计到达时间"),
      `output should include estimated arrival time, got: ${text}`,
    );
    assert.ok(
      text.includes("到达前请勿更新 current_location"),
      `output should warn not to update current_location before arrival, got: ${text}`,
    );
    assert.ok(
      text.includes("或叙述到达场景"),
      `output should warn not to narrate arrival scene before arrival, got: ${text}`,
    );
  });
});
