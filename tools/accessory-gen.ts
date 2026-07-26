import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { generateAccessory } from "../engine/accessory-gen";

export function registerAccessoryGenTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "generate_accessory",
    label: "Generate Accessory",
    description: "Generate a random accessory (ring/amulet/trinket/charm) with value and optional legendary effect. Returns mechanical data only — the LLM must invent the accessory name, legendary effect name, and flavor description. Use db_exec to write the completed accessory to the database.",
    parameters: Type.Object({
      accessory_type: Type.Optional(Type.String({ description: "Accessory type: ring/amulet/trinket/charm (random if omitted)" })),
      min_rarity: Type.Optional(Type.Enum({
        common: "common",
        uncommon: "uncommon",
        rare: "rare",
        legendary: "legendary",
      } as const, { description: "Minimum rarity" })),
      max_rarity: Type.Optional(Type.Enum({
        common: "common",
        uncommon: "uncommon",
        rare: "rare",
        legendary: "legendary",
      } as const, { description: "Maximum rarity" })),
      tier: Type.Optional(Type.Number({ description: "Tier 1-5" })),
    }),
    async execute(_toolCallId, params) {
      const result = generateAccessory(params);
      const a = result.accessory;
      const namePlaceholder = "(unnamed — invent a name)";
      const legendaryLine = a.legendary_effect ? `\n⭐ Legendary trigger: ${a.legendary_effect.trigger} | ${a.legendary_effect.effect_type} (×${a.legendary_effect.magnitude})\n   Effect name and description: (LLM fills)` : "";

      return {
        content: [{
          type: "text",
          text: `**${namePlaceholder}** (${a.rarity})\nType: ${a.accessory_type}\nTier: ${a.tier}, Value: ${a.value}${legendaryLine}\n\n✏️ Invent a name and description for this accessory, then write it to the database.`,
        }],
        details: result,
      };
    },
  });
}
