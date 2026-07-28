import { describe, it } from "node:test";
import assert from "node:assert";
import {
  generateArmor,
  type GenerateArmorInput,
  type GeneratedArmor,
  type GenerateArmorResult,
} from "../../engine/armor-gen.ts";
import {
  ARMOR_TRIGGERS,
  ARMOR_EFFECTS,
} from "../../engine/legendary-gen.ts";

// ============================================================
// Tests
// ============================================================

describe("generateArmor", () => {
  it("should generate a common armor with no legendary_effect", () => {
    // Arrange
    const input: GenerateArmorInput = {
      min_rarity: "common",
      max_rarity: "common",
    };

    // Act
    const result: GenerateArmorResult = generateArmor(input);
    const armor = result.armor;

    // Assert
    assert.strictEqual(result.success, true);
    assert.strictEqual(armor.rarity, "common");
    assert.strictEqual(
      armor.legendary_effect,
      undefined,
      "common armor should not have a legendary_effect"
    );
    assert.ok(
      armor.name.length > 0,
      "armor name should be auto-generated"
    );
  });

  it("should generate a legendary armor with a valid legendary_effect", () => {
    // Arrange
    const input: GenerateArmorInput = {
      min_rarity: "legendary",
      max_rarity: "legendary",
    };

    // Act
    const result: GenerateArmorResult = generateArmor(input);
    const armor = result.armor;

    // Assert
    assert.strictEqual(result.success, true);
    assert.strictEqual(armor.rarity, "legendary");
    assert.ok(
      armor.legendary_effect,
      "legendary armor must have legendary_effect"
    );
    assert.strictEqual(
      armor.legendary_effect!.effect_name,
      "",
      "legendary_effect.effect_name should be empty (filled by LLM)"
    );
    assert.ok(
      typeof armor.legendary_effect!.trigger === "string" &&
        armor.legendary_effect!.trigger.length > 0,
      `legendary_effect.trigger should be non-empty, got: ${armor.legendary_effect!.trigger}`
    );
    assert.ok(
      ARMOR_TRIGGERS.includes(armor.legendary_effect!.trigger as any),
      `legendary_effect.trigger "${armor.legendary_effect!.trigger}" is not a valid armor trigger`
    );
    assert.ok(
      ARMOR_EFFECTS.includes(armor.legendary_effect!.effect_type as any),
      `legendary_effect.effect_type "${armor.legendary_effect!.effect_type}" is not a valid armor effect`
    );
    assert.ok(
      typeof armor.legendary_effect!.magnitude === "number" &&
        armor.legendary_effect!.magnitude > 0,
      `legendary_effect.magnitude should be positive, got: ${armor.legendary_effect!.magnitude}`
    );
  });

  it("should return slot === 'head' when slot is specified", () => {
    // Arrange
    const input: GenerateArmorInput = {
      slot: "head",
    };

    // Act
    const result: GenerateArmorResult = generateArmor(input);
    const armor = result.armor;

    // Assert
    assert.strictEqual(result.success, true);
    assert.strictEqual(armor.slot, "head");
  });

  it("should return a valid armor slot when slot is not specified", () => {
    // Arrange
    const validSlots = ["head", "chest", "legs"];
    const input: GenerateArmorInput = {};

    // Act & Assert
    for (let i = 0; i < 30; i++) {
      const result: GenerateArmorResult = generateArmor(input);
      const armor = result.armor;

      assert.strictEqual(result.success, true);
      assert.ok(
        validSlots.includes(armor.slot),
        `armor.slot "${armor.slot}" should be one of ${validSlots.join(", ")}`
      );
    }
  });

  it("should generate legendary head armor with defense in [26, 38]", () => {
    // Arrange
    const input: GenerateArmorInput = {
      slot: "head",
      min_rarity: "legendary",
      max_rarity: "legendary",
    };

    // Act
    const result: GenerateArmorResult = generateArmor(input);
    const armor = result.armor;

    // Assert
    assert.strictEqual(result.success, true);
    assert.strictEqual(armor.rarity, "legendary");
    assert.strictEqual(armor.slot, "head");
    assert.ok(
      armor.defense >= 26 && armor.defense <= 38,
      `legendary armor defense (${armor.defense}) should be in [26, 38]`
    );
  });

  it("should warn about dodge trigger on heavy armor (defense > 20)", () => {
    // Arrange
    const input: GenerateArmorInput = {
      min_rarity: "legendary",
      max_rarity: "legendary",
    };

    // Act: search for a generated legendary armor with on_dodged trigger
    let found: GenerateArmorResult | undefined;
    for (let i = 0; i < 300; i++) {
      const result: GenerateArmorResult = generateArmor(input);
      if (result.armor.legendary_effect?.trigger === "on_dodged") {
        found = result;
        break;
      }
    }

    // Assert
    assert.ok(
      found,
      "should be able to generate a legendary armor with on_dodged trigger"
    );
    assert.ok(
      found!.armor.defense > 20,
      `heavy armor should have defense > 20, got ${found!.armor.defense}`
    );
    assert.ok(
      Array.isArray(found!.appropriateness_warnings) &&
        found!.appropriateness_warnings!.length > 0,
      "on_dodged heavy armor should produce appropriateness_warnings"
    );
    assert.ok(
      found!.appropriateness_warnings!.some(
        (w) => w.includes("闪避") || w.toLowerCase().includes("dodge")
      ),
      `expected dodge-related warning, got: ${JSON.stringify(
        found!.appropriateness_warnings
      )}`
    );
  });

  it("should throw when min_rarity is invalid", () => {
    // Arrange
    const input: GenerateArmorInput = {
      min_rarity: "epic",
      max_rarity: "legendary",
    };

    // Act & Assert
    assert.throws(
      () => generateArmor(input),
      /Invalid min_rarity/
    );
  });
});
