import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { craftItem } from "../engine/craft";

export function registerCraftTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "craft",
    label: "Craft",
    description: "Attempt to craft an item from a recipe. Checks if the player has all required ingredients, then returns what was consumed and produced. Fails with details if ingredients are missing.",
    parameters: Type.Object({
      recipe: Type.Object({
        result_item: Type.String({ description: "Item to craft" }),
        result_quantity: Type.Number({ description: "Quantity produced" }),
        ingredients: Type.Array(Type.Object({
          item_name: Type.String({ description: "Required ingredient" }),
          quantity: Type.Number({ description: "Quantity needed" }),
        })),
      }),
      inventory: Type.Array(Type.Object({
        item_name: Type.String({ description: "Item name" }),
        quantity: Type.Number({ description: "Quantity held" }),
      }), { description: "Current player inventory" }),
    }),
    async execute(_toolCallId, params) {
      const result = craftItem(params);
      if (!result.success) {
        const lines = result.missing_ingredients!.map(
          m => `  • ${m.item_name}: need ${m.needed}, have ${m.have}`
        );
        return {
          content: [{ type: "text", text: `❌ **Missing ingredients:**\n${lines.join("\n")}` }],
          details: result,
          isError: true,
        };
      }
      return {
        content: [{
          type: "text",
          text: `🔧 **Crafted!** ${result.items_produced![0].quantity}x ${result.items_produced![0].item_name}\nConsumed: ${result.items_consumed!.map(c => `${c.quantity}x ${c.item_name}`).join(", ")}`,
        }],
        details: result,
      };
    },
  });
}
