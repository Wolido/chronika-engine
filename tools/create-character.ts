import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { getSQL } from "../db/connection";
import { buildCharacterSQL } from "../engine/create-character";

function resolvePath(inputPath: string): string {
  if (inputPath.startsWith("/")) return inputPath;
  if (inputPath.startsWith("~")) {
    const home = process.env.HOME || process.env.USERPROFILE || "";
    return inputPath.replace("~", home);
  }
  return resolve(process.cwd(), inputPath);
}

export function registerCreateCharacterTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "create_character",
    label: "Create Character",
    description: "Create a new player character in the game database. Sets is_player=1, level=1, xp=0, hp=hp_max automatically. All stats and skills default to 5 if not specified.",
    parameters: Type.Object({
      db_path: Type.String({ description: "Path to the SQLite database file" }),
      name: Type.String({ description: "Character name" }),
      hp_max: Type.Optional(Type.Number({ description: "Max HP (default 30)" })),
      stats: Type.Optional(Type.Object({
        strength: Type.Optional(Type.Number({ description: "Strength (default 5)" })),
        agility: Type.Optional(Type.Number({ description: "Agility (default 5)" })),
        endurance: Type.Optional(Type.Number({ description: "Endurance (default 5)" })),
        perception: Type.Optional(Type.Number({ description: "Perception (default 5)" })),
        intelligence: Type.Optional(Type.Number({ description: "Intelligence (default 5)" })),
        willpower: Type.Optional(Type.Number({ description: "Willpower (default 5)" })),
      })),
      skills: Type.Optional(Type.Object({
        persuasion: Type.Optional(Type.Number({ description: "Persuasion (default 5)" })),
        survival: Type.Optional(Type.Number({ description: "Survival (default 5)" })),
        medicine: Type.Optional(Type.Number({ description: "Medicine (default 5)" })),
        mechanics: Type.Optional(Type.Number({ description: "Mechanics (default 5)" })),
        barter: Type.Optional(Type.Number({ description: "Barter (default 5)" })),
        stealth: Type.Optional(Type.Number({ description: "Stealth (default 5)" })),
        locksmith: Type.Optional(Type.Number({ description: "Locksmith (default 5)" })),
        tracking: Type.Optional(Type.Number({ description: "Tracking (default 5)" })),
      })),
      credits: Type.Optional(Type.Number({ description: "Starting credits (default 0)" })),
      current_location: Type.Optional(Type.String({ description: "Starting location name" })),
    }),
    async execute(_toolCallId, params) {
      try {
        const resolved = resolvePath(params.db_path);

        if (!existsSync(resolved)) {
          return {
            content: [{ type: "text", text: `❌ Database not found at \`${resolved}\`. Run init_db first.` }],
            details: { error: "Database not found" },
            isError: true,
          };
        }

        const SQL = await getSQL();
        const buffer = readFileSync(resolved);
        const db = new SQL.Database(buffer);

        const { sql, values } = buildCharacterSQL({
          name: params.name,
          hp_max: params.hp_max,
          stats: params.stats as any,
          skills: params.skills as any,
          credits: params.credits,
          current_location: params.current_location,
        });

        db.run(sql, values);

        // Get last insert ID
        const result = db.exec("SELECT last_insert_rowid() as id");
        const charId = result[0]?.values[0]?.[0] as number;

        const data = db.export();
        writeFileSync(resolved, Buffer.from(data));
        db.close();

        // Build summary of what was created
        const parts = [`✅ Character created!`];
        parts.push(`  • Name: ${params.name}`);
        parts.push(`  • ID: ${charId}`);
        parts.push(`  • HP: ${params.hp_max ?? 30}`);
        if (params.credits) parts.push(`  • Credits: ${params.credits}`);
        if (params.current_location) parts.push(`  • Location: ${params.current_location}`);

        return {
          content: [{ type: "text", text: parts.join("\n") }],
          details: { character_id: charId, name: params.name },
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `❌ Failed to create character: ${msg}` }],
          details: { error: msg },
          isError: true,
        };
      }
    },
  });
}
