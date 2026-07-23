/**
 * status-runtime.test.ts — RED phase: 状态效果运行时测试
 *
 * 测试 applyStatus（附着新效果）和 tickStatus（每回合结算）的行为。
 * 当前两个函数均为桩（stub），会抛出 NOT IMPLEMENTED，
 * 因此全部测试处于 RED（失败）状态。
 *
 * coder 实现这两个函数后，测试将逐条变绿。
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { applyStatus, tickStatus } from "../../engine/status-runtime.ts";
import type { ActiveStatus, ApplyStatusInput } from "../../engine/status-runtime.ts";

// ============================================================
// 测试辅助
// ============================================================

function sampleEffect(overrides: Partial<ApplyStatusInput["effect"]> = {}): ApplyStatusInput["effect"] {
  return {
    name: "燃烧",
    effect_type: "dot",
    magnitude: -5,
    duration: 3,
    ...overrides,
  };
}

function sampleActive(overrides: Partial<ActiveStatus> = {}): ActiveStatus {
  return {
    effect_name: "燃烧",
    effect_type: "dot",
    magnitude: -5,
    remaining_turns: 3,
    max_duration: 3,
    ...overrides,
  };
}

// ============================================================
// applyStatus 测试
// ============================================================

describe("applyStatus", () => {
  // --- 附着新效果 -------------------------------------------------

  it("should add a new DOT effect to current_effects with correct duration", () => {
    const input: ApplyStatusInput = {
      effect: sampleEffect({ name: "中毒", effect_type: "dot", magnitude: -3, duration: 3 }),
      current_effects: [],
    };

    const result = applyStatus(input);

    assert.strictEqual(result.applied, true);
    assert.strictEqual(result.updated_effects.length, 1);

    const added = result.updated_effects[0];
    assert.strictEqual(added.effect_name, "中毒");
    assert.strictEqual(added.effect_type, "dot");
    assert.strictEqual(added.magnitude, -3);
    assert.strictEqual(added.remaining_turns, 3);
    assert.strictEqual(added.max_duration, 3);
  });

  // --- 刷新已存在效果 ----------------------------------------------

  it("should refresh duration of an existing effect instead of stacking a duplicate", () => {
    const existing = sampleActive({ effect_name: "燃烧", remaining_turns: 1, max_duration: 3 });
    const input: ApplyStatusInput = {
      effect: sampleEffect({ name: "燃烧", effect_type: "dot", magnitude: -5, duration: 3 }),
      current_effects: [existing],
    };

    const result = applyStatus(input);

    assert.strictEqual(result.applied, true);
    // 不应叠加，仍为 1 个效果
    assert.strictEqual(result.updated_effects.length, 1);

    const refreshed = result.updated_effects[0];
    assert.strictEqual(refreshed.effect_name, "燃烧");
    // duration 应刷新为新的 max_duration
    assert.strictEqual(refreshed.remaining_turns, 3);
    assert.strictEqual(refreshed.max_duration, 3);
  });

  // --- 附着 HOT ---------------------------------------------------

  it("should add a HOT effect with positive magnitude following the same logic", () => {
    const input: ApplyStatusInput = {
      effect: sampleEffect({ name: "愈合", effect_type: "hot", magnitude: 4, duration: 4 }),
      current_effects: [],
    };

    const result = applyStatus(input);

    assert.strictEqual(result.applied, true);
    assert.strictEqual(result.updated_effects.length, 1);

    const added = result.updated_effects[0];
    assert.strictEqual(added.effect_name, "愈合");
    assert.strictEqual(added.effect_type, "hot");
    assert.strictEqual(added.magnitude, 4);
    assert.strictEqual(added.remaining_turns, 4);
    assert.strictEqual(added.max_duration, 4);
  });

  // --- 拒绝空名称 -------------------------------------------------

  it("should reject and return applied=false when effect name is empty", () => {
    const input: ApplyStatusInput = {
      effect: sampleEffect({ name: "", effect_type: "dot", magnitude: -5, duration: 3 }),
      current_effects: [],
    };

    const result = applyStatus(input);

    assert.strictEqual(result.applied, false);
    // 效果列表不应发生变化
    assert.deepStrictEqual(result.updated_effects, []);
    assert.ok(
      result.note !== undefined && result.note.length > 0,
      `expected a non-empty note explaining rejection, got: ${result.note}`
    );
  });
});

// ============================================================
// tickStatus 测试
// ============================================================

describe("tickStatus", () => {
  // --- DOT 扣血 ---------------------------------------------------

  it("should reduce HP by the absolute magnitude of a DOT effect and decrement remaining_turns", () => {
    const input: TickStatusInput = {
      active_effects: [sampleActive({ effect_name: "中毒", effect_type: "dot", magnitude: -5, remaining_turns: 3 })],
      target_hp: 30,
      target_hp_max: 50,
    };

    const result = tickStatus(input);

    // HP 应减少 5（取 magnitude 的绝对值）
    assert.strictEqual(result.hp_change_total, -5);
    assert.strictEqual(result.hp_after, 25);

    // tick 记录
    assert.strictEqual(result.ticks.length, 1);
    const tick = result.ticks[0];
    assert.strictEqual(tick.effect_name, "中毒");
    assert.strictEqual(tick.hp_change, -5);
    assert.strictEqual(tick.remaining, 2); // 从 3 减为 2
    assert.strictEqual(tick.expired, false);

    // remaining_effects 中 remaining_turns 应减 1
    assert.strictEqual(result.remaining_effects.length, 1);
    assert.strictEqual(result.remaining_effects[0].remaining_turns, 2);
  });

  // --- HOT 回血 ---------------------------------------------------

  it("should increase HP by HOT magnitude, capped at hp_max", () => {
    const input: TickStatusInput = {
      active_effects: [sampleActive({ effect_name: "愈合", effect_type: "hot", magnitude: 4, remaining_turns: 3 })],
      target_hp: 46,
      target_hp_max: 50,
    };

    const result = tickStatus(input);

    // HP 应从 46 恢复到 50（受 hp_max 上限约束）
    assert.strictEqual(result.hp_change_total, 4);
    assert.strictEqual(result.hp_after, 50);

    const tick = result.ticks[0];
    assert.strictEqual(tick.effect_name, "愈合");
    assert.strictEqual(tick.hp_change, 4);
    assert.strictEqual(tick.remaining, 2);
    assert.strictEqual(tick.expired, false);
  });

  // --- 效果到期移除 -----------------------------------------------

  it("should remove an effect when remaining_turns reaches zero", () => {
    const input: TickStatusInput = {
      active_effects: [sampleActive({ effect_name: "虚弱", effect_type: "debuff", magnitude: -3, remaining_turns: 1 })],
      target_hp: 30,
      target_hp_max: 50,
    };

    const result = tickStatus(input);

    // debuff 不直接影响 HP，所以 hp_change_total=0
    assert.strictEqual(result.hp_change_total, 0);
    assert.strictEqual(result.hp_after, 30);

    // tick 记录标记为 expired
    assert.strictEqual(result.ticks.length, 1);
    const tick = result.ticks[0];
    assert.strictEqual(tick.effect_name, "虚弱");
    assert.strictEqual(tick.remaining, 0);
    assert.strictEqual(tick.expired, true);

    // remaining_effects 中应移除此效果
    assert.strictEqual(result.remaining_effects.length, 0);
  });

  // --- HP 不低于 0 ------------------------------------------------

  it("should not reduce HP below zero after DOT damage", () => {
    const input: TickStatusInput = {
      active_effects: [sampleActive({ effect_name: "剧毒", effect_type: "dot", magnitude: -10, remaining_turns: 2 })],
      target_hp: 6,
      target_hp_max: 30,
    };

    const result = tickStatus(input);

    // 伤害 10，但 HP 只有 6 → 应降到 0，不可为负数
    assert.strictEqual(result.hp_after, 0);
    assert.strictEqual(result.hp_change_total, -6); // 实际只扣了 6

    const tick = result.ticks[0];
    assert.strictEqual(tick.hp_change, -6);
    assert.strictEqual(tick.remaining, 1);
  });

  // --- 多种效果同时结算 -------------------------------------------

  it("should accumulate HP changes from multiple DOT/HOT effects in one tick", () => {
    const input: TickStatusInput = {
      active_effects: [
        sampleActive({ effect_name: "中毒", effect_type: "dot", magnitude: -4, remaining_turns: 3 }),
        sampleActive({ effect_name: "愈合", effect_type: "hot", magnitude: 3, remaining_turns: 3 }),
        sampleActive({ effect_name: "燃烧", effect_type: "dot", magnitude: -2, remaining_turns: 2 }),
      ],
      target_hp: 20,
      target_hp_max: 30,
    };

    const result = tickStatus(input);

    // 总 HP 变化：-4 + 3 + (-2) = -3
    assert.strictEqual(result.hp_change_total, -3);
    assert.strictEqual(result.hp_after, 17);

    // 应有 3 条 tick 记录
    assert.strictEqual(result.ticks.length, 3);

    // 检查各 tick 的 remaining 值
    const tickPoison = result.ticks.find((t) => t.effect_name === "中毒");
    assert.ok(tickPoison !== undefined, "expected tick record for 中毒");
    assert.strictEqual(tickPoison!.remaining, 2);
    assert.strictEqual(tickPoison!.hp_change, -4);
    assert.strictEqual(tickPoison!.expired, false);

    const tickHeal = result.ticks.find((t) => t.effect_name === "愈合");
    assert.ok(tickHeal !== undefined, "expected tick record for 愈合");
    assert.strictEqual(tickHeal!.remaining, 2);
    assert.strictEqual(tickHeal!.hp_change, 3);
    assert.strictEqual(tickHeal!.expired, false);

    const tickBurn = result.ticks.find((t) => t.effect_name === "燃烧");
    assert.ok(tickBurn !== undefined, "expected tick record for 燃烧");
    assert.strictEqual(tickBurn!.remaining, 1);
    assert.strictEqual(tickBurn!.hp_change, -2);
    assert.strictEqual(tickBurn!.expired, false);

    // remaining_effects 应保留全部 3 个效果（none expired）
    assert.strictEqual(result.remaining_effects.length, 3);
    for (const effect of result.remaining_effects) {
      assert.ok(effect.remaining_turns >= 1, `${effect.effect_name} should have remaining_turns >= 1`);
    }
  });
});
