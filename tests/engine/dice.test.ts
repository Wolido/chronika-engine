import { describe, it } from "node:test";
import assert from "node:assert";
import { rollDice } from "../../engine/dice.ts";

describe("rollDice", () => {
  it("should return total between 2 and 12 with 1 dice group of count=2 for '2d6'", () => {
    const result = rollDice("2d6");

    assert.ok(result.total >= 2 && result.total <= 12, `total ${result.total} out of range [2,12]`);
    assert.strictEqual(result.terms.length, 1);
    assert.strictEqual(result.modifiers.length, 0);

    const term = result.terms[0];
    assert.strictEqual(term.count, 2);
    assert.strictEqual(term.sides, 6);
    assert.strictEqual(term.rolls.length, 2);
    for (const roll of term.rolls) {
      assert.ok(roll >= 1 && roll <= 6, `roll ${roll} out of range [1,6]`);
    }
  });

  it("should return total between 4 and 23 with modifiers [3] for '1d20+3'", () => {
    const result = rollDice("1d20+3");

    assert.ok(result.total >= 4 && result.total <= 23, `total ${result.total} out of range [4,23]`);
    assert.strictEqual(result.terms.length, 1);
    assert.strictEqual(result.terms[0].sides, 20);
    assert.strictEqual(result.terms[0].count, 1);
    assert.deepStrictEqual(result.modifiers, [3]);
  });

  it("should return total between 1 and 100 with count=1 for 'd100'", () => {
    const result = rollDice("d100");

    assert.ok(result.total >= 1 && result.total <= 100, `total ${result.total} out of range [1,100]`);
    assert.strictEqual(result.terms.length, 1);
    assert.strictEqual(result.terms[0].count, 1);
    assert.strictEqual(result.terms[0].sides, 100);
    assert.strictEqual(result.terms[0].rolls.length, 1);
  });

  it("should handle '3d8+2d6-1': 2 dice groups (3d8, 2d6) plus modifier [-1]", () => {
    const result = rollDice("3d8+2d6-1");

    // Two dice groups: 3d8 and 2d6
    assert.strictEqual(result.terms.length, 2);

    assert.strictEqual(result.terms[0].count, 3);
    assert.strictEqual(result.terms[0].sides, 8);
    assert.strictEqual(result.terms[0].rolls.length, 3);

    assert.strictEqual(result.terms[1].count, 2);
    assert.strictEqual(result.terms[1].sides, 6);
    assert.strictEqual(result.terms[1].rolls.length, 2);

    // One modifier: -1
    assert.deepStrictEqual(result.modifiers, [-1]);
  });

  it("should average between 6.8 and 7.2 over 10000 rolls of '2d6'", () => {
    const iterations = 10000;
    let sum = 0;

    for (let i = 0; i < iterations; i++) {
      sum += rollDice("2d6").total;
    }

    const avg = sum / iterations;
    assert.ok(avg >= 6.8 && avg <= 7.2, `average ${avg} out of expected range [6.8, 7.2]`);
  });

  it("should return total=0 for empty input", () => {
    const result = rollDice("");

    assert.strictEqual(result.total, 0);
    assert.strictEqual(result.terms.length, 0);
    assert.strictEqual(result.modifiers.length, 0);
  });

  it("should return total=0 for whitespace-only input", () => {
    const result = rollDice("   ");

    assert.strictEqual(result.total, 0);
    assert.strictEqual(result.terms.length, 0);
    assert.strictEqual(result.modifiers.length, 0);
  });

  it("should have only modifiers and no terms for '5'", () => {
    const result = rollDice("5");

    assert.strictEqual(result.terms.length, 0);
    assert.deepStrictEqual(result.modifiers, [5]);
    assert.strictEqual(result.total, 5);
  });

  it("should handle negative modifier-only input like '-3'", () => {
    const result = rollDice("-3");

    assert.strictEqual(result.terms.length, 0);
    assert.deepStrictEqual(result.modifiers, [-3]);
    assert.strictEqual(result.total, -3);
  });
});
