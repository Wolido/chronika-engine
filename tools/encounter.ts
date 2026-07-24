import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getSQL } from "../db/connection";
import { getEncounter } from "../engine/encounter";

function resolvePath(p: string): string {
  if (p.startsWith("/")) return p;
  return resolve(process.cwd(), p);
}

export function registerEncounterTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "get_encounter",
    label: "Get Encounter",
    description: "Select a random monster from the database matching the given danger level. Uses monsters table populated by world_gen. If no exact tier match exists, returns the closest available. The GM can also create custom encounters without this tool by passing monster stats directly to combat_resolve.",
    parameters: Type.Object({
      db_path: Type.String({ description: "Path to game database" }),
      danger_level: Type.Number({ description: "Danger level 1-5" }),
    }),
    async execute(_toolCallId, params) {
      const SQL = await getSQL();
      const resolved = resolvePath(params.db_path);
      const buffer = readFileSync(resolved);
      const db = new SQL.Database(buffer);

      const result = getEncounter({ danger_level: params.danger_level, db });
      db.close();

      if (!result.success) {
        return { content: [{ type: "text", text: `❌ ${result.error}` }], details: result, isError: true };
      }

      const m = result.monster;
      const approx = result.approximate ? " (approximate match)" : "";
      return {
        content: [{
          type: "text",
          text: `👾 **${m.name}** (tier ${m.tier})${approx}\nHP: ${m.hp} | DMG: ${m.damage_min}-${m.damage_max} | ACC: ${m.accuracy} | EVA: ${m.evasion} | ARM: ${m.armor}`,
        }],
        details: result,
      };
    },
  });
}
