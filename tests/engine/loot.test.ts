import { describe, it } from "node:test";
import assert from "node:assert";
import { rollLoot } from "../../engine/loot.ts";

// ============================================================
// Interfaces
// ============================================================

interface LootEntry {
  item_name: string;
  drop_chance: number;    // 0.0 - 1.0
  quantity_min: number;   // 最小掉落数量
  quantity_max: number;   // 最大掉落数量
}

interface LootInput {
  table: LootEntry[];
  luck_modifier?: number;  // 可选幸运修正（加法，如 0.05 = +5% 概率）
}

interface LootItem {
  item_name: string;
  quantity: number;
}

interface LootRoll {
  item_name: string;
  rolled: number;         // d100 结果
  threshold: number;      // 需要 ≤ 的值（drop_chance × 100 + luck_modifier × 100）
  dropped: boolean;
}

interface LootResult {
  items: LootItem[];
  rolls: LootRoll[];
}

function sampleTable(): LootEntry[] {
  return [
    { item_name: "废铁", drop_chance: 0.8, quantity_min: 1, quantity_max: 3 },
    { item_name: "瓶盖", drop_chance: 0.5, quantity_min: 2, quantity_max: 5 },
    { item_name: "医疗粉", drop_chance: 0.2, quantity_min: 1, quantity_max: 1 },
  ];
}

// ============================================================
// Tests
// ============================================================

describe("rollLoot", () => {
  it("should return empty items and rolls for an empty drop table", () => {
    const result = rollLoot({ table: [] });

    assert.deepStrictEqual(result.items, []);
    assert.deepStrictEqual(result.rolls, []);
  });

  it("should always drop guaranteed item (drop_chance=1.0) with quantity in [min, max] over 10 runs", () => {
    const table: LootEntry[] = [
      { item_name: "必掉物品", drop_chance: 1.0, quantity_min: 3, quantity_max: 7 },
    ];

    for (let i = 0; i < 10; i++) {
      const result = rollLoot({ table });

      const dropped = result.items.find(item => item.item_name === "必掉物品");
      assert.ok(dropped, `run ${i}: should always drop guaranteed item`);
      assert.ok(
        dropped!.quantity >= 3 && dropped!.quantity <= 7,
        `run ${i}: quantity ${dropped!.quantity} out of range [3, 7]`,
      );
    }
  });

  it("should never drop an item with drop_chance=0.0 over 10 runs", () => {
    const table: LootEntry[] = [
      { item_name: "永不掉落", drop_chance: 0.0, quantity_min: 1, quantity_max: 1 },
    ];

    for (let i = 0; i < 10; i++) {
      const result = rollLoot({ table });

      const dropped = result.items.find(item => item.item_name === "永不掉落");
      assert.strictEqual(
        dropped,
        undefined,
        `run ${i}: should never drop zero-chance item`,
      );
    }
  });

  it("should drop 50% item roughly half the time over 200 runs (70-130 range)", () => {
    const table: LootEntry[] = [
      { item_name: "硬币", drop_chance: 0.5, quantity_min: 1, quantity_max: 1 },
    ];

    let dropCount = 0;
    for (let i = 0; i < 200; i++) {
      const result = rollLoot({ table });
      if (result.items.find(item => item.item_name === "硬币")) {
        dropCount++;
      }
    }

    assert.ok(
      dropCount >= 70 && dropCount <= 130,
      `expected 70-130 drops out of 200, got ${dropCount}`,
    );
  });

  it("should return items array containing all dropped items from a multi-entry table", () => {
    const table = sampleTable();

    const result = rollLoot({ table });

    // items.length should equal the number of items whose roll succeeded
    const droppedCount = result.rolls.filter(r => r.dropped).length;
    assert.strictEqual(
      result.items.length,
      droppedCount,
      `items.length ${result.items.length} should equal dropped roll count ${droppedCount}`,
    );

    // every item in result.items must have a corresponding successful roll
    for (const item of result.items) {
      const roll = result.rolls.find(r => r.item_name === item.item_name);
      assert.ok(roll, `missing roll entry for dropped item "${item.item_name}"`);
      assert.ok(roll!.dropped, `roll for "${item.item_name}" should be marked dropped`);
    }
  });

  it("should apply luck_modifier so that drop_chance=0.3 + luck_modifier=0.2 behaves like 0.5 (70-130 out of 200)", () => {
    const table: LootEntry[] = [
      { item_name: "幸运物品", drop_chance: 0.3, quantity_min: 1, quantity_max: 1 },
    ];

    let dropCount = 0;
    for (let i = 0; i < 200; i++) {
      const result = rollLoot({ table, luck_modifier: 0.2 });
      if (result.items.find(item => item.item_name === "幸运物品")) {
        dropCount++;
      }
    }

    assert.ok(
      dropCount >= 70 && dropCount <= 130,
      `expected 70-130 drops out of 200 with luck_modifier=0.2, got ${dropCount}`,
    );
  });
});
