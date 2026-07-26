import { describe, it } from "node:test";
import assert from "node:assert";
import { buildCharacterSQL } from "../../engine/create-character.ts";

describe("create_character", () => {
  it("should create character with default stats", () => {
    const { sql, values } = buildCharacterSQL({ name: "流浪者" });
    assert.strictEqual(values[0], "流浪者");
    assert.strictEqual(values[4], 30); // hp
    assert.strictEqual(values[5], 30); // hp_max
    assert.strictEqual(values[6], 5); // strength default
    assert.strictEqual(values[20], 0); // credits default
    assert.strictEqual(values[21], null); // location default
    assert.ok(sql.includes("INSERT INTO characters"));
  });

  it("should accept custom hp_max", () => {
    const { values } = buildCharacterSQL({ name: "老兵", hp_max: 50 });
    assert.strictEqual(values[4], 50);
    assert.strictEqual(values[5], 50);
  });

  it("should accept partial custom stats", () => {
    const { values } = buildCharacterSQL({ name: "壮汉", stats: { strength: 10 } });
    assert.strictEqual(values[6], 10); // strength custom
    assert.strictEqual(values[7], 5); // agility default
    assert.strictEqual(values[8], 5); // endurance default
  });

  it("should accept custom skills", () => {
    const { values } = buildCharacterSQL({ name: "医生", skills: { medicine: 8, survival: 7 } });
    const medIdx = 14; // medicine is the 3rd skill (persuasion=12, survival=13, medicine=14)
    const survIdx = 13;
    assert.strictEqual(values[medIdx], 8);
    assert.strictEqual(values[survIdx], 7);
  });

  it("should accept custom credits and location", () => {
    const { values } = buildCharacterSQL({ name: "商人", credits: 200, current_location: "铁锈镇" });
    assert.strictEqual(values[20], 200);
    assert.strictEqual(values[21], "铁锈镇");
  });

  it("should set is_player=1, level=1, xp=0", () => {
    const { values } = buildCharacterSQL({ name: "测试" });
    assert.strictEqual(values[1], 1);  // is_player
    assert.strictEqual(values[2], 1);  // level
    assert.strictEqual(values[3], 0);  // xp
  });
});
