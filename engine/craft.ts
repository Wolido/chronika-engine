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
}

function findInInventory(inventory: InventoryItem[], itemName: string): number {
  const found = inventory.find(i => i.item_name === itemName);
  return found ? found.quantity : 0;
}

export function craftItem(input: CraftInput): CraftResult {
  const missing: CraftMissing[] = [];
  const consumed: CraftConsumed[] = [];

  // Check all ingredients
  for (const ing of input.recipe.ingredients) {
    const have = findInInventory(input.inventory, ing.item_name);
    if (have < ing.quantity) {
      missing.push({ item_name: ing.item_name, needed: ing.quantity, have });
    } else {
      consumed.push({ item_name: ing.item_name, quantity: ing.quantity });
    }
  }

  if (missing.length > 0) {
    return { success: false, missing_ingredients: missing };
  }

  return {
    success: true,
    items_consumed: consumed,
    items_produced: [{ item_name: input.recipe.result_item, quantity: input.recipe.result_quantity }],
  };
}
