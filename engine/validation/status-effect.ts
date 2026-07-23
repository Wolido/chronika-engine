export interface StatusEffectData {
  name: string;
  effect_type: string;
  target_attribute: string;
  magnitude: number;
  duration: number;
  stackable?: boolean;
  max_stacks?: number;
  [key: string]: any;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const VALID_EFFECT_TYPES: readonly string[] = ["buff", "debuff", "dot", "hot", "stun", "root"];

export function validateStatusEffect(effect: StatusEffectData): ValidationResult {
  const errors: string[] = [];

  // name
  if (!effect.name || effect.name.trim() === "") {
    errors.push("status effect name is required");
  }

  // effect_type
  if (!VALID_EFFECT_TYPES.includes(effect.effect_type)) {
    errors.push(`effect_type must be one of: ${VALID_EFFECT_TYPES.join(", ")}`);
  }

  // magnitude
  if (effect.magnitude === undefined || effect.magnitude === null) {
    errors.push("status effect magnitude is required");
  }

  // duration
  if (effect.duration === undefined || effect.duration === null) {
    errors.push("status effect duration is required");
  } else if (effect.duration < 1) {
    errors.push("status effect duration must be ≥ 1");
  }

  // 类型约束：buff 的 magnitude 必须 ≥ 0
  if (effect.effect_type === "buff" && effect.magnitude !== undefined && effect.magnitude !== null && effect.magnitude < 0) {
    errors.push("buff effects must have magnitude ≥ 0");
  }

  // 类型约束：debuff 的 magnitude 必须 ≤ 0
  if (effect.effect_type === "debuff" && effect.magnitude !== undefined && effect.magnitude !== null && effect.magnitude > 0) {
    errors.push("debuff effects must have magnitude ≤ 0");
  }

  // 类型约束：stun 的 magnitude 必须 = 0
  if (effect.effect_type === "stun" && effect.magnitude !== undefined && effect.magnitude !== null && effect.magnitude !== 0) {
    errors.push("stun effects must have magnitude = 0");
  }

  // 可堆叠
  if (effect.stackable === true) {
    if (effect.max_stacks === undefined || effect.max_stacks === null) {
      errors.push("stackable effects must have max_stacks");
    } else if (effect.max_stacks < 1) {
      errors.push("max_stacks must be ≥ 1");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
