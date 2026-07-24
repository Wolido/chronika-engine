export interface GenerateStockInput {
  type: string;
  db: any;
  location?: string;
}

export interface StockItem {
  name: string;
  quantity: number;
  price_per_unit: number;
}

export interface GenerateStockResult {
  success: boolean;
  items: StockItem[];
  credits: number;
  type: string;
}

const DEFAULT_ITEMS: Record<string, { name: string; value: number }[]> = {
  common: [
    { name: "瓶盖", value: 1 },
  ],
  uncommon: [
    { name: "治疗粉", value: 15 },
    { name: "净水", value: 8 },
    { name: "罐头", value: 10 },
    { name: "弹药", value: 12 },
  ],
  rare: [
    { name: "医疗包", value: 35 },
    { name: "能量电池", value: 25 },
    { name: "精密零件", value: 30 },
  ],
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rollBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickItems(pool: { name: string; value: number }[], count: number): StockItem[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map(i => ({
    name: i.name,
    quantity: rollBetween(1, 5),
    price_per_unit: i.value,
  }));
}

const TYPE_CONFIG: Record<string, { itemCount: [number, number]; creditRange: [number, number]; includeWeapon: boolean }> = {
  villager: { itemCount: [1, 3], creditRange: [10, 50], includeWeapon: false },
  scavenger: { itemCount: [2, 4], creditRange: [20, 80], includeWeapon: false },
  trader: { itemCount: [3, 6], creditRange: [50, 200], includeWeapon: true },
  merchant: { itemCount: [4, 8], creditRange: [100, 500], includeWeapon: true },
};

export function generateStock(input: GenerateStockInput): GenerateStockResult {
  const config = TYPE_CONFIG[input.type] || TYPE_CONFIG.villager;
  const items: StockItem[] = [];

  // Try to get items from database (skip if db is null/undefined)
  const dbItems = input.db ? input.db.exec("SELECT name, value FROM items WHERE value > 0") : [];
  const dbWeapons = input.db ? input.db.exec("SELECT name, value FROM weapons WHERE value > 0") : [];

  if (dbItems.length > 0 && dbItems[0].values.length > 0) {
    // Use database items
    const commonItems: StockItem[] = [];

    for (const row of dbItems[0].values) {
      const name = row[0] as string;
      const value = row[1] as number;
      const item: StockItem = { name, quantity: rollBetween(1, 5), price_per_unit: value };
      commonItems.push(item);
    }

    const itemCount = rollBetween(config.itemCount[0], config.itemCount[1]);
    const shuffled = [...commonItems].sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(itemCount, shuffled.length); i++) {
      items.push(shuffled[i]);
    }

    // Add weapon if configured
    if (config.includeWeapon && dbWeapons.length > 0 && dbWeapons[0].values.length > 0) {
      const weaponRows = dbWeapons[0].values;
      const randomWeapon = weaponRows[Math.floor(Math.random() * weaponRows.length)];
      items.push({
        name: randomWeapon[0] as string,
        quantity: 1,
        price_per_unit: (randomWeapon[1] as number) || 50,
      });
    }
  } else {
    // Use default items
    const itemCount = rollBetween(config.itemCount[0], config.itemCount[1]);
    const halfCommon = Math.ceil(itemCount / 2);
    const halfUncommon = itemCount - halfCommon;

    items.push(...pickItems(DEFAULT_ITEMS.common, halfCommon));
    if (input.type !== "villager") {
      items.push(...pickItems(DEFAULT_ITEMS.uncommon, halfUncommon));
    }
    if (input.type === "merchant") {
      items.push(...pickItems(DEFAULT_ITEMS.rare, 1));
    }
  }

  const credits = rollBetween(config.creditRange[0], config.creditRange[1]);

  return { success: true, items, credits, type: input.type };
}
