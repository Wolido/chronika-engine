import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { consumeItem } from "../engine/consume";

export function registerConsumeTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "consume",
    label: "Consume",
    description: "Use a consumable item on a target. Supports heal (restore HP up to max), damage (deal HP damage, min 0), and restore (fully heal to max HP).\n\nMedicine skill increases healing amount: +floor(medicine × 1.5) HP for heal effects.",
    parameters: Type.Object({
      item: Type.Object({
        name: Type.String({ description: "Item name" }),
        effect_type: Type.String({ description: "Effect type: heal/damage/restore" }),
        effect_value: Type.Number({ description: "Effect magnitude" }),
      }),
      target: Type.Object({
        hp: Type.Number({ description: "Current HP" }),
        hp_max: Type.Number({ description: "Maximum HP" }),
      }),
      medicine: Type.Optional(Type.Number({ description: "Medicine skill — increases heal amount" })),
    }),
    async execute(_toolCallId, params) {
      const result = consumeItem(params);
      return {
        content: [{ type: "text", text: `💊 **${params.item.name}**: ${result.detail}` }],
        details: result,
      };
    },
  });
}
