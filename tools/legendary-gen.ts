import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { generateSeed, validateLegendaryEffect, validateLegendaryForWeapon } from "../engine/legendary-gen";

export function registerLegendaryGenTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "legendary_gen",
    label: "Legendary Gen",
    description: "Generate or validate legendary weapon effects. Use 'seed' mode to get a random effect template (trigger + effect type + magnitude range), then have the LLM fill in the name and description. Use 'validate' mode to check if a legendary effect is within game balance constraints.",
    parameters: Type.Object({
      mode: Type.String({ description: "'seed' to generate a random effect template, 'validate' to check a complete effect" }),
      effect: Type.Optional(Type.Any({ description: "Complete legendary effect to validate (for validate mode)" })),
      weapon_tier: Type.Optional(Type.Number({ description: "Weapon tier 1-5 (for validate mode)" })),
      weapon_context: Type.Optional(Type.Object({
        weapon_type: Type.String({ description: "Weapon type: melee/ranged/thrown" }),
        tier: Type.Number({ description: "Weapon tier 1-5" }),
        damage_type: Type.Optional(Type.String()),
        ammo_type: Type.Optional(Type.String()),
      })),
    }),
    async execute(_toolCallId, params) {
      if (params.mode === "seed") {
        const seed = generateSeed();
        return {
          content: [{
            type: "text",
            text: `🎲 **Legendary Seed Generated**\nTrigger: **${seed.trigger}**\nEffect: **${seed.effect_type}**\nMagnitude range: ${seed.magnitude_min}× – ${seed.magnitude_max}×\n\nTemplate: _${seed.description_template}_\n\nNow invent a name and write the description!`,
          }],
          details: { seed },
        };
      }

      if (params.mode === "validate") {
        const result = validateLegendaryEffect({
          effect: params.effect as any,
          weapon_tier: params.weapon_tier ?? 3,
        });
        if (!result.valid) {
          return {
            content: [{ type: "text", text: `❌ Validation failed:\n${result.errors.map(e => `  • ${e}`).join("\n")}` }],
            details: result,
            isError: true,
          };
        }
        // Weapon-appropriateness check (optional)
        let allWarnings = [...result.warnings];
        if (params.weapon_context) {
          const wc = params.weapon_context;
          const wv = validateLegendaryForWeapon(params.effect as any, wc as any);
          allWarnings = [...allWarnings, ...wv.warnings];
        }
        const warnStr = allWarnings.length > 0 ? `\n⚠️ Warnings:\n${allWarnings.map(w => `  • ${w}`).join("\n")}` : "";
        return {
          content: [{ type: "text", text: `✅ Legendary effect "${params.effect.name}" is valid.${warnStr}` }],
          details: result,
        };
      }

      return {
        content: [{ type: "text", text: `❌ Unknown mode: ${params.mode}. Use 'seed' or 'validate'.` }],
        details: {},
        isError: true,
      };
    },
  });
}
