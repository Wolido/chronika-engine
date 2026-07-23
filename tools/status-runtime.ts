import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { applyStatus, tickStatus } from "../engine/status-runtime";

export function registerStatusRuntimeTools(pi: ExtensionAPI) {
  pi.registerTool({
    name: "status_apply",
    label: "Status Apply",
    description: "Apply a status effect (DOT, HOT, buff, debuff, stun, root) to a target. Refreshes duration if the same effect already exists.",
    parameters: Type.Object({
      effect: Type.Object({
        name: Type.String({ description: "Effect name" }),
        effect_type: Type.String({ description: "dot/hot/buff/debuff/stun/root" }),
        magnitude: Type.Number({ description: "Effect magnitude (negative for DOT/debuff)" }),
        duration: Type.Number({ description: "Duration in turns" }),
      }),
      current_effects: Type.Array(Type.Any(), { description: "Current active effects" }),
    }),
    async execute(_toolCallId, params) {
      const result = applyStatus(params);
      return {
        content: [{ type: "text", text: result.note ?? (result.applied ? "Applied" : "Failed") }],
        details: result,
      };
    },
  });

  pi.registerTool({
    name: "status_tick",
    label: "Status Tick",
    description: "Process one turn of all active status effects. DOTs deal damage, HOTs heal, expired effects are removed. Returns HP changes and remaining effects.",
    parameters: Type.Object({
      active_effects: Type.Array(Type.Any(), { description: "Current active effects" }),
      target_hp: Type.Number({ description: "Current HP" }),
      target_hp_max: Type.Number({ description: "Maximum HP" }),
    }),
    async execute(_toolCallId, params) {
      const result = tickStatus(params);
      if (result.ticks.length === 0) {
        return {
          content: [{ type: "text", text: "⏳ No active status effects to tick." }],
          details: result,
        };
      }
      const lines = result.ticks.map(t =>
        `${t.effect_name}: HP ${t.hp_change >= 0 ? "+" : ""}${t.hp_change} (${t.remaining} turns left${t.expired ? ", expired" : ""})`
      );
      return {
        content: [{
          type: "text",
          text: `⏳ Status tick:\n${lines.join("\n")}\nHP: ${result.hp_after} (${result.hp_change_total >= 0 ? "+" : ""}${result.hp_change_total})`,
        }],
        details: result,
      };
    },
  });
}
