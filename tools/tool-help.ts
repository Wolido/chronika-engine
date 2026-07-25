import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { getToolHelp } from "../engine/tool-help";

export function registerToolHelpTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "tool_help",
    label: "Tool Help",
    description: "Get the full parameter schema and constraints for any Chronika tool. Use when you need to know what fields a tool requires. Call with 'list' to see all available tools.",
    parameters: Type.Object({
      name: Type.String({ description: "Tool name to look up, or 'list' for all tools" }),
    }),
    async execute(_toolCallId, params) {
      const result = getToolHelp(params.name);
      if (!result.found) {
        return { content: [{ type: "text", text: `❌ ${result.error}` }], details: result, isError: true };
      }

      const lines: string[] = [`**${result.tool.name}** — ${result.tool.description}`];
      if (result.tool.parameters.length > 0) {
        lines.push("", "**Parameters:**");
        for (const p of result.tool.parameters) {
          const req = p.required ? "(required)" : "(optional)";
          const constraintStr = p.constraints ? ` — ${p.constraints}` : "";
          lines.push(`  • \`${p.name}\` ${p.type} ${req}: ${p.description}${constraintStr}`);
        }
      }
      if (result.tool.example_call) {
        lines.push("", "**Example:**");
        lines.push(`\`\`\`\n${result.tool.example_call}\n\`\`\``);
      }

      return { content: [{ type: "text", text: lines.join("\n") }], details: result };
    },
  });
}
