export interface LootEntry {
  item_name: string;
  drop_chance: number;
  quantity_min: number;
  quantity_max: number;
}

export interface LootInput {
  table: LootEntry[];
  luck_modifier?: number;
  survival?: number;
}

export interface LootItem {
  item_name: string;
  quantity: number;
}

export interface LootRoll {
  item_name: string;
  rolled: number;
  threshold: number;
  dropped: boolean;
}

export interface LootResult {
  items: LootItem[];
  rolls: LootRoll[];
}

function rollD100(): number {
  return Math.floor(Math.random() * 100) + 1;
}

function rollBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function rollLoot(input: LootInput): LootResult {
  const items: LootItem[] = [];
  const rolls: LootRoll[] = [];
  const luckBonus = (input.luck_modifier ?? 0) * 100;

  for (const entry of input.table) {
    const threshold = Math.max(0, Math.min(100, Math.round(entry.drop_chance * 100 + luckBonus)));
    const rolled = rollD100();
    const dropped = rolled <= threshold;

    rolls.push({
      item_name: entry.item_name,
      rolled,
      threshold,
      dropped,
    });

    if (dropped) {
      const survivalBonus = input.survival ? Math.floor(input.survival / 3) : 0;
      const quantity = rollBetween(entry.quantity_min, entry.quantity_max + survivalBonus);
      items.push({ item_name: entry.item_name, quantity });
    }
  }

  return { items, rolls };
}
