import type { AccessoryData } from "./legendary-gen.ts";

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
  medicine?: number;
  accessories?: AccessoryData[];
}

export interface ConsumeResult {
  effect_type: string;
  hp_before: number;
  hp_after: number;
  hp_change: number;
  detail: string;
  accessory_heal_bonus?: number;
  accessory_double_effect?: boolean;
}

export function consumeItem(input: ConsumeInput): ConsumeResult {
  const { hp, hp_max } = input.target;
  const { effect_type, effect_value } = input.item;

  // 饰品加成（on_heal / passive 触发器）
  let healingBoost = 0;
  let doubleEffectChance = 0;
  for (const acc of input.accessories ?? []) {
    if (acc.trigger !== "on_heal" && acc.trigger !== "passive") continue;
    if (acc.effect_type === "healing_boost") healingBoost += acc.magnitude;
    // Note: item_efficiency only applies to "heal" effect_type.
    // "damage" and "restore" types are intentionally excluded.
    else if (acc.effect_type === "item_efficiency") doubleEffectChance += acc.magnitude;
  }

  switch (effect_type) {
    case "heal": {
      const medicineBonus = input.medicine ? Math.floor(input.medicine * 1.5) : 0;
      // healing_boost：额外增加 magnitude × effect_value；item_efficiency：概率效果翻倍
      const accessoryHealBonus = Math.round(effect_value * healingBoost);
      const doubleEffect = doubleEffectChance > 0 && Math.random() < doubleEffectChance;
      const boostedValue = effect_value * (doubleEffect ? 2 : 1);
      const actualHeal = Math.min(boostedValue + medicineBonus + accessoryHealBonus, hp_max - hp);
      return {
        effect_type: "heal",
        hp_before: hp,
        hp_after: hp + actualHeal,
        hp_change: actualHeal,
        detail: `Healed ${actualHeal} HP (${hp} → ${hp + actualHeal})`,
        accessory_heal_bonus: accessoryHealBonus > 0 ? accessoryHealBonus : undefined,
        accessory_double_effect: doubleEffect ? true : undefined,
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
