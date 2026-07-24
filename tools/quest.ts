import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getSQL } from "../db/connection";
import { createQuest, getActiveQuests, completeQuest } from "../engine/quest";

export function registerQuestTools(pi: ExtensionAPI) {
  pi.registerTool({
    name: "create_quest",
    label: "Create Quest",
    description: "Create a new quest for the player. Types: delivery (time-bound), exploration, fetch, kill. Optional rewards include credits, items, and weapons. For time-limited quests, set time_limit_minutes.",
    parameters: Type.Object({
      db_path: Type.String({ description: "Path to game database" }),
      title: Type.String({ description: "Quest title" }),
      description: Type.String({ description: "Quest description" }),
      quest_type: Type.String({ description: "delivery / exploration / fetch / kill" }),
      giver_npc: Type.String({ description: "NPC who gave the quest" }),
      target_location: Type.Optional(Type.String({ description: "Where to go" })),
      reward_credits: Type.Optional(Type.Number({ description: "Credit reward" })),
      reward_item_name: Type.Optional(Type.String({ description: "Item reward name" })),
      reward_weapon_name: Type.Optional(Type.String({ description: "Weapon reward name" })),
      time_limit_minutes: Type.Optional(Type.Number({ description: "Time limit for delivery quests" })),
    }),
    async execute(_toolCallId, params) {
      const SQL = await getSQL();
      const resolved = params.db_path.startsWith("/") ? params.db_path : resolve(process.cwd(), params.db_path);
      // Security: ensure path is within project directory
      if (!resolved.startsWith(resolve(process.cwd()))) {
        return { content: [{ type: "text", text: "❌ Invalid db_path" }], details: {}, isError: true };
      }
      const buffer = readFileSync(resolved);
      const db = new SQL.Database(buffer);
      const result = createQuest({ db, ...params });
      const data = db.export();
      writeFileSync(resolved, Buffer.from(data));
      db.close();
      if (!result.success) return { content: [{ type: "text", text: `❌ ${result.error}` }], details: result, isError: true };
      return { content: [{ type: "text", text: `📋 Quest created: "${params.title}" (#${result.quest_id})` }], details: result };
    },
  });

  pi.registerTool({
    name: "active_quests",
    label: "Active Quests",
    description: "List all active (incomplete) quests for the player.",
    parameters: Type.Object({
      db_path: Type.String({ description: "Path to game database" }),
    }),
    async execute(_toolCallId, params) {
      const SQL = await getSQL();
      const resolved = params.db_path.startsWith("/") ? params.db_path : resolve(process.cwd(), params.db_path);
      // Security: ensure path is within project directory
      if (!resolved.startsWith(resolve(process.cwd()))) {
        return { content: [{ type: "text", text: "❌ Invalid db_path" }], details: {}, isError: true };
      }
      const buffer = readFileSync(resolved);
      const db = new SQL.Database(buffer);
      const result = getActiveQuests(db);
      db.close();
      if (result.quests.length === 0) return { content: [{ type: "text", text: "No active quests." }], details: result };
      const lines = result.quests.map(q => `  • [#${q.id}] ${q.title} (${q.quest_type}) — ${q.giver_npc}`);
      return { content: [{ type: "text", text: `📋 **Active quests (${result.quests.length}):**\n${lines.join("\n")}` }], details: result };
    },
  });

  pi.registerTool({
    name: "complete_quest",
    label: "Complete Quest",
    description: "Complete a quest, reward the player with credits/items/weapons, and mark it as finished.",
    parameters: Type.Object({
      db_path: Type.String({ description: "Path to game database" }),
      quest_id: Type.Number({ description: "Quest ID to complete" }),
      character_id: Type.Number({ description: "Player character ID" }),
    }),
    async execute(_toolCallId, params) {
      const SQL = await getSQL();
      const resolved = params.db_path.startsWith("/") ? params.db_path : resolve(process.cwd(), params.db_path);
      // Security: ensure path is within project directory
      if (!resolved.startsWith(resolve(process.cwd()))) {
        return { content: [{ type: "text", text: "❌ Invalid db_path" }], details: {}, isError: true };
      }
      const buffer = readFileSync(resolved);
      const db = new SQL.Database(buffer);
      const result = completeQuest({ db, quest_id: params.quest_id, character_id: params.character_id });
      const data = db.export();
      writeFileSync(resolved, Buffer.from(data));
      db.close();
      if (!result.success) return { content: [{ type: "text", text: `❌ ${result.error}` }], details: result, isError: true };
      const parts = [`✅ Quest completed: "${result.quest_title}"`];
      if (result.credits_gained > 0) parts.push(`Credits gained: ${result.credits_gained}`);
      if (result.item_gained) parts.push(`Item gained: ${result.item_gained}`);
      if (result.weapon_gained) parts.push(`Weapon gained: ${result.weapon_gained}`);
      return { content: [{ type: "text", text: parts.join("\n") }], details: result };
    },
  });
}
