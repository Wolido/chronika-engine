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
      min_rarity: Type.Optional(Type.String({ description: "Minimum rarity: common/uncommon/rare/legendary" })),
      max_rarity: Type.Optional(Type.String({ description: "Maximum rarity: common/uncommon/rare/legendary" })),
      name_hint: Type.Optional(Type.String({ description: "Optional name hint" })),
      tier: Type.Optional(Type.Number({ description: "Tier 1-5" })),
    }),
    async execute(_toolCallId, params) {
      const result = generateWeapon(params);
      const w = result.weapon;
      const elementLine = w.element ? `\nElement: ${w.element.element_type} (${Math.round(w.element.proc_chance * 100)}% proc)` : "";
      const namePlaceholder = w.name ? w.name : "(unnamed — invent a name)";
      const legendaryLine = w.legendary_effect ? `\n⭐ Legendary trigger: ${w.legendary_effect.trigger} | ${w.legendary_effect.effect_type} (×${w.legendary_effect.magnitude})\n   Effect name and description: (LLM fills)` : "";
      return {
        content: [{
          type: "text",
          text: `**${namePlaceholder}** (${w.rarity})\nDamage: ${w.damage_min}-${w.damage_max} ${w.damage_type}\nAccuracy: ${w.accuracy}\nTier: ${w.tier}, Value: ${w.value}${elementLine}${legendaryLine}\n\n✏️ Invent a name and description for this weapon, then write it to the database.`,
        }],
        details: result,
      };
    },
  });
}
