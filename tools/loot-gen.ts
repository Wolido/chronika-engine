import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { generateLoot } from "../engine/loot-gen";

export function registerLootGenTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "generate_loot",
    label: "Generate Loot",
    description: "Generate complete loot from an enemy based on its tier. Always drops caps, with chances for materials, items, and weapons. Weapon rarity follows probability tables: lower tiers mostly common, higher tiers can drop legendary.",
    parameters: Type.Object({
      tier: Type.Number({ description: "Enemy tier 1-5" }),
    }),
    async execute(_toolCallId, params) {
      const result = generateLoot({ tier: params.tier });
      const lines = result.items.map(i => {
        const rarityTag = i.rarity ? ` [${i.rarity}]` : "";
        return `  • ${i.name} ×${i.quantity}${rarityTag}`;
      });
      return {
        content: [{ type: "text", text: `🎒 **Loot from tier ${params.tier} enemy:**\n${lines.join("\n")}` }],
        details: result,
      };
    },
  });
}
