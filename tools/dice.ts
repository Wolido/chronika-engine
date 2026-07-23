import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { rollDice } from "../engine/dice";

export function registerDiceTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "dice",
    label: "Dice",
    description: "Roll dice using standard notation. Examples: '2d6', '1d20+3', 'd100', '3d8+2d6-1'. Returns individual rolls and total.",
    parameters: Type.Object({
      notation: Type.String({ 
        description: "Dice notation, e.g. '2d6', '1d20+3', 'd100', '3d8+2d6-1'" 
      }),
    }),
    async execute(_toolCallId, params) {
      const result = rollDice(params.notation);
      
      // Build a human-readable breakdown
      const parts: string[] = [];
      for (let i = 0; i < result.terms.length; i++) {
        const term = result.terms[i];
        const rolls = `[${term.rolls.join(", ")}]`;
        if (i === 0) {
          parts.push(term.subtotal >= 0 ? rolls : `-${rolls}`);
        } else {
          parts.push(term.subtotal >= 0 ? ` + ${rolls}` : ` - ${rolls}`);
        }
      }
      for (const mod of result.modifiers) {
        parts.push(mod >= 0 ? ` + ${mod}` : ` - ${Math.abs(mod)}`);
      }
      const breakdown = parts.length > 0 ? ` (${parts.join("")})` : "";

      return {
        content: [{ 
          type: "text", 
          text: `🎲 **${result.expression}** → **${result.total}**${breakdown}` 
        }],
        details: result,
      };
    },
  });
}
