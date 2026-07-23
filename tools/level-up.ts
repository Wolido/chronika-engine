import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { levelUp } from "../engine/level-up";

export function registerLevelUpTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "level_up",
    label: "Level Up",
    description: "Check if enough XP is accumulated to level up. Supports multi-level-up and custom XP formulas.",
    parameters: Type.Object({
      level: Type.Number({ description: "Current level" }),
      xp: Type.Number({ description: "Current XP" }),
      xp_for_next: Type.Optional(Type.Number({ description: "XP multiplier per level (default: 100)" })),
      attribute_points: Type.Optional(Type.Number({ description: "Attribute points per level (default: 2)" })),
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
          text: `⬆️ **Level Up!** ${params.level} → ${result.new_level}\nXP remaining: ${result.xp_remaining}\nAttribute points gained: ${result.attribute_points_gained}`,
        }],
        details: result,
      };
    },
  });
}
