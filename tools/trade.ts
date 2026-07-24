import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import { trade } from "../engine/trade";

export function registerTradeTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "trade",
    label: "Trade",
    description: "Buy or sell items. When buying, checks if the player has enough credits. When selling, adds credits to the player. Price modifier scales all prices (1.0 = default, 0.8 = 20% off, 1.2 = 20% markup).\n\nBarter skill affects prices: -2% per point when buying, +2% per point when selling (additive with price_modifier). Persuade skill adds ±1% (half of barter), stacks with barter.",
    parameters: Type.Object({
      credits: Type.Number({ description: "Current credits/money" }),
      items: Type.Array(Type.Object({
        item_name: Type.String({ description: "Item name" }),
        quantity: Type.Number({ description: "Quantity" }),
        price_per_unit: Type.Number({ description: "Price per unit" }),
      })),
      mode: StringEnum(["buy", "sell"] as const, { description: "Buy or sell mode" }),
      price_modifier: Type.Optional(Type.Number({ description: "Price modifier (default 1.0)" })),
      barter: Type.Optional(Type.Number({ description: "Barter skill: -2% buy price, +2% sell price per point." })),
      persuade: Type.Optional(Type.Number({ description: "Persuade skill: ±1% per point, stacks with barter." })),
    }),
    async execute(_toolCallId, params) {
      const result = trade(params);
      if (!result.success) {
        return {
          content: [{ type: "text", text: `❌ ${result.reason}` }],
          details: result,
          isError: true,
        };
      }

      const modeLabel = params.mode === "buy" ? "🛒 Bought" : "💰 Sold";
      return {
        content: [{
          type: "text",
          text: `${modeLabel} for ${result.total_cost} credits\nCredits: ${result.credits_before} → ${result.credits_after}`,
        }],
        details: result,
      };
    },
  });
}
