import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { generateWeapon } from "../engine/weapon-gen";

export function registerWeaponGenTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "generate_weapon",
    label: "Generate Weapon",
    description: "Generate a random weapon with stats based on rarity and type. Legendary weapons come with unique effects. Use this when enemies drop weapons, the player finds a cache, or as a quest reward. The weapon is returned as data — use db_exec to save it to the database.",
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
      const legendaryLine = w.legendary_effect ? `\n⭐ Legendary: ${w.legendary_effect.effect_name} — ${w.legendary_effect.description}` : "";
      return {
        content: [{
          type: "text",
          text: `**${w.name}** (${w.rarity})\nDamage: ${w.damage_min}-${w.damage_max} ${w.damage_type}\nAccuracy: ${w.accuracy}\nTier: ${w.tier}, Value: ${w.value}${elementLine}${legendaryLine}`,
        }],
        details: result,
      };
    },
  });
}
