import { describe, it } from "node:test";
import assert from "node:assert";
import { getSQL } from "../../db/connection.ts";
import type { SqlJsStatic, Database } from "sql.js";

// ============================================================
// Interfaces
// ============================================================

interface EncounterRequest {
  danger_level: number;
  db: any;
}

interface EncounterMonster {
  name: string;
  category: string;
  hp: number;
  damage_min: number;
  damage_max: number;
  accuracy: number;
  evasion: number;
  armor: number;
  tier: number;
  xp_reward: number;
}

interface EncounterResult {
  success: boolean;
  monster?: EncounterMonster;
  approximate: boolean;
  note: string;
  error?: string;
}

type GetEncounterFn = (input: EncounterRequest) => EncounterResult;

// ============================================================
// Helpers
// ============================================================

const MONSTERS_DDL = `
CREATE TABLE IF NOT EXISTS monsters (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  hp INTEGER NOT NULL,
  damage_min INTEGER NOT NULL,
  damage_max INTEGER NOT NULL,
  accuracy REAL NOT NULL,
  evasion REAL DEFAULT 0,
  armor INTEGER DEFAULT 0,
  tier INTEGER DEFAULT 1,
  xp_reward INTEGER DEFAULT 0
);
`;

async function createDB(): Promise<Database> {
  const sql = await getSQL();
  const db = new sql.Database();
  db.run("PRAGMA foreign_keys = ON");
  db.run(MONSTERS_DDL);
  return db;
}

function sampleMonster(
  name: string,
  tier: number,
  overrides: Partial<EncounterMonster> = {}
): EncounterMonster {
  return {
    name,
    category: "beast",
    hp: 20,
    damage_min: 2,
    damage_max: 5,
    accuracy: 0.6,
    evasion: 0.2,
    armor: 1,
    tier,
    xp_reward: 10,
    ...overrides,
  };
}

function insertMonster(db: Database, monster: EncounterMonster): void {
  db.run(
    `INSERT INTO monsters (name, category, hp, damage_min, damage_max, accuracy, evasion, armor, tier, xp_reward)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      monster.name,
      monster.category,
      monster.hp,
      monster.damage_min,
      monster.damage_max,
      monster.accuracy,
      monster.evasion,
      monster.armor,
      monster.tier,
      monster.xp_reward,
    ]
  );
}

async function loadGetEncounter(): Promise<GetEncounterFn> {
  const mod = await import("../../engine/encounter.ts");
  return mod.getEncounter as GetEncounterFn;
}

// ============================================================
// Tests
// ============================================================

describe("getEncounter", () => {
  it("should return an exact tier match when a monster with the requested danger_level exists", async () => {
    // Arrange
    const db = await createDB();
    insertMonster(db, sampleMonster("变异鼠", 1));
    insertMonster(db, sampleMonster("强盗", 3));
    insertMonster(db, sampleMonster("巨蝎", 5));
    const getEncounter = await loadGetEncounter();
    const input: EncounterRequest = { danger_level: 3, db };

    // Act
    const result = getEncounter(input);

    // Assert
    assert.strictEqual(result.success, true);
    assert.ok(result.monster, "Expected a monster to be returned");
    assert.strictEqual(result.monster!.tier, 3);
    assert.strictEqual(result.monster!.name, "强盗");
    assert.strictEqual(result.approximate, false);
    assert.ok(typeof result.note === "string" && result.note.length > 0);

    db.close();
  });

  it("should return the closest tier and mark approximate when no exact match exists", async () => {
    // Arrange
    const db = await createDB();
    insertMonster(db, sampleMonster("变异鼠", 1));
    insertMonster(db, sampleMonster("巨蝎", 5));
    const getEncounter = await loadGetEncounter();
    const input: EncounterRequest = { danger_level: 3, db };

    // Act
    const result = getEncounter(input);

    // Assert
    assert.strictEqual(result.success, true);
    assert.ok(result.monster, "Expected a monster to be returned");
    assert.ok(
      result.monster!.tier === 1 || result.monster!.tier === 5,
      `Expected tier 1 or 5 (closest to 3), got ${result.monster!.tier}`
    );
    assert.strictEqual(result.approximate, true);
    assert.ok(typeof result.note === "string" && result.note.length > 0);

    db.close();
  });

  it("should return an error when the monsters table is empty", async () => {
    // Arrange
    const db = await createDB();
    const getEncounter = await loadGetEncounter();
    const input: EncounterRequest = { danger_level: 3, db };

    // Act
    const result = getEncounter(input);

    // Assert
    assert.strictEqual(result.success, false);
    assert.ok(
      result.error && result.error.length > 0,
      `Expected a non-empty error, got: ${result.error}`
    );

    db.close();
  });
});
