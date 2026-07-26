import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { getSQL } from "../db/connection";
import { DDL_STATEMENTS } from "../db/schema";
import { generateWorld, WorldGenInput } from "../engine/world-gen";

function resolvePath(inputPath: string): string {
  if (inputPath.startsWith("/")) return inputPath;
  if (inputPath.startsWith("~")) {
    const home = process.env.HOME || process.env.USERPROFILE || "";
    return inputPath.replace("~", home);
  }
  return resolve(process.cwd(), inputPath);
}

export function registerWorldGenTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "world_gen",
    label: "World Gen",
    description: "Generate a complete wasteland world database with weapons, monsters, items, status effects, and actions. Designed for a post-apocalyptic survival RPG setting. All entities are validated before writing. If any validation fails, nothing is written.\n\n"
      + "Required fields per entity type:\n"
      + "WEAPON: name, category (melee/ranged/thrown/explosive), damage_type (slashing/piercing/bludgeoning/thermal/explosive/chemical), damage_min, damage_max, accuracy (0-1), tier (1-5), rarity (common/uncommon/rare/legendary)\n"
      + "  Ranged/thrown weapons also require: range_min, range_max, ammo_type\n"
      + "MONSTER: name, category (beast/mutant/humanoid/mechanical/abomination), hp, damage_min, damage_max, accuracy (0-1), evasion (0-1), armor, tier (1-5), xp_reward, ALL 6 attributes: strength, agility, endurance, perception, intelligence, willpower (1-20 each)\n"
      + "  Constraint: sum of 6 attributes must be ≤ tier × 17, accuracy + evasion ≤ 1.3\n"
      + "ITEM: name, item_type (consumable/material/armor/misc), rarity (common/uncommon/rare/legendary), value, effect_type (heal/damage/restore), effect_value (number) — REQUIRED for consumable; null for misc\n"
      + "  Note: 'material' type items have no gameplay use yet - avoid creating them.\n"
      + "STATUS_EFFECT: name, effect_type (buff/debuff/dot/hot/stun/root), target_attribute (hp/strength/agility/endurance/perception/intelligence/willpower) — REQUIRED, magnitude, duration\n"
      + "ACTION: name, action_type (combat/social/exploration/craft/survival), primary_attr (strength/agility/endurance/perception/intelligence/willpower/survival/medicine/mechanics/barter/persuade/stealth/locksmith/tracking), difficulty (1-30), success_result (JSON), failure_result (JSON)",
    parameters: Type.Object({
      db_path: Type.String({ description: "Path to the SQLite database file (will be created if doesn't exist)" }),
      world_meta: Type.Optional(Type.Object({
        world_name: Type.String({ description: "Name of the world" }),
        world_desc: Type.Optional(Type.String({ description: "World description" })),
        tone: Type.Optional(Type.String({ description: "World tone/mood" })),
      })),
      weapons: Type.Optional(Type.Array(Type.Any(), { description: "Array of weapon data objects" })),
      monsters: Type.Optional(Type.Array(Type.Any(), { description: "Array of monster data objects" })),
      items: Type.Optional(Type.Array(Type.Any(), { description: "Array of item data objects" })),
      status_effects: Type.Optional(Type.Array(Type.Any(), { description: "Array of status effect data objects" })),
      actions: Type.Optional(Type.Array(Type.Any(), { description: "Array of action data objects" })),
    }),
    async execute(_toolCallId, params) {
      try {
        const resolved = resolvePath(params.db_path);

        // Ensure directory exists
        mkdirSync(dirname(resolved), { recursive: true });

        // Open or create database
        const SQL = await getSQL();
        let db: any;
        if (existsSync(resolved)) {
          const buffer = readFileSync(resolved);
          db = new SQL.Database(buffer);
        } else {
          db = new SQL.Database();
        }

        // Ensure schema exists
        db.run("PRAGMA foreign_keys = ON");
        db.run(DDL_STATEMENTS);

        // Run world generation
        const input: WorldGenInput = {
          world_meta: params.world_meta,
          weapons: params.weapons as any,
          monsters: params.monsters as any,
          items: params.items as any,
          status_effects: params.status_effects as any,
          actions: params.actions as any,
        };

        const result = generateWorld(db, input);

        // Persist to file (even on validation failure, schema was applied)
        const data = db.export();
        writeFileSync(resolved, Buffer.from(data));
        db.close();

        // Build response text
        if (!result.ok) {
          return {
            content: [{
              type: "text",
              text: `❌ World generation failed with ${result.errors.length} error(s):\n${result.errors.map(e => `  • ${e}`).join("\n")}\n\nNo data was written. Fix the errors and try again.`,
            }],
            details: result,
            isError: true,
          };
        }

        const parts: string[] = [`✅ World generation complete!`];
        if (result.stats.weapons_written > 0) parts.push(`  • ${result.stats.weapons_written} weapons`);
        if (result.stats.monsters_written > 0) parts.push(`  • ${result.stats.monsters_written} monsters`);
        if (result.stats.items_written > 0) parts.push(`  • ${result.stats.items_written} items`);
        if (result.stats.status_effects_written > 0) parts.push(`  • ${result.stats.status_effects_written} status effects`);
        if (result.stats.actions_written > 0) parts.push(`  • ${result.stats.actions_written} actions`);

        return {
          content: [{ type: "text", text: parts.join("\n") }],
          details: result,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `❌ World generation error: ${msg}` }],
          details: { error: msg },
          isError: true,
        };
      }
    },
  });
}
