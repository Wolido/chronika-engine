/**
 * loot-gen-accessory.test.ts — Cycle 2 饰品掉落效果 RED 阶段测试
 *
 * 覆盖范围：
 * - loot_magnet：提升物品掉落概率
 * - ammo_scavenge：掉落列表含弹药
 * - double_loot：数量翻倍
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  generateLoot,
  type GenerateLootInput,
  type GenerateLootResult,
  type LootItemEntry,
} from "../../engine/loot-gen.ts";

interface AccessoryData {
  name: string;
  trigger: string;
  effect_type: string;
  magnitude: number;
}

interface GenerateLootInputWithAccessories extends GenerateLootInput {
  accessories?: AccessoryData[];
}

function runMany(input: GenerateLootInputWithAccessories, times: number): GenerateLootResult[] {
  const results: GenerateLootResult[] = [];
  for (let i = 0; i < times; i++) {
    results.push(generateLoot(input));
  }
  return results;
}

function countItemDrops(results: GenerateLootResult[]): number {
  return results.reduce(
    (sum, r) => sum + r.items.filter((item) => item.type === "item").length,
    0
  );
}

function totalItemQuantity(results: GenerateLootResult[]): number {
  return results.reduce(
    (sum, r) =>
      sum +
      r.items
        .filter((item) => item.type === "item")
        .reduce((q, item) => q + item.quantity, 0),
    0
  );
}

describe("generateLoot accessories", () => {
  it("should drop items more often with loot_magnet accessory", () => {
    // Arrange
    const baseInput: GenerateLootInputWithAccessories = { tier: 3 };
    const magnetInput: GenerateLootInputWithAccessories = {
      tier: 3,
      accessories: [
        { name: "吸金石", trigger: "on_loot", effect_type: "loot_magnet", magnitude: 0.3 },
      ],
    };

    const originalRandom = Math.random;
    // Force item roll to be just above the base threshold so the bonus pushes it over.
    // tier 3 base item chance = 0.3 + 3*0.12 = 0.66
    // loot_magnet magnitude=0.3 should push chance to ~0.96
    let callCount = 0;
    Math.random = () => {
      callCount++;
      // First call is item chance roll.
      if (callCount === 1) return 0.8;
      return 0.5;
    };

    try {
      // Act
      const baseResult = generateLoot(baseInput as GenerateLootInput);
      callCount = 0;
      const magnetResult = generateLoot(magnetInput as GenerateLootInput);

      // Assert
      const baseItemCount = baseResult.items.filter((i) => i.type === "item").length;
      const magnetItemCount = magnetResult.items.filter((i) => i.type === "item").length;
      assert.ok(
        magnetItemCount > baseItemCount,
        `expected loot_magnet to increase item drops: base=${baseItemCount}, magnet=${magnetItemCount}`
      );
      assert.ok(
        ((magnetResult as any).accessory_loot_magnet_bonus ?? 0) > 0,
        `expected accessory_loot_magnet_bonus > 0, got ${(magnetResult as any).accessory_loot_magnet_bonus}`
      );
    } finally {
      Math.random = originalRandom;
    }
  });

  it("should include ammo in drops with ammo_scavenge accessory", () => {
    // Arrange
    const input: GenerateLootInputWithAccessories = {
      tier: 3,
      accessories: [
        { name: "弹药回收器", trigger: "on_loot", effect_type: "ammo_scavenge", magnitude: 1.0 },
      ],
    };

    // Act
    const result = generateLoot(input as GenerateLootInput);

    // Assert
    const ammoItems = result.items.filter(
      (item) => item.type === "item" && /弹|ammo/i.test(item.name)
    );
    assert.ok(
      ammoItems.length > 0 || (result as any).accessory_ammo_scavenged !== undefined,
      "expected ammo item or accessory_ammo_scavenged field when ammo_scavenge triggers"
    );
  });

  it("should double loot quantities with double_loot accessory", () => {
    // Arrange
    const baseInput: GenerateLootInputWithAccessories = { tier: 3 };
    const doubleInput: GenerateLootInputWithAccessories = {
      tier: 3,
      accessories: [
        { name: "双倍幸运币", trigger: "on_loot", effect_type: "double_loot", magnitude: 1.0 },
      ],
    };

    const originalRandom = Math.random;
    // Force item drop to happen for both runs and double_loot to succeed.
    let callCount = 0;
    Math.random = () => {
      callCount++;
      // item chance roll must pass; double_loot roll must pass
      if (callCount === 1 || callCount === 3) return 0.1;
      return 0.5;
    };

    try {
      // Act
      const baseResult = generateLoot(baseInput as GenerateLootInput);
      callCount = 0;
      const doubleResult = generateLoot(doubleInput as GenerateLootInput);

      // Assert
      const baseQuantity = totalItemQuantity([baseResult]);
      const doubleQuantity = totalItemQuantity([doubleResult]);
      assert.ok(
        doubleQuantity >= baseQuantity * 2,
        `expected double_loot to at least double item quantity: base=${baseQuantity}, double=${doubleQuantity}`
      );
      assert.strictEqual((doubleResult as any).accessory_double_loot_triggered, true);
    } finally {
      Math.random = originalRandom;
    }
  });
});
