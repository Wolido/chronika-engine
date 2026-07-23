export type SlotName = "weapon" | "head" | "chest" | "legs" | "accessory1" | "accessory2";

export const SLOT_ARMOR_MAP: Record<string, string[]> = {
  head: ["head"],
  chest: ["chest"],
  legs: ["legs"],
  accessory1: [],
  accessory2: [],
  weapon: [],
};

export const SLOT_LABELS: Record<string, string> = {
  weapon: "武器",
  head: "头盔",
  chest: "胸甲",
  legs: "腿甲",
  accessory1: "饰品1",
  accessory2: "饰品2",
};

export interface EquippedItem {
  name: string;
  item_type: string;
  armor_slot?: string;
  defense?: number;
  stat_bonuses?: Record<string, number>;
  weight?: number;
  [key: string]: any;
}

export type Equipment = Partial<Record<SlotName, EquippedItem>>;

export interface EquipInput {
  slot: SlotName;
  item: EquippedItem;
  current_equipment: Equipment;
}

export interface UnequipInput {
  slot: SlotName;
  current_equipment: Equipment;
}

export interface EquipResult {
  success: boolean;
  slot: string;
  item_equipped: string;
  item_removed?: string;
  stat_changes: Record<string, number>;
  error?: string;
}

export interface UnequipResult {
  success: boolean;
  slot: string;
  item_removed?: string;
  stat_changes: Record<string, number>;
  error?: string;
}

export interface EquipmentStats {
  total_defense: number;
  stat_bonuses: Record<string, number>;
  equipped_items: { slot: string; name: string }[];
}

function computeStatChanges(item: EquippedItem, sign: number): Record<string, number> {
  const changes: Record<string, number> = {};
  if (item.defense) {
    changes.defense = (changes.defense || 0) + item.defense * sign;
  }
  if (item.stat_bonuses) {
    for (const [key, val] of Object.entries(item.stat_bonuses)) {
      changes[key] = (changes[key] || 0) + val * sign;
    }
  }
  return changes;
}

function mergeStatChanges(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const result = { ...a };
  for (const [key, val] of Object.entries(b)) {
    result[key] = (result[key] || 0) + val;
  }
  return result;
}

export function equipItem(input: EquipInput): EquipResult {
  const { slot, item, current_equipment } = input;

  if (item.item_type === "armor" && item.armor_slot) {
    const validSlots = SLOT_ARMOR_MAP[slot] || [];
    if (validSlots.length > 0 && !validSlots.includes(item.armor_slot)) {
      return { success: false, slot, item_equipped: item.name, stat_changes: {}, error: `Armor slot "${item.armor_slot}" does not match equipment slot "${slot}"` };
    }
  }

  const existing = current_equipment[slot];
  let statChanges: Record<string, number> = {};
  if (existing) statChanges = mergeStatChanges(statChanges, computeStatChanges(existing, -1));
  statChanges = mergeStatChanges(statChanges, computeStatChanges(item, 1));

  return { success: true, slot, item_equipped: item.name, item_removed: existing?.name, stat_changes: statChanges };
}

export function unequipItem(input: UnequipInput): UnequipResult {
  const existing = input.current_equipment[input.slot];
  if (!existing) {
    return { success: false, slot: input.slot, stat_changes: {}, error: `Nothing equipped in slot "${input.slot}"` };
  }
  return { success: true, slot: input.slot, item_removed: existing.name, stat_changes: computeStatChanges(existing, -1) };
}

export function calculateEquipmentStats(equipment: Equipment): EquipmentStats {
  let totalDefense = 0;
  const statBonuses: Record<string, number> = {};
  const equippedItems: { slot: string; name: string }[] = [];

  for (const [slot, item] of Object.entries(equipment)) {
    if (!item) continue;
    if (item.defense) totalDefense += item.defense;
    if (item.stat_bonuses) {
      for (const [key, val] of Object.entries(item.stat_bonuses)) {
        statBonuses[key] = (statBonuses[key] || 0) + val;
      }
    }
    equippedItems.push({ slot, name: item.name });
  }

  return { total_defense: totalDefense, stat_bonuses: statBonuses, equipped_items: equippedItems };
}
