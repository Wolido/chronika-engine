export interface ItemData {
  name: string;
  item_type: string;
  rarity: string;
  value: number;
  weight: number;
  stackable?: boolean;
  stack_max?: number;
  effect_type?: string;
  effect_value?: number;
  armor_slot?: string;
  defense?: number;
  [key: string]: any;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const VALID_ITEM_TYPES: readonly string[] = ["consumable", "material", "armor", "misc"];
const VALID_RARITIES: readonly string[] = ["common", "uncommon", "rare", "legendary"];
const VALID_ARMOR_SLOTS: readonly string[] = ["head", "chest", "legs", "shield"];

export function validateItem(item: ItemData): ValidationResult {
  const errors: string[] = [];

  // name
  if (!item.name || item.name.trim() === "") {
    errors.push("item name is required");
  }

  // item_type
  if (!VALID_ITEM_TYPES.includes(item.item_type)) {
    errors.push(`item_type must be one of: ${VALID_ITEM_TYPES.join(", ")}`);
  }

  // rarity
  if (!VALID_RARITIES.includes(item.rarity)) {
    errors.push(`item rarity must be one of: ${VALID_RARITIES.join(", ")}`);
  }

  // value
  if (item.value === undefined || item.value === null) {
    errors.push("item value is required");
  } else if (item.value < 0) {
    errors.push("item value must be ≥ 0");
  }

  // weight
  if (item.weight !== undefined && item.weight !== null && item.weight < 0) {
    errors.push("item weight must be ≥ 0");
  }

  // 条件依赖：consumable → effect_type + effect_value
  if (item.item_type === "consumable") {
    if (!item.effect_type) {
      errors.push("consumable items must have effect_type");
    }
    if (item.effect_value === undefined || item.effect_value === null) {
      errors.push("consumable items must have effect_value");
    }
  }

  // 条件依赖：armor → defense + armor_slot
  if (item.item_type === "armor") {
    if (item.defense === undefined || item.defense === null) {
      errors.push("armor items must have defense");
    }
    if (!item.armor_slot) {
      errors.push("armor items must have armor_slot");
    } else if (!VALID_ARMOR_SLOTS.includes(item.armor_slot)) {
      errors.push(`armor_slot must be one of: ${VALID_ARMOR_SLOTS.join(", ")}`);
    }
  }

  // 可堆叠
  if (item.stackable === true) {
    if (item.stack_max === undefined || item.stack_max === null) {
      errors.push("stackable items must have stack_max");
    } else if (item.stack_max < 1) {
      errors.push("stack_max must be ≥ 1");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
