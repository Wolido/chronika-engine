/**
 * action.ts — GREEN phase: 行为/动作校验实现
 *
 * 校验 ActionData 的合法性，返回 ValidationResult。
 * 规则由 tests/engine/validation/action.test.ts 定义。
 */

export interface ActionData {
  name: string;
  action_type: string;
  primary_attr: string;
  difficulty: number;
  cooldown: number;
  success_result: any;
  failure_result: any;
  description?: string;
  [key: string]: any;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const VALID_ACTION_TYPES: readonly string[] = ["combat", "social", "exploration", "craft", "survival"];

const VALID_PRIMARY_ATTRS: readonly string[] = [
  "strength", "agility", "endurance", "perception",
  "intelligence", "willpower", "charisma", "persuasion",
  "survival", "medicine", "mechanics",
];

export function validateAction(action: ActionData): ValidationResult {
  const errors: string[] = [];

  // name
  if (!action.name || action.name.trim() === "") {
    errors.push("action name is required");
  }

  // action_type
  if (!VALID_ACTION_TYPES.includes(action.action_type)) {
    errors.push(`action_type must be one of: ${VALID_ACTION_TYPES.join(", ")}`);
  }

  // primary_attr
  if (action.primary_attr === undefined || action.primary_attr === null) {
    errors.push("action primary_attr is required");
  } else if (!VALID_PRIMARY_ATTRS.includes(action.primary_attr)) {
    errors.push(`action primary_attr must be one of: ${VALID_PRIMARY_ATTRS.join(", ")}`);
  }

  // difficulty
  if (action.difficulty === undefined || action.difficulty === null) {
    errors.push("action difficulty is required");
  } else if (action.difficulty < 1) {
    errors.push("action difficulty must be ≥ 1");
  } else if (action.difficulty > 30) {
    errors.push("action difficulty must be ≤ 30");
  }

  // cooldown
  if (action.cooldown !== undefined && action.cooldown !== null && action.cooldown < 0) {
    errors.push("action cooldown must be ≥ 0");
  }

  // success_result
  if (action.success_result === undefined || action.success_result === null) {
    errors.push("action success_result is required");
  }

  // failure_result
  if (action.failure_result === undefined || action.failure_result === null) {
    errors.push("action failure_result is required");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
