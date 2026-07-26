import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { generateWeapon } from "../engine/weapon-gen";

export function registerWeaponGenTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "generate_weapon",
    label: "Generate Weapon",
    description: "Generate a random weapon with stats, element, and optional legendary effect. Returns mechanical data only — the LLM must invent the weapon name, legendary effect name, and flavor description. Use db_exec to write the completed weapon to the database.",
    parameters: Type.Object({
      weapon_type: Type.Optional(Type.String({ description: "melee/ranged/thrown (random if omitted)" })),
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
      name_hint: Type.Optional(Type.String({ description: "Optional name hint" })),
      tier: Type.Optional(Type.Number({ description: "Tier 1-5" })),
    }),
    async execute(_toolCallId, params) {
      const result = generateWeapon(params);
      const w = result.weapon;
      const elementLine = w.element ? `\nElement: ${w.element.element_type} (${Math.round(w.element.proc_chance * 100)}% proc)` : "";
      const namePlaceholder = w.name ? w.name : "(unnamed — invent a name)";
      const legendaryLine = w.legendary_effect ? `\n⭐ Legendary trigger: ${w.legendary_effect.trigger} | ${w.legendary_effect.effect_type} (×${w.legendary_effect.magnitude})\n   Effect name and description: (LLM fills)` : "";

      // Appropriateness warnings
      let warnLine = "";
      if (result.appropriateness_warnings && result.appropriateness_warnings.length > 0) {
        warnLine = `\n\n⚠️ **GM Review:** 以下组合可能需要检查：\n${result.appropriateness_warnings.map(w => `  • ${w}`).join("\n")}\n如果不合适，请重新调用 generate_weapon。`;
      } else if (w.legendary_effect) {
        warnLine = `\n\n✅ 传奇特效与武器类型匹配。`;
      }

      return {
        content: [{
          type: "text",
          text: `**${namePlaceholder}** (${w.rarity})\nDamage: ${w.damage_min}-${w.damage_max} ${w.damage_type}\nAccuracy: ${w.accuracy}\nTier: ${w.tier}, Value: ${w.value}${elementLine}${legendaryLine}${warnLine}\n\n✏️ Invent a name and description for this weapon, then write it to the database.`,
        }],
        details: result,
      };
    },
  });
}
