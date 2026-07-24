import { describe, it, before } from "node:test";
import assert from "node:assert";
import { getSQL, rowsToObjects } from "../../db/connection.ts";
import { DDL_STATEMENTS } from "../../db/schema.ts";
import type { SqlJsStatic } from "sql.js";

describe("getSQL", () => {
  let SQL: SqlJsStatic;

  before(async () => {
    SQL = await getSQL();
  });

  it("should return an object with Database constructor", () => {
    assert.ok(SQL, "getSQL should return a truthy value");
    assert.strictEqual(typeof SQL.Database, "function", "SQL.Database should be a function");
  });

  it("should create an in-memory database, run DDL, and verify all 20 tables exist", () => {
    const db = new SQL.Database();
    db.run("PRAGMA foreign_keys = ON");
    db.run(DDL_STATEMENTS);

    const result = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );

    assert.ok(result.length > 0, "should have tables in sqlite_master");
    const tableNames = result[0].values.map(row => row[0]);

    const expectedTables = [
      "actions",
      "brands",
      "characters",
      "event_log",
      "game_state",
      "generated_weapons",
      "inventory",
      "items",
      "legendary_effects",
      "location_connections",
      "location_encounters",
      "location_pois",
      "locations",
      "monsters",
      "plugin_registry",
      "poi_connections",
      "status_effects",
      "weapon_parts",
      "weapons",
      "world_meta",
    ];

    assert.deepStrictEqual(tableNames, expectedTables);

    db.close();
  });

  it("should insert and query a row in world_meta", () => {
    const db = new SQL.Database();
    db.run("PRAGMA foreign_keys = ON");
    db.run(DDL_STATEMENTS);

    db.run("INSERT INTO world_meta (world_name, world_desc) VALUES (?, ?)", [
      "Test World",
      "A test world description",
    ]);

    const result = db.exec("SELECT * FROM world_meta WHERE world_name = 'Test World'");
    assert.ok(result.length > 0, "query should return results");

    const rows = rowsToObjects(result);
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].world_name, "Test World");
    assert.strictEqual(rows[0].world_desc, "A test world description");
    assert.ok(rows[0].id !== undefined, "should have an auto-generated id");

    db.close();
  });
});

describe("foreign key constraint", () => {
  let SQL: SqlJsStatic;

  before(async () => {
    SQL = await getSQL();
  });

  it("should reject inventory insert with non-existent character_id", () => {
    const db = new SQL.Database();
    db.run("PRAGMA foreign_keys = ON");
    db.run(DDL_STATEMENTS);

    // Insert into inventory referencing a character_id that doesn't exist
    assert.throws(
      () => {
        db.run("INSERT INTO inventory (character_id) VALUES (?)", [999]);
      },
      /FOREIGN KEY|constraint/i,
      "should throw a foreign key constraint violation"
    );

    db.close();
  });
});
