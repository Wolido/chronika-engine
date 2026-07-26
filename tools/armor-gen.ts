import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { generateArmor } from "../engine/armor-gen";

export function registerArmorGenTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "generate_armor",
    label: "Generate Armor",
    description: "Generate a random armor piece (head/chest/legs) with defense, weight, and optional legendary effect. Returns mechanical data only — the LLM must invent the armor name, legendary effect name, and flavor description. Use db_exec to write the completed armor to the database.",
    parameters: Type.Object({
      slot: Type.Optional(Type.String({ description: "Armor slot: head/chest/legs (random if omitted)" })),
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
      const result = generateArmor(params);
      const a = result.armor;
      const namePlaceholder = "(unnamed — invent a name)";
      const legendaryLine = a.legendary_effect ? `\n⭐ Legendary trigger: ${a.legendary_effect.trigger} | ${a.legendary_effect.effect_type} (×${a.legendary_effect.magnitude})\n   Effect name and description: (LLM fills)` : "";

      // Appropriateness warnings
      let warnLine = "";
      if (result.appropriateness_warnings && result.appropriateness_warnings.length > 0) {
        warnLine = `\n\n⚠️ **GM Review:** 以下组合可能需要检查：\n${result.appropriateness_warnings.map(w => `  • ${w}`).join("\n")}\n如果不合适，请重新调用 generate_armor。`;
      } else if (a.legendary_effect) {
        warnLine = `\n\n✅ 传奇特效与防具匹配。`;
      }

      return {
        content: [{
          type: "text",
          text: `**${namePlaceholder}** (${a.rarity})\nSlot: ${a.slot}\nDefense: ${a.defense}\nTier: ${a.tier}, Weight: ${a.weight}, Value: ${a.value}${legendaryLine}${warnLine}\n\n✏️ Invent a name and description for this armor, then write it to the database.`,
        }],
        details: result,
      };
    },
  });
}
