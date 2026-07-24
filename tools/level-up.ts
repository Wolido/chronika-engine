import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { levelUp } from "../engine/level-up";

export function registerLevelUpTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "level_up",
    label: "Level Up",
    description: "Check if enough XP is accumulated to level up. Each level grants 1 attribute point (for strength/agility/endurance/perception/intelligence/willpower) and 3 skill points (for barter/persuasion/survival/medicine/mechanics/stealth). The GM should query the player's current stats, let them allocate points, and save via db_exec.",
    parameters: Type.Object({
      level: Type.Number({ description: "Current level" }),
      xp: Type.Number({ description: "Current XP" }),
      xp_for_next: Type.Optional(Type.Number({ description: "XP multiplier per level (default: 100)" })),
      attribute_points: Type.Optional(Type.Number({ description: "Attribute points per level (default: 1)" })),
      skill_points: Type.Optional(Type.Number({ description: "Skill points per level (default: 3)" })),
    }),
    async execute(_toolCallId, params) {
      const result = levelUp(params);
      if (!result.leveled_up) {
        return {
          content: [{
            type: "text",
            text: `📊 Level ${result.new_level} — ${result.xp_remaining}/${result.xp_for_next} XP to next level`,
          }],
          details: result,
        };
      }
      return {
        content: [{
          type: "text",
          text: `⬆️ **Level Up!** ${params.level} → ${result.new_level}\n`
            + `XP remaining: ${result.xp_remaining}\n`
            + `Attribute points gained: ${result.attribute_points_gained}\n`
            + `Skill points gained: ${result.skill_points_gained}`,
        }],
        details: result,
      };
    },
  });
}
