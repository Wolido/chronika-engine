import { describe, it } from "node:test";
import assert from "node:assert";
import { craftItem, type CraftRecipe, type InventoryItem } from "../../engine/craft.ts";

interface CraftInput {
  recipe: CraftRecipe;
  inventory: InventoryItem[];
  mechanics?: number;
}

// ============================================================
// Tests
// ============================================================

describe("craftItem", () => {
  it("should succeed and consume materials to produce result when all ingredients are available", () => {
    const recipe: CraftRecipe = {
      result_item: "简易护甲",
      result_quantity: 1,
      ingredients: [
        { item_name: "废铁", quantity: 2 },
        { item_name: "布料", quantity: 1 },
      ],
    };

    const inventory: InventoryItem[] = [
      { item_name: "废铁", quantity: 5 },
      { item_name: "布料", quantity: 3 },
    ];

    const result = craftItem({ recipe, inventory });

    assert.strictEqual(result.success, true);
    assert.deepStrictEqual(
      result.items_consumed,
      [
        { item_name: "废铁", quantity: 2 },
        { item_name: "布料", quantity: 1 },
      ],
    );
    assert.deepStrictEqual(
      result.items_produced,
      [{ item_name: "简易护甲", quantity: 1 }],
    );
    assert.strictEqual(result.missing_ingredients, undefined);
  });

  it("should fail and report missing ingredients when materials are insufficient", () => {
    const recipe: CraftRecipe = {
      result_item: "铁管",
      result_quantity: 1,
      ingredients: [
        { item_name: "废铁", quantity: 3 },
        { item_name: "螺栓", quantity: 2 },
      ],
    };

    const inventory: InventoryItem[] = [
      { item_name: "废铁", quantity: 1 },
      { item_name: "螺栓", quantity: 0 },
    ];

    const result = craftItem({ recipe, inventory });

    assert.strictEqual(result.success, false);
    assert.deepStrictEqual(
      result.missing_ingredients,
      [
        { item_name: "废铁", needed: 3, have: 1 },
        { item_name: "螺栓", needed: 2, have: 0 },
      ],
    );
    assert.strictEqual(result.items_consumed, undefined);
    assert.strictEqual(result.items_produced, undefined);
  });

  it("should succeed when materials are exactly sufficient (consumed quantity equals inventory)", () => {
    const recipe: CraftRecipe = {
      result_item: "绷带",
      result_quantity: 1,
      ingredients: [
        { item_name: "布料", quantity: 1 },
      ],
    };

    const inventory: InventoryItem[] = [
      { item_name: "布料", quantity: 1 },
    ];

    const result = craftItem({ recipe, inventory });

    assert.strictEqual(result.success, true);
    assert.deepStrictEqual(
      result.items_consumed,
      [{ item_name: "布料", quantity: 1 }],
    );
    assert.deepStrictEqual(
      result.items_produced,
      [{ item_name: "绷带", quantity: 1 }],
    );
  });

  it("should report all missing ingredients when multiple materials are partially insufficient", () => {
    const recipe: CraftRecipe = {
      result_item: "X",
      result_quantity: 1,
      ingredients: [
        { item_name: "A", quantity: 5 },
        { item_name: "B", quantity: 3 },
        { item_name: "C", quantity: 2 },
      ],
    };

    const inventory: InventoryItem[] = [
      { item_name: "A", quantity: 3 },
    ];

    const result = craftItem({ recipe, inventory });

    assert.strictEqual(result.success, false);

    const missing = result.missing_ingredients!;
    assert.ok(missing, "expected missing_ingredients to be present");

    const missingB = missing.find(m => m.item_name === "B");
    assert.ok(missingB, "should report B as missing");
    assert.strictEqual(missingB!.needed, 3);
    assert.strictEqual(missingB!.have, 0);

    const missingC = missing.find(m => m.item_name === "C");
    assert.ok(missingC, "should report C as missing");
    assert.strictEqual(missingC!.needed, 2);
    assert.strictEqual(missingC!.have, 0);
  });

  it("should report all ingredients as missing when inventory is empty", () => {
    const recipe: CraftRecipe = {
      result_item: "铁管",
      result_quantity: 1,
      ingredients: [
        { item_name: "废铁", quantity: 3 },
        { item_name: "螺栓", quantity: 2 },
      ],
    };

    const inventory: InventoryItem[] = [];

    const result = craftItem({ recipe, inventory });

    assert.strictEqual(result.success, false);
    assert.deepStrictEqual(
      result.missing_ingredients,
      [
        { item_name: "废铁", needed: 3, have: 0 },
        { item_name: "螺栓", needed: 2, have: 0 },
      ],
    );
  });

  it("should increase result quantity when mechanics skill is high without changing material cost", () => {
    // Arrange
    const recipe: CraftRecipe = {
      result_item: "简易零件",
      result_quantity: 1,
      ingredients: [{ item_name: "废铁", quantity: 2 }],
    };
    const inventory: InventoryItem[] = [{ item_name: "废铁", quantity: 10 }];
    const input: CraftInput = { recipe, inventory, mechanics: 10 };

    // Act
    const result = craftItem(input);

    // Assert
    assert.strictEqual(result.success, true);
    assert.deepStrictEqual(
      result.items_consumed,
      [{ item_name: "废铁", quantity: 2 }],
    );
    assert.deepStrictEqual(
      result.items_produced,
      [{ item_name: "简易零件", quantity: 3 }],
    );
  });
});
