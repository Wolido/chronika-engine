/**
 * action.test.ts — RED phase: 行为/动作校验规则测试
 *
 * 这些测试定义了 validateAction() 的期望行为。
 * 当前 validateAction 是一个桩（stub），会抛出 NOT IMPLEMENTED，
 * 因此全部测试处于 RED（失败）状态。
 *
 * coder 实现 validateAction 后，这些测试将逐条变绿。
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { validateAction, type ActionData } from "../../../engine/validation/action.ts";

// ---------------------------------------------------------------------------
// 辅助函数：构造一个完全合法的行为（happy-path 基准数据）
// ---------------------------------------------------------------------------

function validAction(overrides: Partial<ActionData> = {}): ActionData {
  return {
    name: "测试攻击",
    action_type: "combat",
    primary_attr: "strength",
    difficulty: 12,
    cooldown: 0,
    success_result: { effect: "damage", value: 10 },
    failure_result: { effect: "damage", value: 3 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 测试用例
// ---------------------------------------------------------------------------

describe("validateAction", () => {
  // =========================================================================
  // 基础必填字段
  // =========================================================================

  describe("基础必填字段", () => {
    it("should fail when name is empty or missing", () => {
      const emptyName = validAction({ name: "" });
      const missingName = validAction();
      delete (missingName as any).name;

      const resultEmpty = validateAction(emptyName);
      const resultMissing = validateAction(missingName);

      assert.strictEqual(resultEmpty.valid, false);
      assert.ok(resultEmpty.errors.length > 0);
      assert.ok(
        resultEmpty.errors.some((e) => e.toLowerCase().includes("name")),
        `errors should mention 'name', got: ${JSON.stringify(resultEmpty.errors)}`
      );

      assert.strictEqual(resultMissing.valid, false);
      assert.ok(resultMissing.errors.length > 0);
      assert.ok(
        resultMissing.errors.some((e) => e.toLowerCase().includes("name")),
        `errors should mention 'name', got: ${JSON.stringify(resultMissing.errors)}`
      );
    });

    it("should fail when action_type is invalid (e.g. 'magic')", () => {
      const action = validAction({ action_type: "magic" });

      const result = validateAction(action);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("action_type")),
        `errors should mention 'action_type', got: ${JSON.stringify(result.errors)}`
      );
    });
  });

  // =========================================================================
  // primary_attr 合法性
  // =========================================================================

  describe("primary_attr 合法性", () => {
    it("should fail when primary_attr is undefined", () => {
      const action = { ...validAction(), primary_attr: undefined as any };

      const result = validateAction(action as any);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("primary_attr")),
        `errors should mention 'primary_attr', got: ${JSON.stringify(result.errors)}`
      );
    });

    it("should fail when primary_attr is invalid (e.g. 'luck')", () => {
      const action = validAction({ primary_attr: "luck" });

      const result = validateAction(action);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("primary_attr")),
        `errors should mention 'primary_attr', got: ${JSON.stringify(result.errors)}`
      );
    });

    it("should pass when primary_attr is a legal value", () => {
      const action = validAction({ primary_attr: "agility" });

      const result = validateAction(action);

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });
  });

  // =========================================================================
  // 数值范围
  // =========================================================================

  describe("数值范围", () => {
    it("should fail when difficulty is undefined", () => {
      const action = { ...validAction(), difficulty: undefined as any };

      const result = validateAction(action as any);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("difficulty")),
        `errors should mention 'difficulty', got: ${JSON.stringify(result.errors)}`
      );
    });

    it("should fail when difficulty < 1", () => {
      const action = validAction({ difficulty: 0 });

      const result = validateAction(action);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("difficulty")),
        `errors should mention 'difficulty', got: ${JSON.stringify(result.errors)}`
      );
    });

    it("should fail when difficulty > 30", () => {
      const action = validAction({ difficulty: 31 });

      const result = validateAction(action);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("difficulty")),
        `errors should mention 'difficulty', got: ${JSON.stringify(result.errors)}`
      );
    });

    it("should fail when cooldown is negative", () => {
      const action = validAction({ cooldown: -1 });

      const result = validateAction(action);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("cooldown")),
        `errors should mention 'cooldown', got: ${JSON.stringify(result.errors)}`
      );
    });
  });

  // =========================================================================
  // 成功/失败结果
  // =========================================================================

  describe("成功/失败结果", () => {
    it("should fail when success_result is undefined", () => {
      const action = { ...validAction(), success_result: undefined as any };

      const result = validateAction(action as any);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("success_result")),
        `errors should mention 'success_result', got: ${JSON.stringify(result.errors)}`
      );
    });

    it("should fail when failure_result is undefined", () => {
      const action = { ...validAction(), failure_result: undefined as any };

      const result = validateAction(action as any);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("failure_result")),
        `errors should mention 'failure_result', got: ${JSON.stringify(result.errors)}`
      );
    });
  });

  // =========================================================================
  // 完全合法的行为
  // =========================================================================

  describe("完全合法的行为", () => {
    it("should pass validation for a fully valid combat action", () => {
      const action = validAction({
        name: "强力斩击",
        action_type: "combat",
        primary_attr: "strength",
        difficulty: 15,
        cooldown: 2,
        success_result: { effect: "damage", value: 25 },
        failure_result: { effect: "damage", value: 5 },
      });

      const result = validateAction(action);

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it("should pass validation for a fully valid social action with description", () => {
      const action = validAction({
        name: "说服守卫",
        action_type: "social",
        primary_attr: "barter",
        difficulty: 10,
        cooldown: 0,
        success_result: "守卫被说服，允许通行",
        failure_result: "守卫起疑，进入警戒状态",
        description: "尝试说服守卫放行",
      });

      const result = validateAction(action);

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });
  });
});
