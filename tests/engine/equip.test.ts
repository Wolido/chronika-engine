import { describe, it } from "node:test";
import assert from "node:assert";
import { equipItem, unequipItem, calculateEquipmentStats } from "../../engine/equip.ts";
import type { EquipInput, UnequipInput, Equipment, EquippedItem } from "../../engine/equip.ts";

function emptyEquip(): Equipment { return {}; }

function makeItem(overrides: Partial<EquippedItem> = {}): EquippedItem {
  return { name: "test", item_type: "armor", ...overrides };
}

describe("equipItem", () => {
  it("should equip to empty slot and return stat_changes", () => {
    const result = equipItem({ slot: "head", item: makeItem({ name: "铁头盔", armor_slot: "head", defense: 5, stat_bonuses: { strength: 1 } }), current_equipment: emptyEquip() });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.item_equipped, "铁头盔");
    assert.strictEqual(result.stat_changes.defense, 5);
    assert.strictEqual(result.stat_changes.strength, 1);
  });

  it("should replace existing equipment and return removed item name with diff stats", () => {
    const current = { chest: makeItem({ name: "皮甲", armor_slot: "chest", defense: 3 }) } as Equipment;
    const result = equipItem({ slot: "chest", item: makeItem({ name: "钢甲", armor_slot: "chest", defense: 10 }), current_equipment: current });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.item_removed, "皮甲");
    assert.strictEqual(result.stat_changes.defense, 7);
  });

  it("should equip accessory to empty accessory1 slot", () => {
    const result = equipItem({ slot: "accessory1", item: makeItem({ name: "幸运符", item_type: "accessory", stat_bonuses: { luck: 2, perception: 1 } }), current_equipment: emptyEquip() });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.stat_changes.luck, 2);
    assert.strictEqual(result.stat_changes.perception, 1);
  });

  it("should reject armor with mismatched armor_slot", () => {
    const result = equipItem({ slot: "head", item: makeItem({ name: "腿甲", armor_slot: "legs", defense: 8 }), current_equipment: emptyEquip() });
    assert.strictEqual(result.success, false);
    assert.ok(result.error ? result.error.includes("armor_slot") || result.error.includes("match") : false);
  });

  it("should equip weapon without stat_bonuses successfully", () => {
    const result = equipItem({ slot: "weapon", item: { name: "铁管", item_type: "weapon" }, current_equipment: emptyEquip() });
    assert.strictEqual(result.success, true);
    assert.deepStrictEqual(result.stat_changes, {});
  });
});

describe("unequipItem", () => {
  it("should unequip from occupied slot and return negative stat_changes", () => {
    const current = { head: makeItem({ name: "铁头盔", armor_slot: "head", defense: 5, stat_bonuses: { strength: 1 } }) } as Equipment;
    const result = unequipItem({ slot: "head", current_equipment: current });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.item_removed, "铁头盔");
    assert.strictEqual(result.stat_changes.defense, -5);
    assert.strictEqual(result.stat_changes.strength, -1);
  });

  it("should fail when unequipping from empty slot", () => {
    const result = unequipItem({ slot: "accessory1", current_equipment: emptyEquip() });
    assert.strictEqual(result.success, false);
    assert.ok(result.error ? result.error.includes("Nothing") || result.error.includes("empty") : false);
  });

  it("should calculate negative defense correctly on unequip", () => {
    const current = { chest: makeItem({ name: "钢甲", armor_slot: "chest", defense: 10 }) } as Equipment;
    const result = unequipItem({ slot: "chest", current_equipment: current });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.stat_changes.defense, -10);
  });
});

describe("calculateEquipmentStats", () => {
  it("should sum defense and stat bonuses from multiple items", () => {
    const equip = {
      head: makeItem({ name: "铁头盔", armor_slot: "head", defense: 5 }),
      chest: makeItem({ name: "皮甲", armor_slot: "chest", defense: 3, stat_bonuses: { agility: 2 } }),
    } as Equipment;
    const result = calculateEquipmentStats(equip);
    assert.strictEqual(result.total_defense, 8);
    assert.strictEqual(result.stat_bonuses.agility, 2);
    assert.strictEqual(result.equipped_items.length, 2);
  });

  it("should return zeros for empty equipment", () => {
    const result = calculateEquipmentStats(emptyEquip());
    assert.strictEqual(result.total_defense, 0);
    assert.deepStrictEqual(result.stat_bonuses, {});
    assert.strictEqual(result.equipped_items.length, 0);
  });
});
