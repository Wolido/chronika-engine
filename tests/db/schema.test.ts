import { describe, it } from "node:test";
import assert from "node:assert";
import { DDL_STATEMENTS, SCHEMA_VERSION } from "../../db/schema.ts";

describe("DDL_STATEMENTS", () => {
  const expectedTables = [
    "world_meta",
    "characters",
    "weapons",
    "items",
    "monsters",
    "inventory",
    "event_log",
    "game_state",
    "plugin_registry",
    "status_effects",
    "actions",
    "brands",
    "weapon_parts",
    "legendary_effects",
    "generated_weapons",
    "locations",
    "location_connections",
    "location_encounters",
    "location_pois",
    "poi_connections",
    "quests",
  ];

  it("should contain exactly 21 CREATE TABLE statements", () => {
    const matches = DDL_STATEMENTS.match(/CREATE TABLE IF NOT EXISTS\s+(\w+)/g);
    assert.ok(matches, "DDL_STATEMENTS should contain CREATE TABLE statements");
    assert.strictEqual(matches!.length, 21, `expected 21 CREATE TABLE, got ${matches!.length}`);
  });

  it("should create all 21 expected tables", () => {
    for (const table of expectedTables) {
      const re = new RegExp(`CREATE TABLE IF NOT EXISTS\\s+${table}\\b`);
      assert.ok(re.test(DDL_STATEMENTS), `DDL should include table '${table}'`);
    }
  });

  it("should have PRIMARY KEY in every table", () => {
    const tables = DDL_STATEMENTS.match(/CREATE TABLE IF NOT EXISTS\s+\w+[^;]+/g);
    assert.ok(tables, "DDL should contain table definitions");

    for (const tableDef of tables!) {
      assert.ok(
        /PRIMARY KEY/i.test(tableDef),
        `Table definition should include PRIMARY KEY:\n${tableDef.substring(0, 80)}...`
      );
    }
  });
});

describe("SCHEMA_VERSION", () => {
  it("should be 9", () => {
    assert.strictEqual(SCHEMA_VERSION, 9);
  });
});
