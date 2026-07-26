import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getSQL } from "../db/connection";
import {
  setTimer,
  checkTimers,
  initGameTime,
  getFullTime,
} from "../engine/time";

/** Wrap a sql.js Database with a simple get/set interface backed by game_state table. */
export function dbAdapter(sqlDb: any) {
  // Load existing key-value pairs from game_state
  const cache: Record<string, any> = {};
  try {
    const results = sqlDb.exec("SELECT key, value FROM game_state");
    if (results.length > 0) {
      for (const row of results[0].values) {
        const key = row[0] as string;
        const raw = row[1] as string;
        try {
          cache[key] = JSON.parse(raw);
        } catch {
          cache[key] = raw;
        }
      }
    }
  } catch {
    // table may not exist yet — fine
  }

  return {
    get(key: string) {
      return key in cache ? cache[key] : null;
    },
    set(key: string, value: any) {
      if (value === null) {
        delete cache[key];
        sqlDb.run("DELETE FROM game_state WHERE key = ?", [key]);
      } else {
        cache[key] = value;
        sqlDb.run(
          "INSERT OR REPLACE INTO game_state (key, value) VALUES (?, ?)",
          [key, JSON.stringify(value)],
        );
      }
    },
  };
}

export function registerSetTimerTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "set_timer",
    label: "Set Timer",
    description:
      "Set a named countdown timer that expires after the given number of real-world minutes. Use check_timers to see remaining time. A timer with the same name is overwritten.",
    parameters: Type.Object({
      db_path: Type.String({ description: "Path to game database" }),
      name: Type.String({ description: "Unique timer name" }),
      minutes: Type.Number({ description: "Minutes until the timer is ready" }),
      description: Type.Optional(
        Type.String({ description: "Human-readable description" }),
      ),
    }),
    async execute(_toolCallId, params) {
      const SQL = await getSQL();
      const resolved = params.db_path.startsWith("/")
        ? params.db_path
        : resolve(process.cwd(), params.db_path);
      const buffer = readFileSync(resolved);
      const sqlDb = new SQL.Database(buffer);
      const db = dbAdapter(sqlDb);

      const entry = setTimer(db, params.name, params.minutes, params.description);

      const data = sqlDb.export();
      writeFileSync(resolved, Buffer.from(data));
      sqlDb.close();

      return {
        content: [
          {
            type: "text",
            text: `⏲️ Timer "${entry.name}" set for ${params.minutes} minutes.`,
          },
        ],
        details: entry,
      };
    },
  });
}

export function registerCheckTimersTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "check_timers",
    label: "Check Timers",
    description:
      "Check all active timers. Returns each timer's remaining minutes and whether it is ready. Ready timers are automatically cleared.",
    parameters: Type.Object({
      db_path: Type.String({ description: "Path to game database" }),
    }),
    async execute(_toolCallId, params) {
      const SQL = await getSQL();
      const resolved = params.db_path.startsWith("/")
        ? params.db_path
        : resolve(process.cwd(), params.db_path);
      const buffer = readFileSync(resolved);
      const sqlDb = new SQL.Database(buffer);
      const db = dbAdapter(sqlDb);

      const result = checkTimers(db);

      const data = sqlDb.export();
      writeFileSync(resolved, Buffer.from(data));
      sqlDb.close();

      if (result.length === 0) {
        return {
          content: [{ type: "text", text: "No active timers." }],
          details: result,
        };
      }
      const lines = result.map((t) =>
        t.ready
          ? `✅ ${t.name}${t.description ? ` (${t.description})` : ""} — ready!`
          : `⏳ ${t.name}${t.description ? ` (${t.description})` : ""} — ${t.remaining_minutes} min remaining`,
      );
      return {
        content: [{ type: "text", text: lines.join("\n") }],
        details: result,
      };
    },
  });
}

export function registerTimeTools(pi: ExtensionAPI) {
  pi.registerTool({
    name: "game_time",
    label: "Game Time",
    description:
      "Show the current in-game date, time, day/night cycle, and elapsed play time. Use this to determine time of day for encounters, NPC schedules, and travel conditions.",
    parameters: Type.Object({
      db_path: Type.String({ description: "Path to game database" }),
    }),
    async execute(_toolCallId, params) {
      const SQL = await getSQL();
      const resolved = params.db_path.startsWith("/")
        ? params.db_path
        : resolve(process.cwd(), params.db_path);
      const buffer = readFileSync(resolved);
      const sqlDb = new SQL.Database(buffer);
      const db = dbAdapter(sqlDb);

      const info = getFullTime(db);
      sqlDb.close();

      return {
        content: [
          {
            type: "text",
            text: `📅 ${info.year}-${String(info.month).padStart(2, "0")}-${String(info.day).padStart(2, "0")} ${String(info.hour).padStart(2, "0")}:${String(info.minute).padStart(2, "0")} (${info.day_of_week_name})\n⏰ Day ${info.day_number} — ${info.time_of_day}${info.is_night ? " 🌙" : " ☀️"}\nElapsed: ${info.elapsed_hours}h`,
          },
        ],
        details: info,
      };
    },
  });
}
