import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getSQL } from "../db/connection";
import { logEvent, getHistory } from "../engine/event-log";

function resolvePath(p: string): string {
  if (p.startsWith("/")) return p;
  return resolve(process.cwd(), p);
}

async function openDB(dbPath: string) {
  const SQL = await getSQL();
  const resolved = resolvePath(dbPath);
  const buffer = readFileSync(resolved);
  const db = new SQL.Database(buffer);
  return db;
}

function saveDB(db: any, dbPath: string) {
  const data = db.export();
  writeFileSync(resolvePath(dbPath), Buffer.from(data));
  db.close();
}

export function registerEventLogTools(pi: ExtensionAPI) {
  pi.registerTool({
    name: "log_event",
    label: "Log Event",
    description: "Record an in-game event to the event_log table. The LLM should call this after every significant action (combat, exploration, loot, level up, quest progress, etc.) to maintain persistent game history.",
    parameters: Type.Object({
      db_path: Type.String({ description: "Path to the game database" }),
      event_type: Type.String({ description: "Event type: combat/exploration/social/loot/level_up/quest/narrative/system" }),
      summary: Type.String({ description: "Brief one-line summary of what happened" }),
      detail: Type.Optional(Type.String({ description: "Optional JSON string with detailed data" })),
    }),
    async execute(_toolCallId, params) {
      try {
        const db = await openDB(params.db_path);
        const result = logEvent(db, {
          event_type: params.event_type,
          summary: params.summary,
          detail: params.detail,
        });
        saveDB(db, params.db_path);
        return {
          content: [{ type: "text", text: `📝 Event #${result.event_id} (turn ${result.turn}) logged: ${params.summary}` }],
          details: result,
        };
      } catch (err) {
        return { content: [{ type: "text", text: `❌ Failed to log event: ${err}` }], details: {}, isError: true };
      }
    },
  });

  pi.registerTool({
    name: "get_history",
    label: "Get History",
    description: "Retrieve recent game events from the event_log table. Use this at session start to restore context about what has happened in the game world.",
    parameters: Type.Object({
      db_path: Type.String({ description: "Path to the game database" }),
      limit: Type.Optional(Type.Number({ description: "Max events to return (default 20)" })),
      event_type: Type.Optional(Type.String({ description: "Optional: filter by event type" })),
    }),
    async execute(_toolCallId, params) {
      try {
        const db = await openDB(params.db_path);
        const result = getHistory(db, { limit: params.limit ?? 20, event_type: params.event_type });
        db.close();
        if (result.events.length === 0) {
          return { content: [{ type: "text", text: "No events found." }], details: result };
        }
        const lines = result.events.map(e =>
          `[#${e.id} turn ${e.turn}] ${e.event_type}: ${e.summary}`
        );
        return { content: [{ type: "text", text: `**Recent events (${result.total} total):**\n${lines.join("\n")}` }], details: result };
      } catch (err) {
        return { content: [{ type: "text", text: `❌ Failed to get history: ${err}` }], details: {}, isError: true };
      }
    },
  });
}
