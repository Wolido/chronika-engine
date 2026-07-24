import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getSQL } from "../db/connection";
import { takeLoot } from "../engine/take-loot";

export function registerTakeLootTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "take_loot",
    label: "Take Loot",
    description: "Take selected loot items from a kill or discovery and add them to the player's inventory. Currency goes to credits, items and weapons go to inventory. Only items the player chooses to take are added — unselected items stay behind.",
    parameters: Type.Object({
      db_path: Type.String({ description: "Path to game database" }),
      character_id: Type.Number({ description: "Player character ID" }),
      items: Type.Array(Type.Object({
        type: Type.String({ description: "currency / item / weapon" }),
        name: Type.String({ description: "Item or weapon name" }),
        quantity: Type.Number({ description: "Quantity to take" }),
      }), { description: "Items the player chooses to take" }),
    }),
    async execute(_toolCallId, params) {
      const SQL = await getSQL();
      const resolved = params.db_path.startsWith("/") ? params.db_path : resolve(process.cwd(), params.db_path);
      const buffer = readFileSync(resolved);
      const db = new SQL.Database(buffer);

      const result = takeLoot({ db, character_id: params.character_id, items: params.items });
      const data = db.export();
      writeFileSync(resolved, Buffer.from(data));
      db.close();

      const takenLines = result.taken.map(i => `  • ${i.name} ×${i.quantity}`).join("\n");
      const errorLines = result.errors.map(e => `  • ${e}`).join("\n");
      const response = result.success
        ? `✅ **Took:**\n${takenLines}`
        : `⚠️ **Partially taken:**\n${takenLines}\n\n**Errors:**\n${errorLines}`;

      return { content: [{ type: "text", text: response }], details: result };
    },
  });
}
