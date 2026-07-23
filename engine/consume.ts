export interface ConsumeInput {
  item: {
    name: string;
    effect_type: string;
    effect_value: number;
  };
  target: {
    hp: number;
    hp_max: number;
  };
}

export interface ConsumeResult {
  effect_type: string;
  hp_before: number;
  hp_after: number;
  hp_change: number;
  detail: string;
}

export function consumeItem(input: ConsumeInput): ConsumeResult {
  const { hp, hp_max } = input.target;
  const { effect_type, effect_value } = input.item;

  switch (effect_type) {
    case "heal": {
      const actualHeal = Math.min(effect_value, hp_max - hp);
      return {
        effect_type: "heal",
        hp_before: hp,
        hp_after: hp + actualHeal,
        hp_change: actualHeal,
        detail: `Healed ${actualHeal} HP (${hp} → ${hp + actualHeal})`,
      };
    }
    case "damage": {
      const actualDamage = Math.min(effect_value, hp);
      return {
        effect_type: "damage",
        hp_before: hp,
        hp_after: hp - actualDamage,
        hp_change: -actualDamage,
        detail: `Took ${actualDamage} damage (${hp} → ${hp - actualDamage})`,
      };
    }
    case "restore": {
      const actualHeal = hp_max - hp;
      return {
        effect_type: "restore",
        hp_before: hp,
        hp_after: hp_max,
        hp_change: actualHeal,
        detail: `Restored to full HP (${hp} → ${hp_max})`,
      };
    }
    default:
      return {
        effect_type,
        hp_before: hp,
        hp_after: hp,
        hp_change: 0,
        detail: `Unknown effect type: ${effect_type}`,
      };
  }
}
