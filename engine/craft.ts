import type { AccessoryData } from "./legendary-gen.ts";

export interface CraftIngredient {
  item_name: string;
  quantity: number;
}

export interface CraftRecipe {
  result_item: string;
  result_quantity: number;
  ingredients: CraftIngredient[];
}

export interface InventoryItem {
  item_name: string;
  quantity: number;
}

export interface CraftInput {
  recipe: CraftRecipe;
  inventory: InventoryItem[];
  mechanics?: number;
  accessories?: AccessoryData[];
}

export interface CraftMissing {
  item_name: string;
  needed: number;
  have: number;
}

export interface CraftConsumed {
  item_name: string;
  quantity: number;
}

export interface CraftProduced {
  item_name: string;
  quantity: number;
}

export interface CraftResult {
  success: boolean;
  missing_ingredients?: CraftMissing[];
  items_consumed?: CraftConsumed[];
  items_produced?: CraftProduced[];
  accessory_efficiency_bonus?: number;
  accessory_material_saved?: string[];
}

function findInInventory(inventory: InventoryItem[], itemName: string): number {
  const found = inventory.find(i => i.item_name === itemName);
  return found ? found.quantity : 0;
}

export function craftItem(input: CraftInput): CraftResult {
  const missing: CraftMissing[] = [];
  const consumed: CraftConsumed[] = [];

  // 饰品加成（on_craft / passive 触发器）
  let efficiencyBonus = 0;
  let materialSaveChance = 0;
  for (const acc of input.accessories ?? []) {
    if (acc.trigger !== "on_craft" && acc.trigger !== "passive") continue;
    if (acc.effect_type === "crafting_efficiency") efficiencyBonus += Math.floor(acc.magnitude * 2);
    else if (acc.effect_type === "material_save") materialSaveChance += acc.magnitude;
  }

  // Check all ingredients（material_save 触发时该材料不消耗）
  const materialSaved: string[] = [];
  for (const ing of input.recipe.ingredients) {
    const have = findInInventory(input.inventory, ing.item_name);
    if (have < ing.quantity) {
      missing.push({ item_name: ing.item_name, needed: ing.quantity, have });
    } else if (materialSaveChance > 0 && Math.random() < materialSaveChance) {
      materialSaved.push(ing.item_name);
    } else {
      consumed.push({ item_name: ing.item_name, quantity: ing.quantity });
    }
  }

  if (missing.length > 0) {
    return { success: false, missing_ingredients: missing };
  }

  const mechanicsBonus = input.mechanics ? Math.floor(input.mechanics * 0.2) : 0;
  return {
    success: true,
    items_consumed: consumed,
    items_produced: [{ item_name: input.recipe.result_item, quantity: input.recipe.result_quantity + mechanicsBonus + efficiencyBonus }],
    accessory_efficiency_bonus: efficiencyBonus > 0 ? efficiencyBonus : undefined,
    accessory_material_saved: materialSaved.length > 0 ? materialSaved : undefined,
  };
}
