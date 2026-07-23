import { describe, it } from "node:test";
import assert from "node:assert";
import { consumeItem } from "../../engine/consume.ts";

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
});
