import { describe, it } from "node:test";
import assert from "node:assert";
import { trade } from "../../engine/trade.ts";

describe("trade", () => {

  // --- 买：钱够 -------------------------------------------------

  it("should succeed when buying with enough credits", () => {
    // Arrange
    const input: TradeInput = {
      credits: 100,
      items: [{ item_name: "剑", quantity: 1, price_per_unit: 30 }],
      mode: "buy",
    };

    // Act
    const result = trade(input);

    // Assert
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.total_cost, 30);
    assert.strictEqual(result.credits_before, 100);
    assert.strictEqual(result.credits_after, 70);
    assert.deepStrictEqual(result.items_traded, [
      { item_name: "剑", quantity: 1 },
    ]);
  });

  // --- 买：钱不够 -----------------------------------------------

  it("should fail when buying with insufficient credits", () => {
    // Arrange
    const input: TradeInput = {
      credits: 20,
      items: [{ item_name: "剑", quantity: 1, price_per_unit: 30 }],
      mode: "buy",
    };

    // Act
    const result = trade(input);

    // Assert
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.total_cost, 30);
    assert.strictEqual(result.credits_before, 20);
    assert.strictEqual(result.credits_after, 20);
    assert.deepStrictEqual(result.items_traded, []);
    assert.ok(result.reason !== undefined, "should include a failure reason");
  });

  // --- 买：多物品 -----------------------------------------------

  it("should calculate total correctly when buying multiple items", () => {
    // Arrange
    const input: TradeInput = {
      credits: 100,
      items: [
        { item_name: "剑", quantity: 1, price_per_unit: 30 },
        { item_name: "盾", quantity: 1, price_per_unit: 25 },
      ],
      mode: "buy",
    };

    // Act
    const result = trade(input);

    // Assert
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.total_cost, 55);
    assert.strictEqual(result.credits_before, 100);
    assert.strictEqual(result.credits_after, 45);
    assert.deepStrictEqual(result.items_traded, [
      { item_name: "剑", quantity: 1 },
      { item_name: "盾", quantity: 1 },
    ]);
  });

  // --- 卖：正常 -------------------------------------------------

  it("should succeed when selling items and gain credits", () => {
    // Arrange
    const input: TradeInput = {
      credits: 50,
      items: [{ item_name: "废铁", quantity: 5, price_per_unit: 3 }],
      mode: "sell",
    };

    // Act
    const result = trade(input);

    // Assert
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.total_cost, 15);
    assert.strictEqual(result.credits_before, 50);
    assert.strictEqual(result.credits_after, 65);
    assert.deepStrictEqual(result.items_traded, [
      { item_name: "废铁", quantity: 5 },
    ]);
  });

  // --- 价格修正：八折 -------------------------------------------

  it("should apply 20% discount when price_modifier is 0.8", () => {
    // Arrange
    const input: TradeInput = {
      credits: 100,
      items: [{ item_name: "剑", quantity: 1, price_per_unit: 30 }],
      mode: "buy",
      price_modifier: 0.8,
    };

    // Act
    const result = trade(input);

    // Assert
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.total_cost, 24); // 30 × 0.8
    assert.strictEqual(result.credits_before, 100);
    assert.strictEqual(result.credits_after, 76);
  });

});
