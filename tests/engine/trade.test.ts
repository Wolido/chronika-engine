import { describe, it } from "node:test";
import assert from "node:assert";
import { trade } from "../../engine/trade.ts";

interface AccessoryData {
  name: string;
  trigger: string;
  effect_type: string;
  magnitude: number;
}

interface TradeInput {
  credits: number;
  items: { item_name: string; quantity: number; price_per_unit: number }[];
  mode: "buy" | "sell";
  price_modifier?: number;
  barter?: number;
  accessories?: AccessoryData[];
}

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

  it("should reduce buy price when barter is high", () => {
    // Arrange
    const input: TradeInput = {
      credits: 100,
      items: [{ item_name: "剑", quantity: 1, price_per_unit: 30 }],
      mode: "buy",
      barter: 10,
    };

    // Act
    const result = trade(input);

    // Assert
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.total_cost, 24); // 30 × (1.0 - 10 × 0.02)
    assert.strictEqual(result.credits_before, 100);
    assert.strictEqual(result.credits_after, 76);
  });

  it("should increase sell price when barter is high", () => {
    // Arrange
    const input: TradeInput = {
      credits: 50,
      items: [{ item_name: "废铁", quantity: 1, price_per_unit: 15 }],
      mode: "sell",
      barter: 10,
    };

    // Act
    const result = trade(input);

    // Assert
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.total_cost, 18); // 15 × (1.0 + 10 × 0.02)
    assert.strictEqual(result.credits_before, 50);
    assert.strictEqual(result.credits_after, 68);
  });

  // --- 饰品传奇系统 (Cycle 2) ------------------------------------

  it("should reduce buy price when trade_discount accessory is present", () => {
    // Arrange
    const baseInput: TradeInput = {
      credits: 100,
      items: [{ item_name: "剑", quantity: 1, price_per_unit: 50 }],
      mode: "buy",
    };
    const discountInput: TradeInput = {
      credits: 100,
      items: [{ item_name: "剑", quantity: 1, price_per_unit: 50 }],
      mode: "buy",
      accessories: [{ name: "商人徽章", trigger: "on_trade", effect_type: "trade_discount", magnitude: 0.2 }],
    };

    // Act
    const baseResult = trade(baseInput);
    const discountResult = trade(discountInput);

    // Assert
    assert.strictEqual(baseResult.success, true);
    assert.strictEqual(discountResult.success, true);
    assert.ok(
      discountResult.total_cost < baseResult.total_cost,
      `expected discount total_cost (${discountResult.total_cost}) < base (${baseResult.total_cost})`
    );
    assert.ok(
      ((discountResult as any).accessory_discount ?? 0) > 0,
      `expected accessory_discount > 0, got ${(discountResult as any).accessory_discount}`
    );
  });

  it("should increase sell price when sell_bonus accessory is present", () => {
    // Arrange
    const baseInput: TradeInput = {
      credits: 50,
      items: [{ item_name: "废铁", quantity: 1, price_per_unit: 20 }],
      mode: "sell",
    };
    const bonusInput: TradeInput = {
      credits: 50,
      items: [{ item_name: "废铁", quantity: 1, price_per_unit: 20 }],
      mode: "sell",
      accessories: [{ name: "推销员戒指", trigger: "on_trade", effect_type: "sell_bonus", magnitude: 0.2 }],
    };

    // Act
    const baseResult = trade(baseInput);
    const bonusResult = trade(bonusInput);

    // Assert
    assert.strictEqual(baseResult.success, true);
    assert.strictEqual(bonusResult.success, true);
    assert.ok(
      bonusResult.total_cost > baseResult.total_cost,
      `expected sell bonus total_cost (${bonusResult.total_cost}) > base (${baseResult.total_cost})`
    );
    assert.ok(
      ((bonusResult as any).accessory_sell_bonus ?? 0) > 0,
      `expected accessory_sell_bonus > 0, got ${(bonusResult as any).accessory_sell_bonus}`
    );
  });
});
