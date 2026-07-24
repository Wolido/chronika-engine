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
}

export interface TradeResult {
  success: boolean;
  total_cost: number;
  credits_before: number;
  credits_after: number;
  items_traded: { item_name: string; quantity: number }[];
  reason?: string;
}

export function trade(input: TradeInput): TradeResult {
  const modifier = input.price_modifier ?? 1.0;
  // Apply barter modifier (additive with price_modifier)
  let barterMod = 0;
  if (input.barter) {
    barterMod = input.mode === "buy" ? -input.barter * 0.02 : input.barter * 0.02;
  }
  const finalModifier = modifier + barterMod;
  const totalCost = Math.round(
    input.items.reduce((sum, item) => sum + item.quantity * item.price_per_unit, 0) * finalModifier
  );

  if (input.mode === "buy") {
    if (input.credits < totalCost) {
      return {
        success: false,
        total_cost: totalCost,
        credits_before: input.credits,
        credits_after: input.credits,
        items_traded: [],
        reason: `Not enough credits. Need ${totalCost}, have ${input.credits}.`,
      };
    }
    return {
      success: true,
      total_cost: totalCost,
      credits_before: input.credits,
      credits_after: input.credits - totalCost,
      items_traded: input.items.map(i => ({ item_name: i.item_name, quantity: i.quantity })),
    };
  }

  // sell mode
  return {
    success: true,
    total_cost: totalCost,
    credits_before: input.credits,
    credits_after: input.credits + totalCost,
    items_traded: input.items.map(i => ({ item_name: i.item_name, quantity: i.quantity })),
  };
}
