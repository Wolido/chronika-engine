import { validateWeapon } from "./validation/weapon.ts";
import type { WeaponData } from "./validation/weapon.ts";
import { validateMonster } from "./validation/monster.ts";
import type { MonsterData } from "./validation/monster.ts";
import { validateItem } from "./validation/item.ts";
import type { ItemData } from "./validation/item.ts";
import { validateStatusEffect } from "./validation/status-effect.ts";
import type { StatusEffectData } from "./validation/status-effect.ts";
import { validateAction } from "./validation/action.ts";
import type { ActionData } from "./validation/action.ts";

export interface WorldGenInput {
  world_meta?: { world_name: string; world_desc?: string; tone?: string };
  weapons?: WeaponData[];
  monsters?: MonsterData[];
  items?: ItemData[];
  status_effects?: StatusEffectData[];
  actions?: ActionData[];
}

export interface WorldGenResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    weapons_written: number;
    monsters_written: number;
    items_written: number;
    status_effects_written: number;
    actions_written: number;
  };
}

function objectToInsert(obj: Record<string, any>, columns: string[]): { columns: string; placeholders: string; values: any[] } {
  const cols: string[] = [];
  const vals: any[] = [];
  for (const col of columns) {
    if (obj[col] !== undefined && obj[col] !== null) {
      cols.push(col);
      vals.push(obj[col]);
    }
  }
  return {
    columns: cols.join(", "),
    placeholders: cols.map(() => "?").join(", "),
    values: vals,
  };
}

export function generateWorld(db: any, input: WorldGenInput): WorldGenResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const stats = {
    weapons_written: 0,
    monsters_written: 0,
    items_written: 0,
    status_effects_written: 0,
    actions_written: 0,
  };

  // 校验所有实体
  if (input.weapons && input.weapons.length > 0) {
    for (const weapon of input.weapons) {
      const result = validateWeapon(weapon);
      if (!result.valid) {
        errors.push(`weapon "${weapon.name}": ${result.errors.join("; ")}`);
      }
    }
  }

  if (input.monsters && input.monsters.length > 0) {
    for (const monster of input.monsters) {
      const result = validateMonster(monster);
      if (!result.valid) {
        errors.push(`monster "${monster.name}": ${result.errors.join("; ")}`);
      }
    }
  }

  if (input.items && input.items.length > 0) {
    for (const item of input.items) {
      const result = validateItem(item);
      if (!result.valid) {
        errors.push(`item "${item.name}": ${result.errors.join("; ")}`);
      }
    }
  }

  if (input.status_effects && input.status_effects.length > 0) {
    for (const effect of input.status_effects) {
      const result = validateStatusEffect(effect);
      if (!result.valid) {
        errors.push(`status_effect "${effect.name}": ${result.errors.join("; ")}`);
      }
    }
  }

  if (input.actions && input.actions.length > 0) {
    for (const action of input.actions) {
      const result = validateAction(action);
      if (!result.valid) {
        errors.push(`action "${action.name}": ${result.errors.join("; ")}`);
      }
    }
  }

  // 有错误 → 全盘拒绝
  if (errors.length > 0) {
    return { ok: false, errors, warnings, stats };
  }

  // 写入 world_meta
  if (input.world_meta) {
    const meta = input.world_meta;
    db.run(
      "INSERT INTO world_meta (world_name, world_desc, tone) VALUES (?, ?, ?)",
      [meta.world_name, meta.world_desc || null, meta.tone || null]
    );
  }

  // 写入武器
  const WEAPON_COLS = ["name", "category", "damage_type", "damage_min", "damage_max", "accuracy", "durability", "rarity", "tier", "weight", "value", "range_min", "range_max", "ammo_type", "description", "flavor_text"];
  if (input.weapons && input.weapons.length > 0) {
    for (const weapon of input.weapons) {
      const { columns, placeholders, values } = objectToInsert(weapon, WEAPON_COLS);
      db.run(`INSERT INTO weapons (${columns}) VALUES (${placeholders})`, values);
      stats.weapons_written++;
    }
  }

  // 写入怪物
  const MONSTER_COLS = ["name", "category", "hp", "strength", "agility", "endurance", "perception", "intelligence", "willpower", "damage_min", "damage_max", "accuracy", "evasion", "armor", "tier", "xp_reward", "description", "behavior_text"];
  if (input.monsters && input.monsters.length > 0) {
    for (const monster of input.monsters) {
      const { columns, placeholders, values } = objectToInsert(monster, MONSTER_COLS);
      db.run(`INSERT INTO monsters (${columns}) VALUES (${placeholders})`, values);
      stats.monsters_written++;
    }
  }

  // 写入物品
  const ITEM_COLS = ["name", "item_type", "rarity", "value", "weight", "stackable", "stack_max", "effect_type", "effect_value", "description"];
  if (input.items && input.items.length > 0) {
    for (const item of input.items) {
      const { columns, placeholders, values } = objectToInsert(item, ITEM_COLS);
      db.run(`INSERT INTO items (${columns}) VALUES (${placeholders})`, values);
      stats.items_written++;
    }
  }

  // 写入状态效果
  const EFFECT_COLS = ["name", "effect_type", "target_attribute", "magnitude", "duration", "stackable", "max_stacks", "description"];
  if (input.status_effects && input.status_effects.length > 0) {
    for (const effect of input.status_effects) {
      const { columns, placeholders, values } = objectToInsert(effect, EFFECT_COLS);
      db.run(`INSERT INTO status_effects (${columns}) VALUES (${placeholders})`, values);
      stats.status_effects_written++;
    }
  }

  // 写入行为
  const ACTION_COLS = ["name", "action_type", "primary_attr", "difficulty", "cooldown", "success_result", "failure_result", "description"];
  if (input.actions && input.actions.length > 0) {
    for (const action of input.actions) {
      const row = { ...action };
      if (typeof row.success_result === "object") row.success_result = JSON.stringify(row.success_result);
      if (typeof row.failure_result === "object") row.failure_result = JSON.stringify(row.failure_result);
      const { columns, placeholders, values } = objectToInsert(row, ACTION_COLS);
      db.run(`INSERT INTO actions (${columns}) VALUES (${placeholders})`, values);
      stats.actions_written++;
    }
  }

  return { ok: true, errors, warnings, stats };
}
