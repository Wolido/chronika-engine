import { describe, it } from "node:test";
import assert from "node:assert";
import {
  generateAccessory,
  type GenerateAccessoryInput,
  type GeneratedAccessory,
  type GenerateAccessoryResult,
} from "../../engine/accessory-gen.ts";
import {
  ACCESSORY_TRIGGERS,
  ACCESSORY_EFFECTS,
} from "../../engine/legendary-gen.ts";

// ============================================================
// Tests
// ============================================================

describe("generateAccessory", () => {
  it("should generate a common accessory with no legendary_effect", () => {
    // Arrange
    const input: GenerateAccessoryInput = {
      min_rarity: "common",
      max_rarity: "common",
    };

    // Act
    const result: GenerateAccessoryResult = generateAccessory(input);
    const accessory = result.accessory;

    // Assert
    assert.strictEqual(result.success, true);
    assert.strictEqual(accessory.rarity, "common");
    assert.strictEqual(
      accessory.legendary_effect,
      undefined,
      "common accessory should not have a legendary_effect"
    );
    assert.ok(
      accessory.name.length > 0,
      "accessory name should be auto-generated"
    );
  });

  it("should generate a legendary accessory with a valid legendary_effect", () => {
    // Arrange
    const input: GenerateAccessoryInput = {
      min_rarity: "legendary",
      max_rarity: "legendary",
    };

    // Act
    const result: GenerateAccessoryResult = generateAccessory(input);
    const accessory = result.accessory;

    // Assert
    assert.strictEqual(result.success, true);
    assert.strictEqual(accessory.rarity, "legendary");
    assert.ok(
      accessory.legendary_effect,
      "legendary accessory must have legendary_effect"
    );
    assert.strictEqual(
      accessory.legendary_effect!.effect_name,
      "",
      "legendary_effect.effect_name should be empty (filled by LLM)"
    );
    assert.ok(
      typeof accessory.legendary_effect!.trigger === "string" &&
        accessory.legendary_effect!.trigger.length > 0,
      `legendary_effect.trigger should be non-empty, got: ${accessory.legendary_effect!.trigger}`
    );
    assert.ok(
      ACCESSORY_TRIGGERS.includes(accessory.legendary_effect!.trigger as any),
      `legendary_effect.trigger "${accessory.legendary_effect!.trigger}" is not a valid accessory trigger`
    );
    assert.ok(
      ACCESSORY_EFFECTS.includes(accessory.legendary_effect!.effect_type as any),
      `legendary_effect.effect_type "${accessory.legendary_effect!.effect_type}" is not a valid accessory effect`
    );
    assert.ok(
      typeof accessory.legendary_effect!.magnitude === "number" &&
        accessory.legendary_effect!.magnitude > 0,
      `legendary_effect.magnitude should be positive, got: ${accessory.legendary_effect!.magnitude}`
    );
  });

  it("should return accessory_type === 'ring' when accessory_type is specified", () => {
    // Arrange
    const input: GenerateAccessoryInput = {
      accessory_type: "ring",
    };

    // Act
    const result: GenerateAccessoryResult = generateAccessory(input);
    const accessory = result.accessory;

    // Assert
    assert.strictEqual(result.success, true);
    assert.strictEqual(accessory.accessory_type, "ring");
  });

  it("should return a valid accessory type when type is not specified", () => {
    // Arrange
    const validTypes = ["ring", "amulet", "trinket", "charm"];
    const input: GenerateAccessoryInput = {};

    // Act & Assert
    for (let i = 0; i < 30; i++) {
      const result: GenerateAccessoryResult = generateAccessory(input);
      const accessory = result.accessory;

      assert.strictEqual(result.success, true);
      assert.ok(
        validTypes.includes(accessory.accessory_type),
        `accessory_type "${accessory.accessory_type}" should be one of ${validTypes.join(", ")}`
      );
    }
  });

  it("should throw when min_rarity is invalid", () => {
    // Arrange
    const input: GenerateAccessoryInput = {
      min_rarity: "epic",
      max_rarity: "legendary",
    };

    // Act & Assert
    assert.throws(
      () => generateAccessory(input),
      /Invalid min_rarity/
    );
  });
});
