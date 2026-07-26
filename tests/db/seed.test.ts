import { describe, it } from "node:test";
import assert from "node:assert";
import {
  SEED_MONSTERS,
  SEED_ITEMS,
  SEED_STATUS_EFFECTS,
  SEED_LOCATIONS,
  SEED_CONNECTIONS,
} from "../../db/seed.ts";

// 每个 SEED 类型对应的必需字段
const MONSTER_COLS = [
  "name",
  "category",
  "hp",
  "damage_min",
  "damage_max",
  "accuracy",
  "evasion",
  "armor",
  "tier",
  "xp_reward",
  "strength",
  "agility",
  "endurance",
  "perception",
  "intelligence",
  "willpower",
];
const ITEM_COLS = [
  "name",
  "item_type",
  "rarity",
  "value",
  "weight",
  "effect_type",
  "effect_value",
  "stackable",
  "stack_max",
];
const EFFECT_COLS = [
  "name",
  "effect_type",
  "target_attribute",
  "magnitude",
  "duration",
  "description",
];
const LOC_COLS = [
  "name",
  "region",
  "description",
  "danger_level",
  "has_shelter",
];
const CONN_COLS = [
  "from_location",
  "to_location",
  "distance_km",
  "description",
];

describe("seed data integrity", () => {
  it("all SEED_MONSTERS have no undefined fields", () => {
    for (const m of SEED_MONSTERS) {
      for (const col of MONSTER_COLS) {
        assert.notStrictEqual(
          (m as any)[col],
          undefined,
          `monster "${m.name}" missing field "${col}"`
        );
      }
    }
  });

  it("all SEED_ITEMS have no undefined fields", () => {
    for (const it of SEED_ITEMS) {
      for (const col of ITEM_COLS) {
        assert.notStrictEqual(
          (it as any)[col],
          undefined,
          `item "${it.name}" missing field "${col}"`
        );
      }
    }
  });

  it("all SEED_STATUS_EFFECTS have no undefined fields", () => {
    for (const e of SEED_STATUS_EFFECTS) {
      for (const col of EFFECT_COLS) {
        assert.notStrictEqual(
          (e as any)[col],
          undefined,
          `effect "${e.name}" missing field "${col}"`
        );
      }
    }
  });

  it("all SEED_LOCATIONS have no undefined fields", () => {
    for (const l of SEED_LOCATIONS) {
      for (const col of LOC_COLS) {
        assert.notStrictEqual(
          (l as any)[col],
          undefined,
          `location "${l.name}" missing field "${col}"`
        );
      }
    }
  });

  it("all SEED_CONNECTIONS have no undefined fields", () => {
    for (const c of SEED_CONNECTIONS) {
      for (const col of CONN_COLS) {
        assert.notStrictEqual(
          (c as any)[col],
          undefined,
          `connection "${(c as any).from_location}->${(c as any).to_location}" missing field "${col}"`
        );
      }
    }
  });

  it("seed data has correct counts", () => {
    assert.strictEqual(SEED_MONSTERS.length, 75);
    assert.strictEqual(SEED_ITEMS.length, 13);
    assert.strictEqual(SEED_STATUS_EFFECTS.length, 12);
    assert.strictEqual(SEED_LOCATIONS.length, 15);
    assert.strictEqual(SEED_CONNECTIONS.length, 15);
  });

  it("all SEED_MONSTERS stat sum ≤ tier × 17", () => {
    for (const m of SEED_MONSTERS) {
      const statSum =
        m.strength +
        m.agility +
        m.endurance +
        m.perception +
        m.intelligence +
        m.willpower;
      assert.ok(
        statSum <= m.tier * 17,
        `monster "${m.name}" stat sum ${statSum} > tier ${m.tier} × 17 (${m.tier * 17})`
      );
    }
  });
});
