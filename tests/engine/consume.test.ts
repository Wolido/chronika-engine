import { describe, it } from "node:test";
import assert from "node:assert";
import { consumeItem } from "../../engine/consume.ts";

interface AccessoryData {
  name: string;
  trigger: string;
  effect_type: string;
  magnitude: number;
}

interface ConsumeInput {
  item: {
    name: string;
    effect_type: string;
    effect_value: number;
  };
  target: {
    hp: number;
    hp_max: number;
  };
  medicine?: number;
  accessories?: AccessoryData[];
}

describe("consumeItem", () => {
  it("should heal by effect_value when effect_type is 'heal'", () => {
    const result = consumeItem({
      item: { name: "治疗粉", effect_type: "heal", effect_value: 15 },
      target: { hp: 20, hp_max: 40 },
    });
    assert.strictEqual(result.hp_before, 20);
    assert.strictEqual(result.hp_after, 35);
    assert.strictEqual(result.hp_change, 15);
    assert.strictEqual(result.effect_type, "heal");
  });

  it("should not overheal beyond hp_max", () => {
    const result = consumeItem({
      item: { name: "大治疗粉", effect_type: "heal", effect_value: 50 },
      target: { hp: 35, hp_max: 40 },
    });
    assert.strictEqual(result.hp_after, 40);
    assert.strictEqual(result.hp_change, 5);
  });

  it("should deal damage when effect_type is 'damage'", () => {
    const result = consumeItem({
      item: { name: "毒药", effect_type: "damage", effect_value: 10 },
      target: { hp: 30, hp_max: 30 },
    });
    assert.strictEqual(result.hp_after, 20);
    assert.strictEqual(result.hp_change, -10);
  });

  it("should not reduce HP below 0", () => {
    const result = consumeItem({
      item: { name: "剧毒", effect_type: "damage", effect_value: 100 },
      target: { hp: 25, hp_max: 30 },
    });
    assert.strictEqual(result.hp_after, 0);
  });

  it("should restore to full HP when effect_type is 'restore'", () => {
    const result = consumeItem({
      item: { name: "全愈药", effect_type: "restore", effect_value: 0 },
      target: { hp: 10, hp_max: 40 },
    });
    assert.strictEqual(result.hp_after, 40);
  });

  it("should increase heal amount when medicine skill is high", () => {
    // Arrange
    const input: ConsumeInput = {
      item: { name: "治疗粉", effect_type: "heal", effect_value: 20 },
      target: { hp: 10, hp_max: 50 },
      medicine: 10,
    };

    // Act
    const result = consumeItem(input);

    // Assert
    assert.strictEqual(result.hp_before, 10);
    assert.strictEqual(result.hp_after, 45);
    assert.strictEqual(result.hp_change, 35);
    assert.strictEqual(result.effect_type, "heal");
  });

  // --- 饰品传奇系统 (Cycle 2) ------------------------------------

  it("should increase heal amount when healing_boost accessory is present", () => {
    // Arrange
    const baseInput: ConsumeInput = {
      item: { name: "治疗粉", effect_type: "heal", effect_value: 20 },
      target: { hp: 10, hp_max: 50 },
    };
    const boostInput: ConsumeInput = {
      item: { name: "治疗粉", effect_type: "heal", effect_value: 20 },
      target: { hp: 10, hp_max: 50 },
      accessories: [{ name: "疗愈吊坠", trigger: "on_heal", effect_type: "healing_boost", magnitude: 0.3 }],
    };

    // Act
    const baseResult = consumeItem(baseInput);
    const boostResult = consumeItem(boostInput);

    // Assert
    assert.ok(
      boostResult.hp_change > baseResult.hp_change,
      `expected healing_boost to increase heal: base=${baseResult.hp_change}, boost=${boostResult.hp_change}`
    );
    assert.ok(
      ((boostResult as any).accessory_heal_bonus ?? 0) > 0,
      `expected accessory_heal_bonus > 0, got ${(boostResult as any).accessory_heal_bonus}`
    );
  });

  it("should double heal effect when item_efficiency accessory triggers", () => {
    // Arrange
    const input: ConsumeInput = {
      item: { name: "治疗粉", effect_type: "heal", effect_value: 15 },
      target: { hp: 10, hp_max: 50 },
      accessories: [{ name: "增效针剂", trigger: "on_heal", effect_type: "item_efficiency", magnitude: 1.0 }],
    };

    // Force item_efficiency to trigger.
    const originalRandom = Math.random;
    Math.random = () => 0.1;

    try {
      // Act
      const result = consumeItem(input);

      // Assert
      assert.strictEqual(result.hp_change, 30);
      assert.strictEqual((result as any).accessory_double_effect, true);
    } finally {
      Math.random = originalRandom;
    }
  });
});
