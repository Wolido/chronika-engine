import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { rollLoot } from "../engine/loot";

export function registerLootTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "loot",
    label: "Loot",
    description: "Roll on a loot table to determine what a wasteland corpse, container, or scavenge spot yields. Items include scrap metal, bottle caps, food, medicine, weapon parts, and rare finds.\n\nSurvival skill increases maximum drop quantities: floor(survival / 3) added to quantity_max.",
    parameters: Type.Object({
      table: Type.Array(Type.Object({
        item_name: Type.String({ description: "Item name" }),
        drop_chance: Type.Number({ description: "Drop chance (0.0-1.0)" }),
        quantity_min: Type.Number({ description: "Minimum quantity" }),
        quantity_max: Type.Number({ description: "Maximum quantity" }),
      }), { description: "Array of loot table entries" }),
      luck_modifier: Type.Optional(Type.Number({ description: "Luck modifier added to drop chances (default 0)" })),
      survival: Type.Optional(Type.Number({ description: "Survival skill level — increases max drop quantity" })),
    }),

    async execute(_toolCallId, params) {
      const result = rollLoot({
        table: params.table,
        luck_modifier: params.luck_modifier ?? 0,
      });

      if (result.items.length === 0) {
        return {
          content: [{ type: "text", text: "🍃 Nothing dropped." }],
          details: result,
        };
      }

      const lines = result.items.map(i => `  • ${i.quantity}x ${i.item_name}`);

      return {
        content: [{
          type: "text",
          text: `🎒 **Loot:**\n${lines.join("\n")}`,
        }],
        details: result,
      };
    },
  });
}
