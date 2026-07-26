import type { AccessoryData } from "./legendary-gen.ts";

export interface TradeItem {
  item_name: string;
  quantity: number;
  price_per_unit: number;
}

export interface TradeInput {
  credits: number;
  items: TradeItem[];
  mode: "buy" | "sell";
  price_modifier?: number;
  barter?: number;
  accessories?: AccessoryData[];
}

export interface TradeResult {
  success: boolean;
  total_cost: number;
  credits_before: number;
  credits_after: number;
  items_traded: { item_name: string; quantity: number }[];
  accessory_discount?: number;
  accessory_sell_bonus?: number;
  reason?: string;
}

export function trade(input: TradeInput): TradeResult {
  const modifier = input.price_modifier ?? 1.0;
  // Apply skill modifiers (additive)
  let skillMod = 0;
  if (input.barter) {
    skillMod += input.mode === "buy" ? -input.barter * 0.02 : input.barter * 0.02;
  }
  // 饰品价格修正（on_trade / passive 触发器）
  let accessoryDiscount = 0;
  let accessorySellBonus = 0;
  for (const acc of input.accessories ?? []) {
    if (acc.trigger !== "on_trade" && acc.trigger !== "passive") continue;
    if (acc.effect_type === "trade_discount" && input.mode === "buy") accessoryDiscount += acc.magnitude;
    else if (acc.effect_type === "sell_bonus" && input.mode === "sell") accessorySellBonus += acc.magnitude;
  }
  const accessoryFields = {
    accessory_discount: accessoryDiscount > 0 ? accessoryDiscount : undefined,
    accessory_sell_bonus: accessorySellBonus > 0 ? accessorySellBonus : undefined,
  };
  const finalModifier = modifier + skillMod - accessoryDiscount + accessorySellBonus;
  // Clamp: 折扣叠加（accessoryDiscount + barter + price_modifier）不得使价格系数变负
  const clampedModifier = Math.max(0, finalModifier);
  const totalCost = Math.round(
    input.items.reduce((sum, item) => sum + item.quantity * item.price_per_unit, 0) * clampedModifier
  );

  if (input.mode === "buy") {
    if (input.credits < totalCost) {
      return {
        success: false,
        total_cost: totalCost,
        credits_before: input.credits,
        credits_after: input.credits,
        items_traded: [],
        ...accessoryFields,
        reason: `Not enough credits. Need ${totalCost}, have ${input.credits}.`,
      };
    }
    return {
      success: true,
      total_cost: totalCost,
      credits_before: input.credits,
      credits_after: input.credits - totalCost,
      items_traded: input.items.map(i => ({ item_name: i.item_name, quantity: i.quantity })),
      ...accessoryFields,
    };
  }

  // sell mode
  return {
    success: true,
    total_cost: totalCost,
    credits_before: input.credits,
    credits_after: input.credits + totalCost,
    items_traded: input.items.map(i => ({ item_name: i.item_name, quantity: i.quantity })),
    ...accessoryFields,
  };
}
