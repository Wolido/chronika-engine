import { describe, it } from "node:test";
import assert from "node:assert";
import {
  generateWeapon,
  type GenerateWeaponInput,
  type GeneratedWeapon,
  type GenerateWeaponResult,
} from "../../engine/weapon-gen.ts";

// ============================================================
// Extended type for ranged-specific checks
// ============================================================

interface ExtendedWeapon extends GeneratedWeapon {
  range_min?: number;
  range_max?: number;
  ammo_type?: string;
}

// ============================================================
// Tests
// ============================================================

describe("generateWeapon", () => {
  it("should generate a common weapon with valid core stats and no element or legendary effect", () => {
    // Arrange
    const input: GenerateWeaponInput = {
      min_rarity: "common",
      max_rarity: "common",
    };

    // Act
    const result: GenerateWeaponResult = generateWeapon(input);
    const weapon = result.weapon;

    // Assert
    assert.strictEqual(result.success, true);
    assert.strictEqual(weapon.rarity, "common");
    assert.ok(
      weapon.damage_min <= weapon.damage_max,
      `damage_min (${weapon.damage_min}) should be ≤ damage_max (${weapon.damage_max})`
    );
    assert.ok(
      weapon.accuracy >= 0.0 && weapon.accuracy <= 1.0,
      `accuracy (${weapon.accuracy}) should be in [0.0, 1.0]`
    );
    assert.strictEqual(
      weapon.element,
      undefined,
      "common weapon should not have an element"
    );
    assert.strictEqual(
      weapon.legendary_effect,
      undefined,
      "common weapon should not have a legendary_effect"
    );
  });

  it("should generate a legendary weapon with a legendary_effect", () => {
    // Arrange
    const input: GenerateWeaponInput = {
      min_rarity: "legendary",
      max_rarity: "legendary",
    };

    // Act
    const result: GenerateWeaponResult = generateWeapon(input);
    const weapon = result.weapon;

    // Assert
    assert.strictEqual(result.success, true);
    assert.strictEqual(weapon.rarity, "legendary");
    assert.ok(
      weapon.legendary_effect,
      "legendary weapon must have legendary_effect"
    );
    assert.ok(
      typeof weapon.legendary_effect!.effect_name === "string" &&
        weapon.legendary_effect!.effect_name.length > 0,
      `legendary_effect.effect_name should be non-empty, got: ${weapon.legendary_effect!.effect_name}`
    );
  });

  it("should generate a melee weapon without ranged fields", () => {
    // Arrange
    const input: GenerateWeaponInput = {
      weapon_type: "melee",
    };

    // Act
    const result: GenerateWeaponResult = generateWeapon(input);
    const weapon = result.weapon as ExtendedWeapon;

    // Assert
    assert.strictEqual(result.success, true);
    assert.strictEqual(weapon.category, "melee");
    assert.strictEqual(
      weapon.range_min,
      undefined,
      "melee weapon should not have range_min"
    );
    assert.strictEqual(
      weapon.range_max,
      undefined,
      "melee weapon should not have range_max"
    );
    assert.strictEqual(
      weapon.ammo_type,
      undefined,
      "melee weapon should not have ammo_type"
    );
  });

  it("should generate a ranged weapon with range_min, range_max and ammo_type", () => {
    // Arrange
    const input: GenerateWeaponInput = {
      weapon_type: "ranged",
    };

    // Act
    const result: GenerateWeaponResult = generateWeapon(input);
    const weapon = result.weapon as ExtendedWeapon;

    // Assert
    assert.strictEqual(result.success, true);
    assert.strictEqual(weapon.category, "ranged");
    assert.ok(
      typeof weapon.range_min === "number",
      "ranged weapon should have range_min"
    );
    assert.ok(
      typeof weapon.range_max === "number",
      "ranged weapon should have range_max"
    );
    assert.ok(
      typeof weapon.ammo_type === "string" && weapon.ammo_type.length > 0,
      `ranged weapon should have a non-empty ammo_type, got: ${weapon.ammo_type}`
    );
  });
});
