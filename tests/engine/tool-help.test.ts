import { describe, it } from "node:test";
import assert from "node:assert";
import { getToolHelp } from "../../engine/tool-help.ts";

// ============================================================
// Tests
// ============================================================

describe("getToolHelp", () => {

  it("should return found=true with 6 parameters when querying world_gen", () => {
    const result = getToolHelp("world_gen");

    assert.strictEqual(result.found, true);
    assert.strictEqual(result.tool.name, "world_gen");
    assert.strictEqual(typeof result.tool.description, "string");
    assert.ok(result.tool.description.length > 0, "description should not be empty");
    assert.strictEqual(result.tool.parameters.length, 7);

    const paramNames = result.tool.parameters.map(p => p.name);
    assert.deepStrictEqual(paramNames, [
      "world_meta",
      "db_path",
      "weapons",
      "monsters",
      "items",
      "status_effects",
      "actions",
    ]);

    // db_path should be required string
    const dbPath = result.tool.parameters.find(p => p.name === "db_path")!;
    assert.ok(dbPath, "db_path param should exist");
    assert.strictEqual(dbPath.type, "string");
    assert.strictEqual(dbPath.required, true);

    // weapons should be optional array
    const weapons = result.tool.parameters.find(p => p.name === "weapons")!;
    assert.ok(weapons, "weapons param should exist");
    assert.strictEqual(weapons.type, "array");
    assert.strictEqual(weapons.required, false);
  });

  it("should return found=true and include attacker.* and defender.* parameters when querying combat_resolve", () => {
    const result = getToolHelp("combat_resolve");

    assert.strictEqual(result.found, true);
    assert.strictEqual(result.tool.name, "combat_resolve");

    const paramNames = result.tool.parameters.map(p => p.name);
    assert.ok(paramNames.some(n => n.startsWith("attacker.")), "should have attacker.* parameters");
    assert.ok(paramNames.some(n => n.startsWith("defender.")), "should have defender.* parameters");

    const attackerStats = result.tool.parameters.find(p => p.name === "attacker.stats")!;
    assert.strictEqual(attackerStats.type, "object");
    assert.strictEqual(attackerStats.required, true);
    assert.ok(attackerStats.description.length > 0, "attacker.stats description should not be empty");

    const defenderEvasion = result.tool.parameters.find(p => p.name === "defender.evasion")!;
    assert.strictEqual(defenderEvasion.type, "number");
    assert.strictEqual(defenderEvasion.required, true);
    assert.ok(defenderEvasion.description.length > 0, "defender.evasion description should not be empty");
  });

  it("should return found=false with error containing 'not found' when querying a non-existent tool", () => {
    const result = getToolHelp("nonexistent_tool_xyz");

    assert.strictEqual(result.found, false);
    assert.ok(result.error, "error should be present when tool not found");
    assert.ok(
      result.error!.toLowerCase().includes("not found"),
      `error message should contain 'not found', got: "${result.error}"`,
    );
  });

  it("should return found=true and difficulty constraints contain '1-30' when querying skill_check", () => {
    const result = getToolHelp("skill_check");

    assert.strictEqual(result.found, true);
    assert.strictEqual(result.tool.name, "skill_check");

    const difficulty = result.tool.parameters.find(p => p.name === "difficulty")!;
    assert.ok(difficulty, "difficulty param should exist");
    assert.strictEqual(difficulty.type, "number");
    assert.strictEqual(difficulty.required, true);
    assert.ok(difficulty.constraints, "difficulty should have constraints");
    assert.ok(
      difficulty.constraints!.includes("1-30"),
      `constraints should include '1-30', got: "${difficulty.constraints}"`,
    );

    // modifier should also exist as optional
    const modifier = result.tool.parameters.find(p => p.name === "modifier")!;
    assert.ok(modifier, "modifier param should exist");
    assert.strictEqual(modifier.type, "number");
    assert.strictEqual(modifier.required, false);
  });

  it("should return all tool names when querying with 'list'", () => {
    const result = getToolHelp("list");

    assert.strictEqual(result.found, true);

    // The 'list' query should return a tool whose name is "list"
    // and whose description enumerates the available tool names
    const toolNames = [
      "world_gen",
      "combat_resolve",
      "skill_check",
      "craft",
      "travel",
      "init_db",
      "generate_loot",
      "generate_weapon",
      "trade",
      "loot",
      "consume",
      "equip_item",
      "explore",
      "get_encounter",
      "create_quest",
      "level_up",
      "quick_travel",
      "generate_stock",
      "dice",
      "db_query",
      "db_exec",
      "legendary_gen",
      "status_apply",
      "status_tick",
      "check_arrival",
      "game_time",
      "discover_location",
      "discover_poi",
      "move_to",
      "get_map",
      "log_event",
      "get_history",
      "active_quests",
      "complete_quest",
      "take_loot",
      "gm_guide",
      "unequip_item",
      "equipment_stats",
      "tool_help",
    ];

    const desc = result.tool.description;
    assert.ok(desc.length > 0, "list description should not be empty");

    for (const name of toolNames) {
      assert.ok(
        desc.includes(name),
        `list description should mention "${name}"`,
      );
    }
  });

});
