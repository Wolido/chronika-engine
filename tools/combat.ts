import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { combatResolve } from "../engine/combat";

export function registerCombatTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "combat_resolve",
    label: "Combat Resolve",
    description: "Resolve a single combat action: hit check, damage calculation (with strength bonus and armor absorption), and elemental effect proc. Returns full combat result including remaining HP.",
    parameters: Type.Object({
      attacker: Type.Object({
        stats: Type.Object({
          strength: Type.Number({ description: "Attacker's strength (0-20)" }),
          agility: Type.Number({ description: "Attacker's agility (0-20)" }),
          endurance: Type.Number({ description: "Attacker's endurance (0-20)" }),
          perception: Type.Number({ description: "Attacker's perception (0-20)" }),
          intelligence: Type.Number({ description: "Attacker's intelligence (0-20)" }),
          willpower: Type.Number({ description: "Attacker's willpower (0-20)" }),
        }),
        weapon: Type.Object({
          damage_min: Type.Number({ description: "Minimum weapon damage" }),
          damage_max: Type.Number({ description: "Maximum weapon damage" }),
          accuracy: Type.Number({ description: "Weapon accuracy (0.0-1.0)" }),
          damage_type: Type.String({ description: "Damage type: slashing/piercing/bludgeoning/thermal/explosive/chemical" }),
        }),
        element: Type.Optional(Type.Object({
          element_type: Type.String({ description: "Element type: fire/corrosive/shock/frost/radiation/explosive/venom/void" }),
          proc_chance: Type.Number({ description: "Element proc chance (0.0-1.0)" }),
        })),
        legendary: Type.Optional(Type.Object({
          effect_name: Type.String({ description: "Legendary effect name" }),
          trigger: Type.String({ description: "Trigger condition: on_hit, on_kill, on_crit" }),
          effect_type: Type.String({ description: "Effect type: multiply_damage, lifesteal, aoe_explosion" }),
          magnitude: Type.Number({ description: "Effect magnitude multiplier (e.g. 2.0 for double damage)" }),
        })),
      }),
      defender: Type.Object({
        evasion: Type.Number({ description: "Defender's evasion (0.0-1.0)" }),
        armor: Type.Number({ description: "Defender's armor value" }),
        hp: Type.Number({ description: "Defender's current HP" }),
      }),
    }),
    async execute(_toolCallId, params) {
      const result = combatResolve(params as any);

      if (!result.hit) {
        return {
          content: [{ type: "text", text: `🛡️ **Miss!** Rolled ${result.hit_roll} (needed ≤ ${result.hit_threshold})` }],
          details: result,
        };
      }

      const elementLine = result.elemental_proc
        ? `\n⚡ **Element proc!** ${result.elemental_detail}`
        : "";

      const legendaryLine = result.legendary_triggered
        ? `\n🌟 **Legendary triggered!** ${result.legendary_detail}`
        : "";

      const killLine = result.killed ? "\n💀 **Target defeated!**" : "";

      return {
        content: [{
          type: "text",
          text: [
            `🎯 **Hit!** Rolled ${result.hit_roll} (needed ≤ ${result.hit_threshold})`,
            `⚔️ Base damage: ${result.damage_raw} + strength bonus ${result.strength_bonus} = ${result.damage_raw + result.strength_bonus}`,
            `🛡️ Armor absorbed: ${result.damage_absorbed}`,
            `💥 **Final damage: ${result.damage_final}** (${result.damage_type})`,
            `❤️ Defender HP: ${result.hp_remaining + result.damage_final} → ${result.hp_remaining}`,
            elementLine,
            legendaryLine,
            killLine,
          ].filter(Boolean).join("\n"),
        }],
        details: result,
      };
    },
  });
}
