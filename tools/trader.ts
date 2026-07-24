import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getSQL } from "../db/connection";
import { generateStock } from "../engine/trader";

export function registerTraderTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "generate_stock",
    label: "Generate Stock",
    description: "Generate a random trader's inventory based on NPC type. Villagers carry few common items, merchants carry many items including weapons. Call this when the player wants to trade with an NPC, then pass the items to the trade tool.",
    parameters: Type.Object({
      db_path: Type.String({ description: "Path to game database" }),
      type: Type.String({ description: "NPC type: villager/scavenger/trader/merchant" }),
    }),
    async execute(_toolCallId, params) {
      const SQL = await getSQL();
      const resolved = params.db_path.startsWith("/") ? params.db_path : resolve(process.cwd(), params.db_path);
      const buffer = readFileSync(resolved);
      const db = new SQL.Database(buffer);

      const result = generateStock({ type: params.type, db });
      db.close();

      const lines = result.items.map(i => `  • ${i.name} ×${i.quantity} — ${i.price_per_unit} caps each`);
      return {
        content: [{
          type: "text",
          text: `💰 **${params.type}** has ${result.items.length} items and ${result.credits} caps.\n${lines.join("\n")}`,
        }],
        details: result,
      };
    },
  });
}
