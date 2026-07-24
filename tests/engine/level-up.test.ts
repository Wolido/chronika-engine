import { describe, it } from "node:test";
import assert from "node:assert";
import { levelUp } from "../../engine/level-up.ts";

describe("levelUp", () => {
  it("should level up with remaining XP when XP exceeds requirement", () => {
    const result = levelUp({ level: 1, xp: 150 });

    assert.strictEqual(result.leveled_up, true);
    assert.strictEqual(result.new_level, 2);
    assert.strictEqual(result.xp_remaining, 50);
    assert.strictEqual(result.xp_for_next, 200); // level 2 × 100
    assert.strictEqual(result.attribute_points_gained, 1);
    assert.strictEqual(result.total_attribute_points, 1);
  });

  it("should level up with zero remaining XP when XP exactly meets requirement", () => {
    const result = levelUp({ level: 1, xp: 100 });

    assert.strictEqual(result.leveled_up, true);
    assert.strictEqual(result.new_level, 2);
    assert.strictEqual(result.xp_remaining, 0);
    assert.strictEqual(result.xp_for_next, 200); // level 2 × 100
    assert.strictEqual(result.attribute_points_gained, 1);
    assert.strictEqual(result.total_attribute_points, 1);
  });

  it("should not level up when XP is insufficient", () => {
    const result = levelUp({ level: 2, xp: 150 });

    assert.strictEqual(result.leveled_up, false);
    assert.strictEqual(result.new_level, 2);
    assert.strictEqual(result.xp_remaining, 150);
    assert.strictEqual(result.xp_for_next, 200); // level 2 × 100
    assert.strictEqual(result.attribute_points_gained, 0);
    assert.strictEqual(result.total_attribute_points, 0);
  });

  it("should level up multiple times consecutively until XP is insufficient", () => {
    // level 1→2: 100 XP, level 2→3: 200 XP, level 3→4: 300 XP
    // 500 - 100 = 400 (level 2), 400 - 200 = 200 (level 3), 200 < 300 → stop
    const result = levelUp({ level: 1, xp: 500 });

    assert.strictEqual(result.leveled_up, true);
    assert.strictEqual(result.new_level, 3);
    assert.strictEqual(result.xp_remaining, 200);
    assert.strictEqual(result.xp_for_next, 300); // level 3 × 100
    assert.strictEqual(result.attribute_points_gained, 2); // 2 levels × 1 point
    assert.strictEqual(result.total_attribute_points, 2);
  });

  it("should use custom xp_for_next when provided, doubling each level", () => {
    // custom xp_for_next=400 per level, level 1→2: 400, next: 2×400=800
    const result = levelUp({ level: 1, xp: 500, xp_for_next: 400 });

    assert.strictEqual(result.leveled_up, true);
    assert.strictEqual(result.new_level, 2);
    assert.strictEqual(result.xp_remaining, 100);
    assert.strictEqual(result.xp_for_next, 800); // level 2 × 400
    assert.strictEqual(result.attribute_points_gained, 1);
    assert.strictEqual(result.total_attribute_points, 1);
  });

  it("should gain attribute and skill points when leveling up", () => {
    // Arrange
    const input = { level: 1, xp: 150 };

    // Act
    const result = levelUp(input);

    // Assert
    assert.strictEqual(result.leveled_up, true);
    assert.strictEqual(result.new_level, 2);
    assert.strictEqual(result.xp_remaining, 50);
    assert.strictEqual(result.xp_for_next, 200);
    assert.strictEqual(result.attribute_points_gained, 1);
    assert.strictEqual(result.total_attribute_points, 1);
    assert.strictEqual(result.skill_points_gained, 3);
    assert.strictEqual(result.total_skill_points, 3);
  });

  it("should use default attribute_points=1 and skill_points=3 when not provided", () => {
    // Arrange
    const input = { level: 1, xp: 150 };

    // Act
    const result = levelUp(input);

    // Assert
    assert.strictEqual(result.attribute_points_gained, 1);
    assert.strictEqual(result.total_attribute_points, 1);
    assert.strictEqual(result.skill_points_gained, 3);
    assert.strictEqual(result.total_skill_points, 3);
  });

  it("should accumulate attribute and skill points across multiple level-ups", () => {
    // Arrange
    // level 1→2: 100, 2→3: 200, 3→4: 300; total 600 XP for 3 levels
    const input = { level: 1, xp: 600 };

    // Act
    const result = levelUp(input);

    // Assert
    assert.strictEqual(result.leveled_up, true);
    assert.strictEqual(result.new_level, 4);
    assert.strictEqual(result.xp_remaining, 0);
    assert.strictEqual(result.xp_for_next, 400);
    assert.strictEqual(result.attribute_points_gained, 3);
    assert.strictEqual(result.total_attribute_points, 3);
    assert.strictEqual(result.skill_points_gained, 9);
    assert.strictEqual(result.total_skill_points, 9);
  });

  it("should support custom attribute and skill point rates", () => {
    // Arrange
    const input = { level: 1, xp: 300, attribute_points: 2, skill_points: 5 };

    // Act
    const result = levelUp(input);

    // Assert
    assert.strictEqual(result.leveled_up, true);
    assert.strictEqual(result.new_level, 3);
    assert.strictEqual(result.xp_remaining, 0);
    assert.strictEqual(result.xp_for_next, 300);
    assert.strictEqual(result.attribute_points_gained, 4);
    assert.strictEqual(result.total_attribute_points, 4);
    assert.strictEqual(result.skill_points_gained, 10);
    assert.strictEqual(result.total_skill_points, 10);
  });
});
