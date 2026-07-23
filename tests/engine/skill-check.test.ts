import { describe, it } from "node:test";
import assert from "node:assert";
import { skillCheck } from "../../engine/skill-check.ts";

// ============================================================
// Tests
// ============================================================

describe("skillCheck", () => {

  describe("basic behavior", () => {

    it("should achieve ~50% success rate over 1000 runs with modifier=0, difficulty=11", () => {
      const N = 1000;
      let successes = 0;

      for (let i = 0; i < N; i++) {
        const result = skillCheck({ difficulty: 11, modifier: 0 });
        successes += result.success ? 1 : 0;
      }

      // 期望 50% ± 10%（即 400-600）
      assert.ok(
        successes >= 400 && successes <= 600,
        `Expected 400–600 successes out of ${N}, got ${successes}`
      );
    });

    it("should produce roll in [1,20] and total = roll + modifier when modifier=5, difficulty=10", () => {
      // 跑多次以确保每次结果都在合法范围内
      for (let i = 0; i < 100; i++) {
        const result = skillCheck({ difficulty: 10, modifier: 5 });

        assert.ok(result.roll >= 1 && result.roll <= 20,
          `roll ${result.roll} out of [1,20]`);
        assert.strictEqual(result.total, result.roll + 5,
          `total ${result.total} != roll ${result.roll} + 5`);
        assert.strictEqual(result.difficulty, 10);
      }
    });

    it("should treat undefined modifier as 0", () => {
      // modifier=0 与无 modifier 应行为一致
      for (let i = 0; i < 100; i++) {
        const withZero = skillCheck({ difficulty: 10, modifier: 0 });
        const withUndefined = skillCheck({ difficulty: 10 });

        // 两者结果结构一致（具体数值可能不同因为随机）
        assert.strictEqual(typeof withUndefined.success, "boolean");
        assert.ok(withUndefined.roll >= 1 && withUndefined.roll <= 20);
        assert.strictEqual(withUndefined.total, withUndefined.roll); // modifier=0 => total = roll
        assert.strictEqual(withUndefined.difficulty, 10);
        assert.strictEqual(typeof withUndefined.margin, "number");
        assert.strictEqual(typeof withUndefined.critical, "boolean");

        // 验证：modifier=0 时 total = roll，undef modifier 同理
        assert.strictEqual(withZero.total, withZero.roll + 0);
      }
    });
  });

  describe("deterministic results", () => {

    it("should always succeed when modifier=10, difficulty=5 (even roll=1 wins)", () => {
      // modifier + min roll = 10 + 1 = 11 ≥ 5 → 100% 成功率
      for (let i = 0; i < 100; i++) {
        const result = skillCheck({ difficulty: 5, modifier: 10 });
        assert.ok(result.success,
          `Expected success but got failure: roll=${result.roll}, total=${result.total}`);
      }
    });

    it("should always fail when modifier=-5, difficulty=20 (even roll=20 loses)", () => {
      // modifier + max roll = -5 + 20 = 15 < 20 → 0% 成功率
      for (let i = 0; i < 100; i++) {
        const result = skillCheck({ difficulty: 20, modifier: -5 });
        assert.ok(!result.success,
          `Expected failure but got success: roll=${result.roll}, total=${result.total}`);
      }
    });

    it("should always succeed when difficulty=1, modifier=0", () => {
      // 最低 roll=1, total=1 ≥ difficulty=1 → 100% 成功率
      for (let i = 0; i < 100; i++) {
        const result = skillCheck({ difficulty: 1, modifier: 0 });
        assert.ok(result.success,
          `Expected success but got failure: roll=${result.roll}, total=${result.total}`);
      }
    });
  });

  describe("critical success / critical failure", () => {

    it("should be critical success when modifier=10, difficulty=1 (margin >= 10 even at worst roll)", () => {
      // 最差 roll=1: total=11, margin=10 ≥ 10 → critical
      for (let i = 0; i < 100; i++) {
        const result = skillCheck({ difficulty: 1, modifier: 10 });
        assert.ok(result.success, "Expected success");
        assert.ok(result.critical,
          `Expected critical success: roll=${result.roll}, total=${result.total}, margin=${result.margin}`);
      }
    });

    it("should be critical failure when modifier=-10, difficulty=20 (margin <= -10 even at best roll)", () => {
      // 最佳 roll=20: total=10, margin=-10 ≤ -10 → critical failure
      for (let i = 0; i < 100; i++) {
        const result = skillCheck({ difficulty: 20, modifier: -10 });
        assert.ok(!result.success, "Expected failure");
        assert.ok(result.critical,
          `Expected critical failure: roll=${result.roll}, total=${result.total}, margin=${result.margin}`);
      }
    });
  });

  describe("edge cases", () => {

    it("should work correctly with difficulty=0 (always success when modifier=0)", () => {
      // roll 最低为 1, total ≥ 1 > 0 → 总是成功
      for (let i = 0; i < 100; i++) {
        const result = skillCheck({ difficulty: 0, modifier: 0 });
        assert.ok(result.success,
          `Expected success but got failure: roll=${result.roll}, total=${result.total}`);
        assert.strictEqual(result.total, result.roll);
        assert.strictEqual(result.difficulty, 0);
        assert.strictEqual(result.margin, result.roll); // total - 0 = roll
      }
    });
  });

});
