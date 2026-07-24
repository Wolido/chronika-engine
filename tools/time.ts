import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getSQL } from "../db/connection";
import {
  startQuickTravel,
  checkTravelArrival,
  initGameTime,
  getFullTime,
} from "../engine/time";

/** Wrap a sql.js Database with a simple get/set interface backed by game_state table. */
function dbAdapter(sqlDb: any) {
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

export function registerTimeTools(pi: ExtensionAPI) {
  pi.registerTool({
    name: "quick_travel",
    label: "Quick Travel",
    description:
      "Start a quick travel between locations. Travel takes real time: distance / speed (default 5 km/h). The player must wait the actual duration. Use check_arrival to see if they've arrived.",
    parameters: Type.Object({
      db_path: Type.String({ description: "Path to game database" }),
      from: Type.String({ description: "Departure location" }),
      to: Type.String({ description: "Destination" }),
      distance_km: Type.Number({ description: "Distance in kilometers" }),
      speed_kmh: Type.Optional(
        Type.Number({ description: "Travel speed in km/h (default 5)" }),
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

      const result = startQuickTravel({
        db,
        from: params.from,
        to: params.to,
        distance_km: params.distance_km,
        speed_kmh: params.speed_kmh,
      });
      if (!result.success) {
        sqlDb.close();
        return { content: [{ type: "text", text: `❌ ${result.error}` }], details: result, isError: true };
      }

      const data = sqlDb.export();
      writeFileSync(resolved, Buffer.from(data));
      sqlDb.close();

      return {
        content: [
          {
            type: "text",
            text: `🚶 Quick travel from ${result.from} to ${result.to}. Distance: ${result.distance_km}km, ETA: ${result.travel_time_minutes} minutes. Say "我到了" when you arrive.`,
          },
        ],
        details: result,
      };
    },
  });

  pi.registerTool({
    name: "check_arrival",
    label: "Check Arrival",
    description:
      "Check if a quick travel has arrived. If enough real time has passed, the player has arrived at their destination.",
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

      const result = checkTravelArrival(db);

      const data = sqlDb.export();
      writeFileSync(resolved, Buffer.from(data));
      sqlDb.close();

      if (result.arrived) {
        return {
          content: [{ type: "text", text: `✅ Arrived at ${result.to}!` }],
          details: result,
        };
      }
      if (!result.traveling) {
        return {
          content: [{ type: "text", text: "Not currently traveling." }],
          details: result,
        };
      }
      return {
        content: [
          {
            type: "text",
            text: `⏳ Still traveling to ${result.to}. About ${result.remaining_minutes} minutes remaining.`,
          },
        ],
        details: result,
      };
    },
  });

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
