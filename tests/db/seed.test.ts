/**
 * seed.test.ts — RED phase: 种子数据校验测试
 *
 * 验证 db/seed.ts 中所有种子数据都符合对应的校验规则。
 * 如果种子数据有误则测试失败（RED），需要 coder 修复种子数据。
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { SEED_MONSTERS, SEED_ITEMS, SEED_STATUS_EFFECTS } from "../../db/seed.ts";
import { validateMonster } from "../../engine/validation/monster.ts";
import { validateItem } from "../../engine/validation/item.ts";
import { validateStatusEffect } from "../../engine/validation/status-effect.ts";

// ---------------------------------------------------------------------------
// 种子怪物校验
// ---------------------------------------------------------------------------

describe("seed monsters", () => {
  it("all 75 monsters should pass validation", () => {
    const errors: string[] = [];
    for (const monster of SEED_MONSTERS) {
      const result = validateMonster(monster as any);
      if (!result.valid) {
        errors.push(`"${monster.name}": ${result.errors.join("; ")}`);
      }
    }
    assert.strictEqual(errors.length, 0, errors.join("\n"));
  });
});

// ---------------------------------------------------------------------------
// 种子物品校验
// ---------------------------------------------------------------------------

describe("seed items", () => {
  it("all 13 items should pass validation", () => {
    const errors: string[] = [];
    for (const item of SEED_ITEMS) {
      const result = validateItem(item as any);
      if (!result.valid) {
        errors.push(`"${item.name}": ${result.errors.join("; ")}`);
      }
    }
    assert.strictEqual(errors.length, 0, errors.join("\n"));
  });

  it("no items should have item_type 'material'", () => {
    const materials = SEED_ITEMS.filter(i => i.item_type === "material");
    assert.strictEqual(
      materials.length,
      0,
      `Found ${materials.length} material items: ${materials.map(m => m.name).join(", ")}`
    );
  });
});

// ---------------------------------------------------------------------------
// 种子状态效果校验
// ---------------------------------------------------------------------------

describe("seed status effects", () => {
  it("all 12 status effects should pass validation", () => {
    const errors: string[] = [];
    for (const effect of SEED_STATUS_EFFECTS) {
      const result = validateStatusEffect(effect as any);
      if (!result.valid) {
        errors.push(`"${effect.name}": ${result.errors.join("; ")}`);
      }
    }
    assert.strictEqual(errors.length, 0, errors.join("\n"));
  });
});
