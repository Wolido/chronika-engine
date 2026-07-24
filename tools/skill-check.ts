import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { skillCheck } from "../engine/skill-check";

export function registerSkillCheckTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "skill_check",
    label: "Skill Check",
    description: "Perform an attribute or skill check by rolling 1d20 + modifier against a difficulty (1-30). The modifier should be calculated from the player's attribute: (attribute_value - 5). For example, agility=8 gives modifier=+3 for stealth checks. Returns success/failure, roll, total, margin, and critical status (margin ≥ 10 = critical).",
    parameters: Type.Object({
      difficulty: Type.Number({ description: "Difficulty threshold (1-30)" }),
      modifier: Type.Optional(Type.Number({ description: "Attribute or skill modifier (default 0)" })),
    }),
    async execute(_toolCallId, params) {
      const result = skillCheck({
        difficulty: params.difficulty,
        modifier: params.modifier ?? 0,
      });

      const status = result.success ? "✅ Success" : "❌ Failure";
      const crit = result.critical
        ? result.success
          ? " CRITICAL SUCCESS!"
          : " CRITICAL FAILURE!"
        : "";
      const marginStr = result.margin >= 0
        ? `margin: +${result.margin}`
        : `margin: ${result.margin}`;

      return {
        content: [{
          type: "text",
          text: `🎲 **1d20** → ${result.roll}${params.modifier ? ` + ${params.modifier}` : ""} = **${result.total}** vs ${result.difficulty}\n${status}${crit} (${marginStr})`,
        }],
        details: result,
      };
    },
  });
}
