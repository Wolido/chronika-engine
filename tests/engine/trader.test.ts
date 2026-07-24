import { describe, it } from "node:test";
import assert from "node:assert";
import { generateStock, type GenerateStockInput, type GenerateStockResult, type StockItem } from "../../engine/trader.ts";

// ============================================================
// Tests
// ============================================================

describe("generateStock", () => {
  // --- Test 1: villager 生成 1-3 件物品 --------------------------

  it("should generate 1 to 3 items for a villager over 10 runs", () => {
    for (let i = 0; i < 10; i++) {
      // Arrange
      const input: GenerateStockInput = {
        type: "villager",
        db: null,
      };

      // Act
      const result = generateStock(input);

      // Assert
      assert.ok(
        result.items.length >= 1 && result.items.length <= 3,
        `run ${i}: items.length ${result.items.length} out of range [1, 3]`,
      );
    }
  });

  // --- Test 2: merchant 生成的物品比 villager 多 ------------------

  it("should generate more items on average for merchant than villager over 10 runs", () => {
    // Arrange
    const db = null;

    // Act — villager
    let villagerTotal = 0;
    for (let i = 0; i < 10; i++) {
      villagerTotal += generateStock({ type: "villager", db }).items.length;
    }
    const villagerAvg = villagerTotal / 10;

    // Act — merchant
    let merchantTotal = 0;
    for (let i = 0; i < 10; i++) {
      merchantTotal += generateStock({ type: "merchant", db }).items.length;
    }
    const merchantAvg = merchantTotal / 10;

    // Assert
    assert.ok(
      merchantAvg > villagerAvg,
      `merchant avg ${merchantAvg} should exceed villager avg ${villagerAvg}`,
    );
  });

  // --- Test 3: 每个 item 都有正数的 quantity 和 price -------------

  it("should produce items with positive quantity and price_per_unit", () => {
    // Arrange
    const input: GenerateStockInput = {
      type: "villager",
      db: null,
    };

    // Act
    const result = generateStock(input);

    // Assert
    assert.ok(result.items.length > 0, "should have at least one item");
    for (const item of result.items) {
      assert.ok(
        item.quantity > 0,
        `item "${item.name}" quantity ${item.quantity} should be > 0`,
      );
      assert.ok(
        item.price_per_unit > 0,
        `item "${item.name}" price_per_unit ${item.price_per_unit} should be > 0`,
      );
    }
  });

  // --- Test 4: 生成结果有 credits ---------------------------------

  it("should produce positive credits", () => {
    // Arrange
    const input: GenerateStockInput = {
      type: "villager",
      db: null,
    };

    // Act
    const result = generateStock(input);

    // Assert
    assert.ok(
      result.credits > 0,
      `credits ${result.credits} should be > 0`,
    );
  });
});
